const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { extractUserFromToken, isLabeler } = require('cognito-token-util');
const { 
  logEvent, 
  notifyLabelsSubmitted, 
  recordMetrics, 
  notifySystemAlert 
} = require('./utils');

exports.handler = async (event) => {
  try {
    logEvent('FUNCTION_INVOKED', { path: event.path });

    // Create clients
    const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
    const docClient = DynamoDBDocumentClient.from(ddbClient);
    
    // Extract user from Cognito token
    const currentUser = extractUserFromToken(event);
    logEvent('USER_AUTHENTICATED', { 
      userId: currentUser?.sub,
      username: currentUser?.name
    });
    
    // Parse request body
    const requestBody = JSON.parse(event.body);
    const { imageId, labels } = requestBody;
    
    if (!imageId || !labels || !Array.isArray(labels)) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: 'Invalid request parameters' })
      };
    }
    
    // Get user ID from authenticated user or default
    const labeledBy = currentUser?.sub || 'anonymous';
    const userName = currentUser?.name || 'Anonymous User';
    
    // Check if user is authorized to label (must be in Labelers or Admins group)
    const canLabel = currentUser ? isLabeler(currentUser) : false;
    
    if (!canLabel) {
      logEvent('AUTHORIZATION_FAILED', { userId: labeledBy, action: 'label_images' });
      return {
        statusCode: 403,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: 'You are not authorized to label images' })
      };
    }
    
    // Insert each label into the Labels table
    const labelPromises = labels.map(label => {
      const labelId = new Date().getTime().toString() + '-' + Math.random().toString(36).substring(2, 9);
      const putCommand = new PutCommand({
        TableName: process.env.LABELS_TABLE,
        Item: {
          imageId,
          labelId,
          labelType: label.type,
          labelValue: label.value,
          confidence: label.confidence || 1.0,
          labeledBy,
          labeledByName: userName,
          labeledAt: new Date().toISOString()
        }
      });
      return docClient.send(putCommand);
    });
    
    await Promise.all(labelPromises);
    logEvent('LABELS_SAVED', { imageId, labelCount: labels.length });

    // Update image status to 'labeled'
    const updateCommand = new UpdateCommand({
      TableName: process.env.IMAGES_TABLE,
      Key: { imageId },
      UpdateExpression: 'SET labelStatus = :status, lastLabeledAt = :time, lastLabeledBy = :user, lastLabeledByName = :userName',
      ExpressionAttributeValues: {
        ':status': 'labeled',
        ':time': new Date().toISOString(),
        ':user': labeledBy,
        ':userName': userName
      }
    });
    
    await docClient.send(updateCommand);
    logEvent('IMAGE_STATUS_UPDATED', { imageId, status: 'labeled' });

    // Send notification
    await notifyLabelsSubmitted(imageId, labels, labeledBy);
    
    // Record metrics
    await recordMetrics('LabelsSubmitted', labels.length, [
      { Name: 'Service', Value: 'LabelProcessor' }
    ]);

    // Record labels per type metrics
    const labelTypes = [...new Set(labels.map(label => label.type))];
    for (const type of labelTypes) {
      const count = labels.filter(label => label.type === type).length;
      await recordMetrics(`LabelType_${type}`, count, [
        { Name: 'Service', Value: 'LabelProcessor' }
      ]);
    }
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: 'Labels submitted successfully' })
    };
  } catch (error) {
    console.error('Error processing labels:', error);
    await notifySystemAlert('LabelProcessingError', error.message);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: 'Error submitting labels', error: error.message })
    };
  }
};