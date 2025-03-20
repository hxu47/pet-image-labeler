const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");

exports.handler = async (event) => {
  try {
    const userId = event.pathParameters.userId;
    
    // Create DynamoDB clients
    const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
    const docClient = DynamoDBDocumentClient.from(ddbClient);
    
    // Query for recent uploads
    const uploadsParams = {
      TableName: process.env.IMAGES_TABLE,
      IndexName: 'UserImagesIndex',
      KeyConditionExpression: 'uploadedBy = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      },
      Limit: 5,
      ScanIndexForward: false // Most recent first
    };
    
    // Query for recent labels
    const labelsParams = {
      TableName: process.env.LABELS_TABLE,
      IndexName: 'UserLabelsIndex',
      KeyConditionExpression: 'labeledBy = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      },
      ScanIndexForward: false
    };
    
    const uploadedResult = await docClient.send(new QueryCommand(uploadsParams));
    let labeledResult;
    try {
      labeledResult = await docClient.send(new QueryCommand(labelsParams));
    } catch (err) {
      console.warn('Error querying labels, setting items to empty array:', err);
      labeledResult = { Items: [] };
    }
    
    // Transform uploads to activity format
    const uploadActivities = (uploadedResult.Items || []).map(item => ({
      type: 'Uploaded an image',
      details: item.imageId || 'Image',
      timeAgo: formatTimeAgo(item.uploadedAt || Date.now()),
      timestamp: item.uploadedAt
    }));
    
    // Group labels by imageId and exact timestamp
    const labelGroups = {};
    if (labeledResult.Items) {
      labeledResult.Items.forEach(item => {
        // Create a key using imageId and exact timestamp
        const timestamp = item.createdAt || item.labeledAt || Date.now();
        const key = `${item.imageId}-${timestamp}`;
        
        if (!labelGroups[key]) {
          labelGroups[key] = {
            imageId: item.imageId,
            labels: [],
            timestamp: new Date(timestamp).getTime()
          };
        }
        
        if (item.labelType && item.labelValue) {
          labelGroups[key].labels.push(`${item.labelType}: ${item.labelValue}`);
        }
      });
    }
    
    // Transform grouped labels to activity format
    const labelActivities = Object.values(labelGroups).map(group => ({
      type: 'Labeled an image',
      details: group.labels.length > 0 
        ? `Added ${group.labels.length} ${group.labels.length === 1 ? 'label' : 'labels'} to ${group.imageId.substring(0, 8)}...` 
        : 'Added labels to image',
      timeAgo: formatTimeAgo(group.timestamp),
      timestamp: group.timestamp
    }));
    
    // Combine and sort activities
    const activities = [...uploadActivities, ...labelActivities]
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, 10); // Get top 10 most recent
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify(activities)
    };
  } catch (error) {
    console.error('Error fetching user activity:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify({ error: 'Failed to fetch user activity' })
    };
  }
};

// Helper function to format time ago string
function formatTimeAgo(timestamp) {
  const now = Date.now();
  const seconds = Math.floor((now - new Date(timestamp).getTime()) / 1000);
  
  if (seconds < 60) return 'just now';
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}