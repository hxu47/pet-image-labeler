// get-all-users/index.js 
const { CognitoIdentityProviderClient, ListUsersCommand, AdminListGroupsForUserCommand } = require("@aws-sdk/client-cognito-identity-provider");
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
          'Access-Control-Allow-Credentials': true,
          'Access-Control-Allow-Methods': 'GET,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
        },
        body: JSON.stringify({ message: 'Unauthorized. Admin access required.' })
      };
    }
    
    // Initialize Cognito client
    const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });
    
    // List users in the Cognito user pool
    const params = {
      UserPoolId: process.env.USER_POOL_ID,
      AttributesToGet: ['sub', 'email', 'name', 'custom:role']
    };
    
    const listUsersCommand = new ListUsersCommand(params);
    const usersResponse = await cognitoClient.send(listUsersCommand);
    
    // Map Cognito users to our required format
    const users = await Promise.all(usersResponse.Users.map(async user => {
      const attributes = {};
      user.Attributes.forEach(attr => {
        attributes[attr.Name] = attr.Value;
      });
      
      // Get user groups
      let groups = [];
      try {
        const groupsCommand = new AdminListGroupsForUserCommand({
          UserPoolId: process.env.USER_POOL_ID,
          Username: user.Username
        });
        const groupsResponse = await cognitoClient.send(groupsCommand);
        groups = groupsResponse.Groups.map(g => g.GroupName);
      } catch (err) {
        console.warn(`Could not fetch groups for user ${user.Username}:`, err);
      }
      
      // Determine role based on group membership first, then fallback to custom:role attribute
      let role = 'Viewer'; // Default role if nothing else is specified

      // Check group membership (highest priority)
      if (groups.includes('Admins')) {
        role = 'Admin';
      } else if (groups.includes('Labelers')) {
        role = 'Labeler';
      } else if (groups.includes('Viewers')) {
        role = 'Viewer';
      } else {
        // Fallback to custom:role attribute if no matching group
        role = attributes['custom:role'] || 'Viewer';
      }
      
      return {
        userId: attributes.sub || user.Username,
        username: user.Username,
        email: attributes.email || '',
        name: attributes.name || user.Username,
        role: role,
        status: user.UserStatus,
        enabled: user.Enabled
      };
    }));
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
      },
      body: JSON.stringify(users)
    };
  } catch (error) {
    console.error('Error fetching users:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
      },
      body: JSON.stringify({ error: 'Failed to fetch users', details: error.message })
    };
  }
};