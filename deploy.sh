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

# Create a CloudFormation stack for the Lambda code bucket
echo "Creating Lambda code bucket via CloudFormation..."
cat > lambda-code-bucket.yaml << EOF
AWSTemplateFormatVersion: '2010-09-09'
Resources:
  LambdaCodeBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: pet-image-labeling-lambda-packages
      VersioningConfiguration:
        Status: Enabled
Outputs:
  BucketName:
    Description: "Lambda code bucket name"
    Value: !Ref LambdaCodeBucket
EOF

# Deploy the bucket
aws cloudformation deploy \
  --template-file lambda-code-bucket.yaml \
  --stack-name pet-image-labeling-lambda-bucket

# Get the bucket name
LAMBDA_CODE_BUCKET=$(aws cloudformation describe-stacks --stack-name pet-image-labeling-lambda-bucket --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" --output text)
echo "Lambda code bucket: $LAMBDA_CODE_BUCKET"

# Upload the Lambda package
echo "Uploading Lambda package to S3..."
aws s3 cp image-processor.zip s3://$LAMBDA_CODE_BUCKET/

# 1. Deploy Cognito resources for authentication
echo "Deploying Cognito authentication resources..."
aws cloudformation deploy \
  --template-file cognito-auth.yaml \
  --stack-name pet-image-labeling-auth \
  --capabilities CAPABILITY_IAM

# Get Cognito resource IDs
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name pet-image-labeling-auth --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text)
USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name pet-image-labeling-auth --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" --output text)
IDENTITY_POOL_ID=$(aws cloudformation describe-stacks --stack-name pet-image-labeling-auth --query "Stacks[0].Outputs[?OutputKey=='IdentityPoolId'].OutputValue" --output text)

echo "Cognito User Pool ID: $USER_POOL_ID"
echo "Cognito User Pool Client ID: $USER_POOL_CLIENT_ID"
echo "Cognito Identity Pool ID: $IDENTITY_POOL_ID"

# 2. Deploy DynamoDB tables
echo "Deploying DynamoDB tables..."
aws cloudformation deploy \
  --template-file dynamodb-tables.yaml \
  --stack-name pet-image-labeling-database

# 3. Deploy Lambda functions
echo "Deploying Lambda functions..."
aws cloudformation deploy \
  --template-file lambda-functions.yaml \
  --stack-name pet-image-labeling-functions \
  --parameter-overrides DynamoDBStackName=pet-image-labeling-database LambdaCodeBucket=$LAMBDA_CODE_BUCKET

# 4. Deploy S3 storage
echo "Deploying S3 storage..."
aws cloudformation deploy \
  --template-file s3-storage.yaml \
  --stack-name pet-image-labeling-storage \
  --parameter-overrides LambdaStackName=pet-image-labeling-functions

# 5. Deploy API Gateway
echo "Deploying API Gateway..."
aws cloudformation deploy \
  --template-file api-gateway.yaml \
  --stack-name pet-image-labeling-api \
  --parameter-overrides LambdaStackName=pet-image-labeling-functions

# Get the API endpoint URL
API_URL=$(aws cloudformation describe-stacks --stack-name pet-image-labeling-api --query "Stacks[0].Outputs[?OutputKey=='ApiURL'].OutputValue" --output text)
echo "API URL: $API_URL"

# Update config.js with actual values
echo "export const config = { 
  apiUrl: '$API_URL',
  cognito: {
    region: '${AWS::Region}',
    userPoolId: '$USER_POOL_ID',
    userPoolClientId: '$USER_POOL_CLIENT_ID',
    identityPoolId: '$IDENTITY_POOL_ID',
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

# 6. Deploy web interface CF stack
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
aws ecs update-service --no-cli-pager --cluster pet-image-labeling-web-Cluster --service pet-image-labeling-web-service --desired count 1

# Create admin user in Cognito
echo "Creating admin user in Cognito..."
ADMIN_EMAIL="admin@petlabeling.com"
ADMIN_PASSWORD="Admin123!"
ADMIN_NAME="Administrator"

aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username $ADMIN_EMAIL \
  --user-attributes \
    Name=email,Value=$ADMIN_EMAIL \
    Name=email_verified,Value=true \
    Name=name,Value="$ADMIN_NAME"

# Set the admin password
aws cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username $ADMIN_EMAIL \
  --password $ADMIN_PASSWORD \
  --permanent

# Add the admin to the Admins group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id $USER_POOL_ID \
  --username $ADMIN_EMAIL \
  --group-name Admins

echo "Admin user created with email: $ADMIN_EMAIL and password: $ADMIN_PASSWORD"

echo "Deployment complete. Application should be available soon at the load balancer URL:"
aws cloudformation describe-stacks --stack-name pet-image-labeling-web --query "Stacks[0].Outputs[?OutputKey=='WebAppURL'].OutputValue" --output text