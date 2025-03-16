const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");

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
    
    // Prepare dashboard metrics
    const metrics = {
      totalImages,
      labeledImages,
      unlabeledImages,
      completionPercentage: totalImages > 0 ? (labeledImages / totalImages * 100).toFixed(2) : 0,
      labelTypeDistribution
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