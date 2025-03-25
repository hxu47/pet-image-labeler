// Lambda function: get-images
const { S3Client } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");

exports.handler = async (event) => {
    try {
        
        // Create clients
        const s3Client = new S3Client({ region: process.env.AWS_REGION });
        const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
        const docClient = DynamoDBDocumentClient.from(ddbClient);
              
        // Try different paths to find user information
        let currentUser = null;
        if (event.requestContext?.authorizer?.lambda) {
          currentUser = event.requestContext.authorizer.lambda;
        } else if (event.requestContext?.authorizer?.claims) {
          // Cognito authorizer puts user info in claims
          currentUser = {
            sub: event.requestContext.authorizer.claims.sub,
            username: event.requestContext.authorizer.claims['cognito:username'],
            email: event.requestContext.authorizer.claims.email
          };
        }
        console.log('Extracted user:', currentUser);
              
        // Parse query parameters
        const queryParams = event.queryStringParameters || {};
        const labelStatus = queryParams.status || 'unlabeled';
        const limit = parseInt(queryParams.limit) || 10;
        const userId = queryParams.userId;  // Get userId from query parameters if present

        // Query DynamoDB for images with the specified label status
        let queryCommand;
        if (userId) {
          // If userId is provided, query by user AND label status
          queryCommand = new QueryCommand({
            TableName: process.env.IMAGES_TABLE,
            IndexName: 'UserImagesIndex',
            KeyConditionExpression: 'uploadedBy = :userId',
            FilterExpression: 'labelStatus = :status',
            ExpressionAttributeValues: {
              ':userId': userId,
              ':status': labelStatus
            },
            Limit: limit
          });
        } else {
          // Otherwise, query by label status
          queryCommand = new QueryCommand({
            TableName: process.env.IMAGES_TABLE,
            IndexName: 'LabelStatusIndex',
            KeyConditionExpression: 'labelStatus = :status',
            ExpressionAttributeValues: {
              ':status': labelStatus
            },
            Limit: limit
          });
        }

        const result = await docClient.send(queryCommand);
         
        // Generate presigned URLs for each image
        const imagesWithUrls = await Promise.all(result.Items.map(async (image) => {
          const command = new GetObjectCommand({
            Bucket: process.env.PROCESSED_BUCKET,
            Key: image.thumbnailKey
          });
          
        const thumbnailUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
                
        // Create original image URL
        const originalCommand = new GetObjectCommand({
          Bucket: process.env.RAW_BUCKET,
          Key: image.originalKey
        });

        const originalUrl = await getSignedUrl(s3Client, originalCommand, { expiresIn: 3600 });
                
        return {
              ...image,
              thumbnailUrl,
              originalUrl,
              uploadedBy: image.uploadedBy || 'unknown',
              uploadedByName: image.uploadedByName || 'Unknown User'
            };
        }));
              
        return {
            statusCode: 200,
            headers: {
              'Access-Control-Allow-Origin': '*', // Adjust for production
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(imagesWithUrls)
          };
        } catch (error) {
          console.error('Error getting images:', error);
          return {
            statusCode: 500,
            headers: {
              'Access-Control-Allow-Origin': '*', // Adjust for production
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message: 'Error retrieving images', error: error.message })
          };
        }
};