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
              
        // Extract user info from context if available
        const currentUser = event.requestContext?.authorizer?.lambda;
        console.log('Current user:', currentUser);
              
        // Parse query parameters
        const queryParams = event.queryStringParameters || {};
        const labelStatus = queryParams.status || 'unlabeled';
        const limit = parseInt(queryParams.limit) || 10;
              
        // Query DynamoDB for images with the specified label status
        const queryCommand = new QueryCommand({
          TableName: process.env.IMAGES_TABLE,
          IndexName: 'LabelStatusIndex',
          KeyConditionExpression: 'labelStatus = :status',
          ExpressionAttributeValues: {
            ':status': labelStatus
          },
          Limit: limit
        });
              
        const result = await docClient.send(queryCommand);
        
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