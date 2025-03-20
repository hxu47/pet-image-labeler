const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand } = require("@aws-sdk/lib-dynamodb");

exports.handler = async (event) => {
  try {
    // Get userId from path parameter
    const userId = event.pathParameters.userId;
    
    // Create DynamoDB clients
    const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
    const docClient = DynamoDBDocumentClient.from(ddbClient);
    
    // Query DynamoDB for user data
    const userParams = {
      TableName: process.env.USERS_TABLE,
      Key: {
        userId: userId
      }
    };
    
    const userResult = await docClient.send(new GetCommand(userParams));
    const userData = userResult.Item || { userId: userId };
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify(userData)
    };
  } catch (error) {
    console.error('Error fetching user data:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify({ error: 'Failed to fetch user data' })
    };
  }
};