# 1. Deploy DynamoDB tables
aws cloudformation deploy \
  --template-file dynamodb-tables.yaml \
  --stack-name pet-image-labeling-database

# 2. Deploy Lambda functions
aws cloudformation deploy \
  --template-file lambda-functions.yaml \
  --stack-name pet-image-labeling-functions \
  --parameter-overrides DynamoDBStackName=pet-image-labeling-database

# 3. Deploy S3 storage with reference to Lambda
aws cloudformation deploy \
  --template-file s3-storage.yaml \
  --stack-name pet-image-labeling-storage \
  --parameter-overrides LambdaStackName=pet-image-labeling-functions

# 4. Deploy API Gateway
aws cloudformation deploy \
  --template-file api-gateway.yaml \
  --stack-name pet-image-labeling-api \
  --parameter-overrides LambdaStackName=pet-image-labeling-functions

# After deploying API Gateway, get the endpoint URL
API_URL=$(aws cloudformation describe-stacks --stack-name pet-image-labeling-api --query "Stacks[0].Outputs[?OutputKey=='ApiURL'].OutputValue" --output text)

# Update config.js with the API URL
echo "export const config = { apiUrl: '$API_URL' };" > PET-IMAGE-LABELING-WEBAPP/src/config.js


# 5. Deploy web interface
aws cloudformation deploy \
  --template-file web-interface.yaml \
  --stack-name pet-image-labeling-web \
  --parameter-overrides S3StorageStackName=pet-image-labeling-storage \
  --capabilities CAPABILITY_IAM

# Get the ECR repository URI
ECR_REPO=$(aws cloudformation describe-stacks --stack-name pet-image-labeling-web --query "Stacks[0].Outputs[?OutputKey=='ECRRepositoryURI'].OutputValue" --output text)

# Build and push the Docker image
cd PET-IMAGE-LABELING-WEBAPP
docker build -t $ECR_REPO:latest .
docker push $ECR_REPO:latest

# Update the ECS service to use the new image and set desired count to 1
aws ecs update-service --cluster pet-image-labeling-web-Cluster --service pet-image-labeling-web-service --desired-count 1