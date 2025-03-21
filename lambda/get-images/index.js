const { S3Client } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");

exports.handler = async (event) => {
    try {
        // At the beginning of your handler function:
        console.log('Full event:', JSON.stringify(event));  // Temporarily log the full event
        console.log('Request context:', JSON.stringify(event.requestContext));  // Log the request context

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
        // After executing the query
        console.log(`Query returned ${result.Items.length} items`);
        console.log('First few items:', JSON.stringify(result.Items.slice(0, 2)));
              
        // Generate presigned URLs for each image
        const imagesWithUrls = await Promise.all(result.Items.map(async (image) => {
          const command = new GetObjectCommand({
            Bucket: process.env.PROCESSED_BUCKET,
            Key: image.thumbnailKey
          });
          
        const thumbnailUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
                
        return {
              ...image,
              thumbnailUrl,
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