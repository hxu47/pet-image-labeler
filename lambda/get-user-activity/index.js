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
      Limit: 10,
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
      ScanIndexForward: false, // Most recent first
      Limit: 50 // Get more labels to ensure we capture all labels for each image
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
      timestamp: new Date(item.uploadedAt || Date.now()).getTime(),
      sortKey: new Date(item.uploadedAt || Date.now()).getTime() // Explicit sort key
    }));
    
    // Group labels by imageId only
    const labelGroups = {};
    if (labeledResult.Items && labeledResult.Items.length > 0) {
      console.log(`Found ${labeledResult.Items.length} label items`);
      
      labeledResult.Items.forEach(item => {
        const imageId = item.imageId;
        const timestamp = new Date(item.labeledAt || item.createdAt || Date.now()).getTime();
        
        // Extract any filename or part before the first dot
        let displayImageId = imageId;
        if (imageId && imageId.includes('.')) {
          displayImageId = imageId.split('.')[0];
        }
        
        // Truncate long IDs
        if (displayImageId && displayImageId.length > 20) {
          displayImageId = displayImageId.substring(0, 17) + '...';
        }
        
        // If we haven't seen this image before, create a new group
        if (!labelGroups[imageId]) {
          labelGroups[imageId] = {
            imageId: imageId,
            displayImageId: displayImageId,
            labels: [],
            // Use the most recent timestamp for this image
            timestamp: timestamp,
            labelCount: 0
          };
        } else {
          // Update the timestamp if this label has a more recent timestamp
          if (timestamp > labelGroups[imageId].timestamp) {
            labelGroups[imageId].timestamp = timestamp;
          }
        }
        
        // Add the label to the group
        labelGroups[imageId].labelCount += 1;
        
        if (item.labelType && item.labelValue) {
          labelGroups[imageId].labels.push(`${item.labelType}: ${item.labelValue}`);
        }
      });
    }
    
    console.log(`Grouped into ${Object.keys(labelGroups).length} label groups`);
    
    // Transform grouped labels to activity format
    const labelActivities = Object.values(labelGroups).map(group => ({
      type: 'Labeled an image',
      details: `Added ${group.labelCount} ${group.labelCount === 1 ? 'label' : 'labels'} to ${group.displayImageId}`,
      timeAgo: formatTimeAgo(group.timestamp),
      timestamp: group.timestamp,
      sortKey: group.timestamp // Explicit sort key
    }));
    
    console.log(`Created ${labelActivities.length} label activities`);
    
    // Combine and sort activities
    const activities = [...uploadActivities, ...labelActivities];
    
    // Log activity counts
    console.log(`Total activities before sorting: ${activities.length}`);
    console.log(`Upload activities: ${uploadActivities.length}`);
    console.log(`Label activities: ${labelActivities.length}`);
    
    // Sort by timestamp (newest first)
    activities.sort((a, b) => b.sortKey - a.sortKey);
    
    // Take the top 10
    const topActivities = activities.slice(0, 10);
    
    console.log(`Returning ${topActivities.length} activities`);
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify(topActivities)
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