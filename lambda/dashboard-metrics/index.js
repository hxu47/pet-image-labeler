const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");

exports.handler = async (event) => {
  try {
    // Create clients
    const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
    const docClient = DynamoDBDocumentClient.from(ddbClient);
    
    // Get total counts from Images table
    const imagesCountCommand = new ScanCommand({
      TableName: process.env.IMAGES_TABLE,
      Select: 'COUNT'
    });
    
    const imagesResult = await docClient.send(imagesCountCommand);
    const totalImages = imagesResult.Count;
    
    // Get counts by label status
    const labeledImagesCommand = new ScanCommand({
      TableName: process.env.IMAGES_TABLE,
      FilterExpression: 'labelStatus = :status',
      ExpressionAttributeValues: {
        ':status': 'labeled'
      },
      Select: 'COUNT'
    });
    
    const labeledImagesResult = await docClient.send(labeledImagesCommand);
    const labeledImages = labeledImagesResult.Count;
    const unlabeledImages = totalImages - labeledImages;
    
    // Get label type distribution
    const labelsCommand = new ScanCommand({
      TableName: process.env.LABELS_TABLE,
      ProjectionExpression: 'labelType, labelValue'
    });
    
    const labelsResult = await docClient.send(labelsCommand);
    
    // Calculate label type distribution
    const labelTypeDistribution = {};
    labelsResult.Items.forEach(item => {
      if (!labelTypeDistribution[item.labelType]) {
        labelTypeDistribution[item.labelType] = {
          total: 0,
          values: {}
        };
      }
      
      labelTypeDistribution[item.labelType].total += 1;
      
      if (!labelTypeDistribution[item.labelType].values[item.labelValue]) {
        labelTypeDistribution[item.labelType].values[item.labelValue] = 0;
      }
      
      labelTypeDistribution[item.labelType].values[item.labelValue] += 1;
    });
    
    // Get recent system activity (from both users and images tables)
    // First, get recent uploads
    const recentUploadsCommand = new ScanCommand({
      TableName: process.env.IMAGES_TABLE,
      ProjectionExpression: 'imageId, uploadedAt, uploadedBy, uploadedByName',
      Limit: 20,
    });
    
    const recentUploadsResult = await docClient.send(recentUploadsCommand);
    
    // Get recent label submissions
    const recentLabelsCommand = new ScanCommand({
      TableName: process.env.LABELS_TABLE,
      ProjectionExpression: 'imageId, labeledAt, labeledBy, labeledByName, labelType, labelValue',
      Limit: 20,
    });
    
    const recentLabelsResult = await docClient.send(recentLabelsCommand);
    
    // Combine uploads and labels into a single activity stream
    const activities = [];
    
    // Process uploads
    recentUploadsResult.Items.forEach(item => {
      if (item.uploadedAt) {
        activities.push({
          type: 'upload',
          description: `${item.uploadedByName || 'User'} uploaded an image`,
          imageId: item.imageId,
          userId: item.uploadedBy,
          userName: item.uploadedByName || 'User',
          timestamp: new Date(item.uploadedAt).getTime(),
          timeAgo: formatTimeAgo(item.uploadedAt)
        });
      }
    });
    
    // Process labels - use a map to group by imageId and exact timestamp
    const labelGroups = {};
    
    recentLabelsResult.Items.forEach(item => {
      if (item.labeledAt) {
        const key = `${item.imageId}-${item.labeledAt}-${item.labeledBy}`;
        
        if (!labelGroups[key]) {
          labelGroups[key] = {
            type: 'label',
            description: `${item.labeledByName || 'User'} labeled an image`,
            imageId: item.imageId,
            userId: item.labeledBy,
            userName: item.labeledByName || 'User',
            timestamp: new Date(item.labeledAt).getTime(),
            timeAgo: formatTimeAgo(item.labeledAt),
            labelCount: 0
          };
        }
        
        labelGroups[key].labelCount += 1;
      }
    });
    
    // Add the grouped label activities
    Object.values(labelGroups).forEach(group => {
      // Update description with label count
      group.description = `${group.userName} added ${group.labelCount} ${group.labelCount === 1 ? 'label' : 'labels'} to an image`;
      activities.push(group);
    });
    
    // Sort by timestamp (newest first) and take the top 10
    const recentActivity = activities
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);
    
    // Prepare dashboard metrics
    const metrics = {
      totalImages,
      labeledImages,
      unlabeledImages,
      completionPercentage: totalImages > 0 ? (labeledImages / totalImages * 100).toFixed(2) : 0,
      labelTypeDistribution,
      recentActivity
    };
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(metrics)
    };
  } catch (error) {
    console.error('Error generating dashboard metrics:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: 'Error generating metrics', error: error.message })
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