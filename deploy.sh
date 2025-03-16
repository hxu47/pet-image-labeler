#!/bin/bash
set -e # Exit immediately if a command fails

echo "Cleaning up Docker resources to free space..."
docker system prune -a -f

# Disable AWS CLI pager to prevent interactive less
export AWS_PAGER=""


# Deploy the lambda-code-bucket
aws cloudformation deploy \
  --template-file cloudformation/lambda-code-bucket.yaml \
  --stack-name pet-image-labeling-lambda-bucket

# Get the bucket name
LAMBDA_CODE_BUCKET=$(aws cloudformation describe-stacks --stack-name pet-image-labeling-lambda-bucket --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" --output text)
echo "Lambda code bucket: $LAMBDA_CODE_BUCKET"

# Function to package a Lambda function
package_lambda() {
  func_name=$1
  echo "Packaging $func_name Function..."
  mkdir -p /tmp/lambda-package
  cd lambda/$func_name
  npm install
  cp -r * /tmp/lambda-package/
  cd /tmp/lambda-package
  # Use /tmp which is typically writable
  zip -r /tmp/$func_name.zip ./*
  cd ../../../
  # Copy the zip from /tmp to current directory if needed
  cp /tmp/$func_name.zip ./
  rm -rf /tmp/lambda-package
}

# Package Lambda functions
echo "Packaging Lambda functions..."

# Package Cognito Token Utility Lambda Layer (keep as is - layers have different structure)
echo "Packaging Cognito Token Utility Layer..."
cd lambda/cognito-token-util
npm install
cd ../..
zip -r cognito-token-util.zip lambda/cognito-token-util

# Package other functions
package_lambda "submit-labels"
package_lambda "get-images"
package_lambda "dashboard-metrics"
package_lambda "get-upload-url"
package_lambda "image-upload"

# Upload Lambda packages to S3
echo "Uploading Lambda packages to S3..."
aws s3 cp cognito-token-util.zip s3://$LAMBDA_CODE_BUCKET/
aws s3 cp submit-labels.zip s3://$LAMBDA_CODE_BUCKET/
aws s3 cp get-images.zip s3://$LAMBDA_CODE_BUCKET/
aws s3 cp dashboard-metrics.zip s3://$LAMBDA_CODE_BUCKET/
aws s3 cp get-upload-url.zip s3://$LAMBDA_CODE_BUCKET/
aws s3 cp image-upload.zip s3://$LAMBDA_CODE_BUCKET/

# 1. Deploy Cognito resources for authentication
echo "Deploying Cognito authentication resources..."
aws cloudformation deploy \
  --template-file cloudformation/cognito-auth.yaml \
  --stack-name pet-image-labeling-auth \
  --capabilities CAPABILITY_NAMED_IAM

# Get Cognito resource IDs
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name pet-image-labeling-auth --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text)
USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name pet-image-labeling-auth --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" --output text)

echo "Cognito User Pool ID: $USER_POOL_ID"
echo "Cognito User Pool Client ID: $USER_POOL_CLIENT_ID"

# 2. Deploy SNS topics for notifications
echo "Deploying SNS notification topics..."
aws cloudformation deploy \
  --template-file cloudformation/sns-integration.yaml \
  --stack-name pet-image-labeling-sns \
  --capabilities CAPABILITY_NAMED_IAM

# Get SNS topic ARNs
IMAGE_UPLOAD_TOPIC_ARN=$(aws cloudformation describe-stacks --stack-name pet-image-labeling-sns --query "Stacks[0].Outputs[?OutputKey=='ImageUploadTopicArn'].OutputValue" --output text)
LABEL_SUBMISSION_TOPIC_ARN=$(aws cloudformation describe-stacks --stack-name pet-image-labeling-sns --query "Stacks[0].Outputs[?OutputKey=='LabelSubmissionTopicArn'].OutputValue" --output text)
SYSTEM_ALERTS_TOPIC_ARN=$(aws cloudformation describe-stacks --stack-name pet-image-labeling-sns --query "Stacks[0].Outputs[?OutputKey=='SystemAlertsTopicArn'].OutputValue" --output text)

echo "Image Upload Topic ARN: $IMAGE_UPLOAD_TOPIC_ARN"
echo "Label Submission Topic ARN: $LABEL_SUBMISSION_TOPIC_ARN"
echo "System Alerts Topic ARN: $SYSTEM_ALERTS_TOPIC_ARN"

# 3. Deploy DynamoDB tables
echo "Deploying DynamoDB tables..."
aws cloudformation deploy \
  --template-file cloudformation/dynamodb-tables.yaml \
  --stack-name pet-image-labeling-database

# 4. Deploy Lambda functions
echo "Deploying Lambda functions..."
aws cloudformation deploy \
  --template-file cloudformation/lambda-functions.yaml \
  --stack-name pet-image-labeling-functions \
  --parameter-overrides \
    DynamoDBStackName=pet-image-labeling-database \
    AuthStackName=pet-image-labeling-auth \
    SNSStackName=pet-image-labeling-sns \
    LambdaCodeBucket=$LAMBDA_CODE_BUCKET

# 5. Deploy S3 storage
echo "Deploying S3 storage..."
aws cloudformation deploy \
  --template-file cloudformation/s3-storage.yaml \
  --stack-name pet-image-labeling-storage \
  --parameter-overrides LambdaStackName=pet-image-labeling-functions

# 6. Deploy API Gateway
echo "Deploying API Gateway..."
aws cloudformation deploy \
  --template-file cloudformation/api-gateway.yaml \
  --stack-name pet-image-labeling-api \
  --parameter-overrides \
    LambdaStackName=pet-image-labeling-functions \
    AuthStackName=pet-image-labeling-auth

# Get the API endpoint URL
API_URL=$(aws cloudformation describe-stacks --stack-name pet-image-labeling-api --query "Stacks[0].Outputs[?OutputKey=='ApiURL'].OutputValue" --output text)
echo "API URL: $API_URL"


# Update config.js 
echo "export const config = { 
  apiUrl: '$API_URL',
  cognito: {
    region: 'us-east-1',
    userPoolId: '$USER_POOL_ID',
    userPoolClientId: '$USER_POOL_CLIENT_ID'
  },
  labelTypes: [
    { id: 'type', name: 'Pet Type', options: ['Dog', 'Cat', 'Bird', 'Rabbit', 'Rodent', 'Reptile', 'Fish', 'Other'] },
    { id: 'breed', name: 'Breed', options: [
      // Dogs
      'Labrador Retriever', 'German Shepherd', 'Golden Retriever', 'Bulldog', 'Beagle', 'Poodle',
      // Cats
      'Persian', 'Maine Coon', 'Siamese', 'Bengal', 'Ragdoll', 'Sphynx',
      // Other
      'Parakeet', 'Cockatiel', 'Lop Rabbit', 'Netherland Dwarf', 'Hamster', 'Guinea Pig', 'Other'
    ] },
    { id: 'age', name: 'Age', options: ['Kitten/Puppy (0-1 year)', 'Young Adult (1-3 years)', 'Adult (3-7 years)', 'Senior (7+ years)'] },
    { id: 'coat', name: 'Coat Color', options: ['Black', 'White', 'Brown', 'Tan', 'Gray', 'Orange', 'Calico', 'Tabby', 'Brindle', 'Spotted', 'Mixed'] },
    { id: 'health', name: 'Health Condition', options: ['None visible', 'Skin condition', 'Eye condition', 'Lameness', 'Dental issue', 'Overweight', 'Underweight'] }
  ]
};" > pet-image-labeling-webapp/src/config.js

# 7. Deploy web interface CF stack
echo "Deploying web interface CloudFormation stack..."
aws cloudformation deploy \
  --template-file cloudformation/web-interface.yaml \
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