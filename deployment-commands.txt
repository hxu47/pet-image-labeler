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

# 5. Deploy web interface
aws cloudformation deploy \
  --template-file web-interface.yaml \
  --stack-name pet-image-labeling-web \
  --parameter-overrides S3StorageStackName=pet-image-labeling-storage