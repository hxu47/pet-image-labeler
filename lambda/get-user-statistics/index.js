const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");

exports.handler = async (event) => {
  try {
    // Get userId from path parameter
    const userId = event.pathParameters.userId;
    
    // Create DynamoDB clients
    const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
    const docClient = DynamoDBDocumentClient.from(ddbClient);
    
    // Count images uploaded by user
    const uploadedImagesParams = {
      TableName: process.env.IMAGES_TABLE,
      IndexName: 'UserImagesIndex',
      KeyConditionExpression: 'uploadedBy = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      },
      Select: 'COUNT'
    };
    
    // Get all labels by this user, but only fetch the imageIds
    const labeledImagesParams = {
      TableName: process.env.LABELS_TABLE,
      IndexName: 'UserLabelsIndex',
      KeyConditionExpression: 'labeledBy = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      },
      ProjectionExpression: 'imageId'
    };
    
    const uploadedResult = await docClient.send(new QueryCommand(uploadedImagesParams));
    
    let labeledImages = 0;
    
    try {
      // Get all labels created by this user
      const labeledResult = await docClient.send(new QueryCommand(labeledImagesParams));
      
      // Extract unique image IDs using a Set
      const uniqueImageIds = new Set();
      if (labeledResult.Items && labeledResult.Items.length > 0) {
        labeledResult.Items.forEach(item => {
          if (item.imageId) {
            uniqueImageIds.add(item.imageId);
          }
        });
      }
      
      // Count unique images
      labeledImages = uniqueImageIds.size;
    } catch (err) {
      console.warn('Error querying labels, setting count to 0:', err);
      labeledImages = 0;
    }
    
    const statistics = {
      imagesUploaded: uploadedResult.Count || 0,
      imagesLabeled: labeledImages
    };
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify(statistics)
    };
  } catch (error) {
    console.error('Error fetching user statistics:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify({ 
        error: 'Failed to fetch user statistics',
        // For emergency, return default data to make UI work
        imagesUploaded: 0,
        imagesLabeled: 0
      })
    };
  }
};