// lambda/update-user-role/index.js
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
    
    // Get targetUserId from path parameter
    const targetUserId = event.pathParameters.userId;
    
    // Get new role from request body
    const requestBody = JSON.parse(event.body);
    const { role } = requestBody;
    
    // Validate role
    const validRoles = ['Admin', 'Labeler', 'Viewer'];
    if (!validRoles.includes(role)) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true
        },
        body: JSON.stringify({ message: 'Invalid role. Must be Admin, Labeler, or Viewer.' })
      };
    }
    
    // Initialize Cognito client
    const cognitoClient = new CognitoIdentityServiceProvider({ region: process.env.AWS_REGION });
    
    // First, find the user by sub (userId)
    const listUsersParams = {
      UserPoolId: process.env.USER_POOL_ID,
      Filter: `sub = "${targetUserId}"`,
      Limit: 1
    };
    
    const usersResponse = await cognitoClient.listUsers(listUsersParams);
    
    if (!usersResponse.Users || usersResponse.Users.length === 0) {
      return {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true
        },
        body: JSON.stringify({ message: 'User not found' })
      };
    }
    
    const cognitoUsername = usersResponse.Users[0].Username;
    
    // Update user attributes (custom:role)
    const updateParams = {
      UserPoolId: process.env.USER_POOL_ID,
      Username: cognitoUsername,
      UserAttributes: [
        {
          Name: 'custom:role',
          Value: role
        }
      ]
    };
    
    await cognitoClient.adminUpdateUserAttributes(updateParams);
    
    // Update Cognito group membership based on new role
    const currentGroups = ['Admins', 'Labelers', 'Viewers'];
    
    // Remove from all groups first
    for (const group of currentGroups) {
      try {
        await cognitoClient.adminRemoveUserFromGroup({
          UserPoolId: process.env.USER_POOL_ID,
          Username: cognitoUsername,
          GroupName: group
        });
      } catch (err) {
        // Ignore errors about user not being in group
        console.log(`User ${cognitoUsername} might not be in group ${group}`);
      }
    }
    
    // Add to appropriate group based on role
    let targetGroup = 'Viewers'; // default
    if (role === 'Admin') targetGroup = 'Admins';
    else if (role === 'Labeler') targetGroup = 'Labelers';
    
    await cognitoClient.adminAddUserToGroup({
      UserPoolId: process.env.USER_POOL_ID,
      Username: cognitoUsername,
      GroupName: targetGroup
    });
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify({ 
        message: 'User role updated successfully',
        userId: targetUserId,
        role: role
      })
    };
  } catch (error) {
    console.error('Error updating user role:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify({ error: 'Failed to update user role' })
    };
  }
};