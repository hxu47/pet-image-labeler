const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");

exports.handler = async (event) => {
  try {
    // Create clients
    const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
    const docClient = DynamoDBDocumentClient.from(ddbClient);
    
    console.log("Starting dashboard metrics generation");
    
    // Get total counts from Images table
    const imagesCountCommand = new ScanCommand({
      TableName: process.env.IMAGES_TABLE,
      Select: 'COUNT'
    });
    
    const imagesResult = await docClient.send(imagesCountCommand);
    const totalImages = imagesResult.Count;
    console.log(`Total images: ${totalImages}`);
    
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
    console.log(`Labeled images: ${labeledImages}, Unlabeled images: ${unlabeledImages}`);
    
    // Get label type distribution
    const labelsCommand = new ScanCommand({
      TableName: process.env.LABELS_TABLE,
      ProjectionExpression: 'labelType, labelValue'
    });
    
    const labelsResult = await docClient.send(labelsCommand);
    console.log(`Retrieved ${labelsResult.Items.length} label records`);
    
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
    
    // ========= SYSTEM ACTIVITY SECTION =========
    console.log("Fetching system activity data");
    
    // Get recent uploads (last 20)
    const recentUploadsCommand = new ScanCommand({
      TableName: process.env.IMAGES_TABLE,
      Limit: 20,
      ScanIndexForward: false
    });
    
    const recentUploadsResult = await docClient.send(recentUploadsCommand);
    console.log(`Retrieved ${recentUploadsResult.Items.length} recent uploads`);
    
    // Process uploads into activity format
    const activities = [];
    
    recentUploadsResult.Items.forEach(item => {
      if (item.uploadedAt) {
        // Format the image ID for display
        let displayImageId = item.imageId || 'Unknown';
        if (displayImageId.length > 20) {
          displayImageId = displayImageId.substring(0, 17) + '...';
        }
        
        activities.push({
          type: 'upload',
          description: `${item.uploadedByName || 'User'} uploaded an image`,
          details: displayImageId,
          imageId: item.imageId,
          userId: item.uploadedBy,
          userName: item.uploadedByName || 'Anonymous',
          timestamp: new Date(item.uploadedAt).getTime(),
          timeAgo: formatTimeAgo(item.uploadedAt)
        });
      }
    });
    
    // Get recent label submissions (last 30)
    const recentLabelsCommand = new QueryCommand({
      TableName: process.env.LABELS_TABLE,
      IndexName: 'RecentLabelsIndex',
      KeyConditionExpression: 'dataType = :type',
      ExpressionAttributeValues: {
        ':type': 'label'
      },
      Limit: 30,
      ScanIndexForward: false  // false means descending order (newest first)
    });
    
    const recentLabelsResult = await docClient.send(recentLabelsCommand);
    console.log(`Retrieved ${recentLabelsResult.Items.length} recent label submissions`);
    
    // Group labels by imageId, labeledBy, and timestamp (date only, ignoring time)
    const labelGroups = {};
    
    recentLabelsResult.Items.forEach(item => {
      if (item.labeledAt && item.imageId) {
        // Create a key using imageId and user
        const key = `${item.imageId}-${item.labeledBy}`;
        
        // Format the image ID for display
        let displayImageId = item.imageId || 'Unknown';
        if (displayImageId.length > 20) {
          displayImageId = displayImageId.substring(0, 17) + '...';
        }
        
        if (!labelGroups[key]) {
          labelGroups[key] = {
            type: 'label',
            description: `${item.labeledByName || 'User'} labeled an image`,
            details: displayImageId,
            imageId: item.imageId,
            userId: item.labeledBy,
            userName: item.labeledByName || 'Anonymous',
            timestamp: new Date(item.labeledAt).getTime(),
            timeAgo: formatTimeAgo(item.labeledAt),
            labelCount: 0
          };
        }
        
        // Update timestamp if this entry is more recent
        const timestamp = new Date(item.labeledAt).getTime();
        if (timestamp > labelGroups[key].timestamp) {
          labelGroups[key].timestamp = timestamp;
          labelGroups[key].timeAgo = formatTimeAgo(item.labeledAt);
        }
        
        labelGroups[key].labelCount += 1;
      }
    });
    
    // Update label descriptions with count and add to activities
    Object.values(labelGroups).forEach(group => {
      group.description = `${group.userName} added ${group.labelCount} ${group.labelCount === 1 ? 'label' : 'labels'} to an image`;
      activities.push(group);
    });
    
    // Sort by timestamp (newest first) and take the top 10
    console.log(`Total combined activities: ${activities.length}`);
    const recentActivity = activities
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);
    
    console.log(`Returning ${recentActivity.length} recent activities`);
    
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