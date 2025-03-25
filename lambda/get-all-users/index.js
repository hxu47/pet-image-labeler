// lambda/get-all-users/index.js
const { CognitoIdentityServiceProvider } = require("@aws-sdk/client-cognito-identity-provider");
const { extractUserFromToken, isAdmin } = require('cognito-token-util');

exports.handler = async (event) => {
  try {
    // Extract user from Cognito token and verify admin status
    const currentUser = extractUserFromToken(event);
    if (!currentUser || !isAdmin(currentUser)) {
      return {
        statusCode: 403,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true
        },
        body: JSON.stringify({ message: 'Unauthorized. Admin access required.' })
      };
    }
    
    // Initialize Cognito client
    const cognitoClient = new CognitoIdentityServiceProvider({ region: process.env.AWS_REGION });
    
    // List users in the Cognito user pool
    const params = {
      UserPoolId: process.env.USER_POOL_ID,
      AttributesToGet: ['sub', 'email', 'name', 'custom:role']
    };
    
    const usersResponse = await cognitoClient.listUsers(params);
    
    // Map Cognito users to our required format
    const users = usersResponse.Users.map(user => {
      const attributes = {};
      user.Attributes.forEach(attr => {
        attributes[attr.Name] = attr.Value;
      });
      
      return {
        userId: attributes.sub || user.Username,
        username: user.Username,
        email: attributes.email || '',
        name: attributes.name || user.Username,
        role: attributes['custom:role'] || 'Viewer',
        status: user.UserStatus,
        enabled: user.Enabled
      };
    });
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify(users)
    };
  } catch (error) {
    console.error('Error fetching users:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify({ error: 'Failed to fetch users' })
    };
  }
};