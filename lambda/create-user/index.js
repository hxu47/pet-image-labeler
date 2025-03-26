// Lambda function: create-user.js
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { extractUserFromToken } = require('cognito-token-util');

exports.handler = async (event) => {
  try {
    // Extract user information from the token for authorization
    const currentUser = extractUserFromToken(event);
    
    // Parse request body
    const requestBody = JSON.parse(event.body);
    const { userId, name, email, createdAt } = requestBody;
    
    // Basic validation
    if (!userId) {
      return {
        statusCode: 400,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': true,
            'Access-Control-Allow-Methods': 'POST,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
        },
        body: JSON.stringify({ message: 'Missing required field: userId' })
      };
    }
    
    // Create DynamoDB client
    const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
    const docClient = DynamoDBDocumentClient.from(ddbClient);
    
    // Current timestamp if not provided
    const timestamp = createdAt || new Date().toISOString();
    
    // Create user record
    const userItem = {
      userId,
      name: name || 'New User',
      email: email || '',
      createdAt: timestamp,
      lastUpdated: timestamp,
      // Add other default fields as needed
      statistics: {
        imagesUploaded: 0,
        imagesLabeled: 0
      }
    };
    
    // Save to DynamoDB
    const putCommand = new PutCommand({
      TableName: process.env.USERS_TABLE,
      Item: userItem
    });
    
    await docClient.send(putCommand);
    
    return {
      statusCode: 201, // Created
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
      },
      body: JSON.stringify({ 
        message: 'User created successfully',
        user: userItem
      })
    };
  } catch (error) {
    console.error('Error creating user:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
      },
      body: JSON.stringify({ message: 'Error creating user', error: error.message })
    };
  }
};