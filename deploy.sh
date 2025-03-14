#!/bin/bash
set -e # Exit immediately if a command fails

echo "Cleaning up Docker resources to free space..."
docker system prune -a -f

# Package the image processor Lambda
echo "Packaging image processor Lambda function..."
cd image-processor
npm install
zip -r ../image-processor.zip .
cd ..

echo "Uploading Lambda package to S3..."
# Create a temporary S3 bucket for Lambda code if it doesn't exist
LAMBDA_BUCKET="pet-image-labeling-lambda-packages-$(aws sts get-caller-identity --query Account --output text)"
aws s3api head-bucket --bucket $LAMBDA_BUCKET 2>/dev/null || aws s3 mb s3://$LAMBDA_BUCKET

# Upload the Lambda package
aws s3 cp image-processor.zip s3://$LAMBDA_BUCKET/


# 1. Deploy DynamoDB tables
echo "Deploying DynamoDB tables..."
aws cloudformation deploy \
  --template-file dynamodb-tables.yaml \
  --stack-name pet-image-labeling-database

# 2. Deploy Lambda functions
echo "Deploying Lambda functions..."
aws cloudformation deploy \
  --template-file lambda-functions.yaml \
  --stack-name pet-image-labeling-functions \
  --parameter-overrides DynamoDBStackName=pet-image-labeling-database LambdaCodeBucket=$LAMBDA_BUCKET

# 3. Deploy S3 storage
echo "Deploying S3 storage..."
aws cloudformation deploy \
  --template-file s3-storage.yaml \
  --stack-name pet-image-labeling-storage \
  --parameter-overrides LambdaStackName=pet-image-labeling-functions

# 4. Deploy API Gateway
echo "Deploying API Gateway..."
aws cloudformation deploy \
  --template-file api-gateway.yaml \
  --stack-name pet-image-labeling-api \
  --parameter-overrides LambdaStackName=pet-image-labeling-functions

# Get the API endpoint URL
API_URL=$(aws cloudformation describe-stacks --stack-name pet-image-labeling-api --query "Stacks[0].Outputs[?OutputKey=='ApiURL'].OutputValue" --output text)
echo "API URL: $API_URL"

# Update config.js 
echo "export const config = { 
  apiUrl: '$API_URL',
  labelTypes: [
    { id: 'breed', name: 'Breed', options: ['Labrador Retriever', 'German Shepherd', 'Golden Retriever', 'Bulldog', 'Beagle', 'Poodle', 'Other'] },
    { id: 'age', name: 'Age', options: ['Kitten/Puppy (0-1 year)', 'Young Adult (1-3 years)', 'Adult (3-7 years)', 'Senior (7+ years)'] },
    { id: 'coat', name: 'Coat Color', options: ['Black', 'White', 'Brown', 'Tan', 'Gray', 'Mixed'] },
    { id: 'health', name: 'Health Condition', options: ['None visible', 'Skin condition', 'Eye condition', 'Lameness', 'Overweight', 'Underweight'] }
  ]
};" > pet-image-labeling-webapp/src/config.js

# 5. Deploy web interface CF stack
echo "Deploying web interface CloudFormation stack..."
aws cloudformation deploy \
  --template-file web-interface.yaml \
  --stack-name pet-image-labeling-web \
  --parameter-overrides S3StorageStackName=pet-image-labeling-storage \
  --capabilities CAPABILITY_IAM

# Get the ECR repository URI
ECR_REPO=$(aws cloudformation describe-stacks --stack-name pet-image-labeling-web --query "Stacks[0].Outputs[?OutputKey=='ECRRepositoryURI'].OutputValue" --output text)
echo "ECR Repository URI: $ECR_REPO"

# Build and push the Docker image
cd pet-image-labeling-webapp
echo "Building Docker image with optimized settings..."
docker build --no-cache -t $ECR_REPO:latest .

echo "Authenticating with ECR..."
aws ecr get-login-password | docker login --username AWS --password-stdin $(echo $ECR_REPO | cut -d/ -f1)

echo "Pushing Docker image to ECR..."
docker push $ECR_REPO:latest

cd ..

# Update the ECS service to use the new image and set desired count to 1
aws ecs update-service --no-cli-pager --cluster pet-image-labeling-web-Cluster --service pet-image-labeling-web-service --desired-count 1

echo "Deployment complete. Application should be available soon at the load balancer URL:"
aws cloudformation describe-stacks --stack-name pet-image-labeling-web --query "Stacks[0].Outputs[?OutputKey=='WebAppURL'].OutputValue" --output text
