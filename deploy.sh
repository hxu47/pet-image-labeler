#!/bin/bash
set -e # Exit immediately if a command fails

echo "Cleaning up Docker resources to free space..."
docker system prune -a -f

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

# Package Lambda functions
echo "Packaging Lambda functions..."

# Package Cognito Token Utility Lambda Layer
echo "Packaging Cognito Token Utility Layer..."
cd lambda/cognito-token-util
npm install
cd ../..
zip -r cognito-token-util.zip lambda/cognito-token-util

# Package Submit Labels Lambda Function
echo "Packaging Submit Labels Function..."
cd lambda/submit-labels
npm install
cd ../..
zip -r submit-labels.zip lambda/submit-labels

# Package Get Images Lambda Function
echo "Packaging Get Images Function..."
cd lambda/get-images
npm install
cd ../..
zip -r get-images.zip lambda/get-images

# Package Dashboard Metrics Lambda Function
echo "Packaging Dashboard Metrics Function..."
cd lambda/dashboard-metrics
npm install
cd ../..
zip -r dashboard-metrics.zip lambda/dashboard-metrics

# Package Get Upload URL Lambda Function
echo "Packaging Get Upload URL Function..."
cd lambda/get-upload-url
npm install
cd ../..
zip -r get-upload-url.zip lambda/get-upload-url

# Package Image Upload Lambda Function
echo "Packaging Image Upload Function..."
cd lambda/image-upload
npm install
cd ../..
zip -r image-upload.zip lambda/image-upload

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

# Create a test user in Cognito
echo "Creating test user in Cognito..."
TEST_USER_EMAIL="tester@petlabeling.com"
TEST_USER_PASSWORD="Testing123!"
TEST_USER_NAME="Test User"

# Create the user
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username $TEST_USER_EMAIL \
  --user-attributes \
    Name=email,Value=$TEST_USER_EMAIL \
    Name=email_verified,Value=true \
    Name=name,Value="$TEST_USER_NAME" \
  --message-action SUPPRESS

# Set the user's password
aws cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username $TEST_USER_EMAIL \
  --password $TEST_USER_PASSWORD \
  --permanent

# Add the user to the Labelers group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id $USER_POOL_ID \
  --username $TEST_USER_EMAIL \
  --group-name Labelers

echo "Test user created with email: $TEST_USER_EMAIL and password: $TEST_USER_PASSWORD"

# Create an admin user in Cognito
echo "Creating admin user in Cognito..."
ADMIN_EMAIL="admin@petlabeling.com"
ADMIN_PASSWORD="Admin123!"
ADMIN_NAME="Administrator"

# Create the admin user
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username $ADMIN_EMAIL \
  --user-attributes \
    Name=email,Value=$ADMIN_EMAIL \
    Name=email_verified,Value=true \
    Name=name,Value="$ADMIN_NAME" \
  --message-action SUPPRESS

# Set the admin user's password
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

# Update config.js with actual values
echo "export const config = { 
  apiUrl: '$API_URL',
  cognito: {
    region: '${AWS::Region}',
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

# Set up CloudWatch dashboard for monitoring
echo "Creating CloudWatch dashboard for monitoring..."
cat > cloudwatch-dashboard.json << EOF
{
  "widgets": [
    {
      "type": "metric",
      "x": 0,
      "y": 0,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          [ "AWS/Lambda", "Invocations", "FunctionName", "pet-image-labeling-functions-GetImages", { "stat": "Sum", "period": 300 } ],
          [ "AWS/Lambda", "Invocations", "FunctionName", "pet-image-labeling-functions-SubmitLabels", { "stat": "Sum", "period": 300 } ],
          [ "AWS/Lambda", "Invocations", "FunctionName", "pet-image-labeling-functions-GetUploadUrl", { "stat": "Sum", "period": 300 } ],
          [ "AWS/Lambda", "Invocations", "FunctionName", "pet-image-labeling-functions-DashboardMetrics", { "stat": "Sum", "period": 300 } ]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "${AWS::Region}",
        "title": "Lambda Function Invocations",
        "period": 300
      }
    },
    {
      "type": "metric",
      "x": 12,
      "y": 0,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          [ "AWS/Lambda", "Duration", "FunctionName", "pet-image-labeling-functions-GetImages", { "stat": "Average", "period": 300 } ],
          [ "AWS/Lambda", "Duration", "FunctionName", "pet-image-labeling-functions-SubmitLabels", { "stat": "Average", "period": 300 } ],
          [ "AWS/Lambda", "Duration", "FunctionName", "pet-image-labeling-functions-GetUploadUrl", { "stat": "Average", "period": 300 } ],
          [ "AWS/Lambda", "Duration", "FunctionName", "pet-image-labeling-functions-DashboardMetrics", { "stat": "Average", "period": 300 } ]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "${AWS::Region}",
        "title": "Lambda Function Duration",
        "period": 300
      }
    },
    {
      "type": "metric",
      "x": 0,
      "y": 6,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          [ "AWS/ApiGateway", "Count", "ApiName", "pet-image-labeling-api-API" ]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "${AWS::Region}",
        "title": "API Gateway Request Count",
        "period": 300
      }
    },
    {
      "type": "metric",
      "x": 12,
      "y": 6,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          [ "AWS/ApiGateway", "Latency", "ApiName", "pet-image-labeling-api-API" ]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "${AWS::Region}",
        "title": "API Gateway Latency",
        "period": 300
      }
    }
  ]
}
EOF

# Create the CloudWatch dashboard
aws cloudwatch put-dashboard \
  --dashboard-name PetImageLabelingSystem \
  --dashboard-body file://cloudwatch-dashboard.json

echo "CloudWatch dashboard created."

# Create CloudWatch alarms for monitoring key metrics
echo "Creating CloudWatch alarms..."

# Alarm for Lambda errors
aws cloudwatch put-metric-alarm \
  --alarm-name "PetImageLabelingSystem-LambdaErrors" \
  --alarm-description "Alarm when Lambda functions have errors" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --evaluation-periods 1 \
  --alarm-actions $SYSTEM_ALERTS_TOPIC_ARN \
  --dimensions Name=FunctionName,Value=pet-image-labeling-functions-SubmitLabels

# Alarm for API Gateway 5xx errors
aws cloudwatch put-metric-alarm \
  --alarm-name "PetImageLabelingSystem-API5xxErrors" \
  --alarm-description "Alarm when API Gateway returns 5xx errors" \
  --metric-name 5XXError \
  --namespace AWS/ApiGateway \
  --statistic Sum \
  --period 300 \
  --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --evaluation-periods 1 \
  --alarm-actions $SYSTEM_ALERTS_TOPIC_ARN \
  --dimensions Name=ApiName,Value=pet-image-labeling-api-API

echo "CloudWatch alarms created."

echo "Deployment complete. Application should be available soon at the load balancer URL:"
aws cloudformation describe-stacks --stack-name pet-image-labeling-web --query "Stacks[0].Outputs[?OutputKey=='WebAppURL'].OutputValue" --output text