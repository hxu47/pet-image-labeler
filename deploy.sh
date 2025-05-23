#!/bin/bash
set -e # Exit immediately if a command fails

rm -rf /tmp/* 2>/dev/null || true

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
  # Save the current directory
  START_DIR=$(pwd)
  
  echo "Packaging $func_name Function..."
  
  mkdir -p /tmp/lambda-package
  cd lambda/$func_name
  npm install
  cp -r * /tmp/lambda-package/
  cd /tmp/lambda-package
  zip -r /tmp/$func_name.zip ./*
  
  # Return to the starting directory using the saved path
  cd $START_DIR
  
  cp /tmp/$func_name.zip ./
  rm -rf /tmp/lambda-package
}

# Function to package a Lambda layer
package_lambda_layer() {
  layer_name=$1
  source_dir=$2
  node_modules_prefix=$3  #  parameter for node_modules structure
  
  # Save the current directory
  START_DIR=$(pwd)
  
  echo "Packaging $layer_name Layer..."
  
  # Create the layer directory structure
  mkdir -p /tmp/$layer_name-layer/nodejs
  
  # Copy package.json
  cp -r $START_DIR/lambda/$source_dir/package.json /tmp/$layer_name-layer/nodejs/
  
  # Change to the nodejs directory and install dependencies
  cd /tmp/$layer_name-layer/nodejs
  npm install
  
  # If node_modules_prefix is provided, create that structure
  mkdir -p node_modules/$node_modules_prefix
  cp -r $START_DIR/lambda/$source_dir/* node_modules/$node_modules_prefix/
  
  # Go back to the layer root and zip it
  cd ..
  zip -r /tmp/$layer_name.zip .
  
  # Return to original directory
  cd $START_DIR
  
  # Upload to S3
  echo "Uploading $layer_name Layer to S3..."
  aws s3 cp /tmp/$layer_name.zip s3://$LAMBDA_CODE_BUCKET/
}

# Package Lambda functions
echo "Packaging Lambda functions..."

# Package layers
package_lambda_layer "cognito-token-util" "cognito-token-util" "cognito-token-util"
package_lambda_layer "monitoring-util" "monitoring-util" "monitoring-util" 

# Package other functions
package_lambda "submit-labels"
package_lambda "get-images"
package_lambda "dashboard-metrics"
package_lambda "get-upload-url"
package_lambda "image-upload"
package_lambda "get-user"
package_lambda "get-user-statistics"
package_lambda "get-all-users"
package_lambda "update-user-role"
package_lambda "create-user"

# Upload Lambda packages to S3
echo "Uploading Lambda packages to S3..."
aws s3 cp submit-labels.zip s3://$LAMBDA_CODE_BUCKET/
aws s3 cp get-images.zip s3://$LAMBDA_CODE_BUCKET/
aws s3 cp dashboard-metrics.zip s3://$LAMBDA_CODE_BUCKET/
aws s3 cp get-upload-url.zip s3://$LAMBDA_CODE_BUCKET/
aws s3 cp image-upload.zip s3://$LAMBDA_CODE_BUCKET/
aws s3 cp get-user.zip s3://$LAMBDA_CODE_BUCKET/
aws s3 cp get-user-statistics.zip s3://$LAMBDA_CODE_BUCKET/
aws s3 cp get-all-users.zip s3://$LAMBDA_CODE_BUCKET/
aws s3 cp update-user-role.zip s3://$LAMBDA_CODE_BUCKET/
aws s3 cp create-user.zip s3://$LAMBDA_CODE_BUCKET/

# 1. Deploy Cognito resources for authentication
echo "Deploying Cognito authentication resources..."
aws cloudformation deploy \
  --template-file cloudformation/cognito-auth.yaml \
  --stack-name pet-image-labeling-auth \
  --capabilities CAPABILITY_NAMED_IAM

# Get Cognito resource IDs
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name pet-image-labeling-auth --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text)
USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name pet-image-labeling-auth --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" --output text)
IDENTITY_POOL_ID=$(aws cloudformation describe-stacks --stack-name pet-image-labeling-auth --query "Stacks[0].Outputs[?OutputKey=='IdentityPoolId'].OutputValue" --output text)

echo "Cognito User Pool ID: $USER_POOL_ID"
echo "Cognito User Pool Client ID: $USER_POOL_CLIENT_ID"
echo "Cognito Identity Pool ID: $IDENTITY_POOL_ID"

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

echo "Configuring S3 bucket notification..."
# Get the S3 bucket name
S3_BUCKET=$(aws cloudformation describe-stacks --stack-name pet-image-labeling-storage --query "Stacks[0].Outputs[?OutputKey=='RawBucketName'].OutputValue" --output text)
echo "S3 Bucket: $S3_BUCKET"

# Get the Lambda function ARN
LAMBDA_ARN=$(aws cloudformation list-exports --query "Exports[?Name=='pet-image-labeling-functions-ImageUploadFunctionArn'].Value" --output text)
echo "Lambda ARN: $LAMBDA_ARN"

# Verify both values were properly retrieved
if [ -z "$S3_BUCKET" ] || [ -z "$LAMBDA_ARN" ]; then
  echo "Error: Failed to retrieve S3 bucket name or Lambda ARN"
  exit 1
fi

# Create a JSON file for the notification configuration
cat > notification.json << EOF
{
  "LambdaFunctionConfigurations": [
    {
      "LambdaFunctionArn": "$LAMBDA_ARN",
      "Events": ["s3:ObjectCreated:*"]
    }
  ]
}
EOF

# Apply the notification configuration
aws s3api put-bucket-notification-configuration \
  --bucket $S3_BUCKET \
  --notification-configuration file://notification.json

echo "S3 notification configuration applied"

# 6. Deploy API Gateway
echo "Deploying API Gateway..."
aws cloudformation deploy \
  --template-file cloudformation/api-gateway.yaml \
  --stack-name pet-image-labeling-api \
  --parameter-overrides \
    LambdaStackName=pet-image-labeling-functions \
    AuthStackName=pet-image-labeling-auth

# 7. Deploy CloudWatch Monitoring
echo "Deploying CloudWatch Monitoring..."
aws cloudformation deploy \
  --template-file cloudformation/cloudwatch-monitoring.yaml \
  --stack-name pet-image-labeling-monitoring \
  --parameter-overrides \
    SNSStackName=pet-image-labeling-sns \
    LambdaStackName=pet-image-labeling-functions \
    S3StackName=pet-image-labeling-storage \
    DynamoDBStackName=pet-image-labeling-database

# 8. Deploy EC2 Web Server
echo "Deploying EC2 Web Server..."
aws cloudformation deploy \
  --template-file cloudformation/ec2-webapp.yaml \
  --stack-name pet-image-labeling-ec2 \
  --parameter-overrides \
    ApiGatewayStackName=pet-image-labeling-api \
    AuthStackName=pet-image-labeling-auth \
    InstanceType=t3.medium \
  --capabilities CAPABILITY_IAM

# Get outputs
echo "Deployment complete!"
echo "Website URL:"
aws cloudformation describe-stacks --stack-name pet-image-labeling-ec2 --query "Stacks[0].Outputs[?OutputKey=='WebsiteURL'].OutputValue" --output text
echo "CloudWatch Dashboard URL:"
aws cloudformation describe-stacks --stack-name pet-image-labeling-monitoring --query "Stacks[0].Outputs[?OutputKey=='DashboardURL'].OutputValue" --output text
