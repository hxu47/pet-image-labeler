const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");

exports.handler = async (event) => {
  try {
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
    
    // Count images labeled by user
    const labeledImagesParams = {
      TableName: process.env.LABELS_TABLE,
      IndexName: 'UserLabelsIndex',
      KeyConditionExpression: 'labeledBy = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      },
      Select: 'COUNT'
    };
    
    const uploadedResult = await docClient.send(new QueryCommand(uploadedImagesParams));
    let labeledResult;
    try {
      labeledResult = await docClient.send(new QueryCommand(labeledImagesParams));
    } catch (err) {
      console.warn('Error querying labels, setting count to 0:', err);
      labeledResult = { Count: 0 };
    }
    
    const statistics = {
      imagesUploaded: uploadedResult.Count || 0,
      imagesLabeled: labeledResult.Count || 0
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