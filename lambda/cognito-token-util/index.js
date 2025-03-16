// Utility for extracting information from Cognito JWT tokens
const jwt = require('jsonwebtoken');

/**
 * Extract user information from the Cognito JWT token in the Authorization header
 * @param {Object} event - The API Gateway event object 
 * @returns {Object|null} - The parsed user information or null if not authenticated
 */
const extractUserFromToken = (event) => {
  try {
    // Try to get the Authorization header
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    if (!authHeader) {
      console.log('No Authorization header found');
      return null;
    }

    // Extract the token part
    const match = authHeader.match(/^Bearer (.*)$/);
    if (!match || match.length < 2) {
      console.log('Invalid Authorization header format');
      return null;
    }

    const token = match[1];
    
    // For Cognito tokens, we can decode them to get the payload without verification
    // In production, you would want to verify the token with Cognito's public keys
    const decodedToken = jwt.decode(token);
    
    if (!decodedToken) {
      console.log('Could not decode token');
      return null;
    }
    
    // Extract relevant user information
    const user = {
      sub: decodedToken.sub,
      email: decodedToken.email || decodedToken['cognito:username'],
      name: decodedToken.name || 'Anonymous',
      // Cognito groups are stored in this claim
      groups: decodedToken['cognito:groups'] || []
    };
    
    return user;
  } catch (error) {
    console.error('Error parsing token:', error);
    return null;
  }
};

/**
 * Check if the user is in the specified group
 * @param {Object} user - The user object from extractUserFromToken
 * @param {string} groupName - The group to check for
 * @returns {boolean} - True if the user is in the group
 */
const isUserInGroup = (user, groupName) => {
  if (!user || !user.groups) {
    return false;
  }
  
  return user.groups.includes(groupName);
};

/**
 * Check if the user is an admin
 * @param {Object} user - The user object from extractUserFromToken
 * @returns {boolean} - True if the user is an admin
 */
const isAdmin = (user) => {
  return isUserInGroup(user, 'Admins');
};

/**
 * Check if the user is a labeler
 * @param {Object} user - The user object from extractUserFromToken
 * @returns {boolean} - True if the user is a labeler or admin
 */
const isLabeler = (user) => {
  return isUserInGroup(user, 'Labelers') || isAdmin(user);
};

module.exports = {
  extractUserFromToken,
  isUserInGroup,
  isAdmin,
  isLabeler
};