// Lambda function: update-user-role
const { 
  CognitoIdentityProviderClient, 
  ListUsersCommand, 
  AdminUpdateUserAttributesCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand
} = require("@aws-sdk/client-cognito-identity-provider");
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
          'Access-Control-Allow-Methods': 'POST,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
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
          'Access-Control-Allow-Credentials': true,
          'Access-Control-Allow-Methods': 'POST,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
        },
        body: JSON.stringify({ message: 'Invalid role. Must be Admin, Labeler, or Viewer.' })
      };
    }
    
    // Initialize Cognito client
    const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });
    
    // First, find the user by sub (userId)
    const listUsersParams = {
      UserPoolId: process.env.USER_POOL_ID,
      Filter: `sub = "${targetUserId}"`,
      Limit: 1
    };
    
    const listUsersCommand = new ListUsersCommand(listUsersParams);
    const usersResponse = await cognitoClient.send(listUsersCommand);
    
    if (!usersResponse.Users || usersResponse.Users.length === 0) {
      return {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
          'Access-Control-Allow-Methods': 'POST,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
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
    
    const updateCommand = new AdminUpdateUserAttributesCommand(updateParams);
    await cognitoClient.send(updateCommand);
    
    // Update Cognito group membership based on new role
    const currentGroups = ['Admins', 'Labelers', 'Viewers'];
    
    // Remove from all groups first
    for (const group of currentGroups) {
      try {
        const removeCommand = new AdminRemoveUserFromGroupCommand({
          UserPoolId: process.env.USER_POOL_ID,
          Username: cognitoUsername,
          GroupName: group
        });
        await cognitoClient.send(removeCommand);
      } catch (err) {
        // Ignore errors about user not being in group
        console.log(`User ${cognitoUsername} might not be in group ${group}`);
      }
    }
    
    // Add to appropriate group based on role
    let targetGroup = 'Viewers'; // default
    if (role === 'Admin') targetGroup = 'Admins';
    else if (role === 'Labeler') targetGroup = 'Labelers';
    
    const addGroupCommand = new AdminAddUserToGroupCommand({
      UserPoolId: process.env.USER_POOL_ID,
      Username: cognitoUsername,
      GroupName: targetGroup
    });
    await cognitoClient.send(addGroupCommand);
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
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
        'Access-Control-Allow-Credentials': true,
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
      },
      body: JSON.stringify({ error: 'Failed to update user role', details: error.message })
    };
  }
};