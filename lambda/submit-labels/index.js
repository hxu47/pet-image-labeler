const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");
const { extractUserFromToken, isLabeler } = require('./cognito-token-util');

exports.handler = async (event) => {
  try {
    // Create clients
    const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
    const docClient = DynamoDBDocumentClient.from(ddbClient);
    const snsClient = new SNSClient({ region: process.env.AWS_REGION });
    
    // Extract user from Cognito token
    const currentUser = extractUserFromToken(event);
    console.log('Current user:', currentUser);
    
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
    
    // Send SNS notification about the labeling event
    if (process.env.LABEL_SUBMISSION_TOPIC_ARN) {
      try {
        await snsClient.send(new PublishCommand({
          TopicArn: process.env.LABEL_SUBMISSION_TOPIC_ARN,
          Subject: 'New Image Labels Submitted',
          Message: JSON.stringify({
            imageId,
            labelCount: labels.length,
            labeledBy: userName,
            timestamp: new Date().toISOString()
          }),
          MessageAttributes: {
            'event_type': {
              DataType: 'String',
              StringValue: 'label_submission'
            },
            'user_id': {
              DataType: 'String',
              StringValue: labeledBy
            }
          }
        }));
        console.log('SNS notification sent successfully');
      } catch (snsError) {
        console.error('Error sending SNS notification:', snsError);
        // Continue processing even if SNS notification fails
      }
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
    console.error('Error submitting labels:', error);
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