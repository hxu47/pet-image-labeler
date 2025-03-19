const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");
const { CloudWatchClient, PutMetricDataCommand } = require("@aws-sdk/client-cloudwatch");

// Initialize the clients
const snsClient = new SNSClient({ region: process.env.AWS_REGION });
const cloudWatchClient = new CloudWatchClient({ region: process.env.AWS_REGION });

// Helper function for structured logging
function logEvent(eventType, data) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    eventType,
    lambdaFunction: process.env.AWS_LAMBDA_FUNCTION_NAME,
    data
  };
  
  console.log(JSON.stringify(logEntry));
}

// Function to publish notifications to SNS
async function notifyImageProcessed(imageId, metadata) {
  try {
    // Prepare the SNS message
    const message = {
      imageId: imageId,
      metadata: metadata,
      processedAt: new Date().toISOString()
    };

    // Create the SNS publish command
    const publishCommand = new PublishCommand({
      TopicArn: process.env.IMAGE_UPLOAD_TOPIC_ARN,
      Message: JSON.stringify(message),
      MessageAttributes: {
        'imageId': {
          DataType: 'String',
          StringValue: imageId
        }
      }
    });
    
    // Send the SNS notification
    await snsClient.send(publishCommand);
    logEvent('SNS_NOTIFICATION_SENT', { imageId, topic: 'ImageUploads' });
  } catch (error) {
    console.error('Error publishing to SNS:', error);
    // Continue processing even if notification fails
  }
}

// Function to publish label submission notifications
async function notifyLabelsSubmitted(imageId, labels, userId) {
  try {
    // Prepare the SNS message
    const message = {
      imageId: imageId,
      labels: labels,
      labeledBy: userId,
      labeledAt: new Date().toISOString()
    };

    // Create the SNS publish command
    const publishCommand = new PublishCommand({
      TopicArn: process.env.LABEL_SUBMISSION_TOPIC_ARN,
      Message: JSON.stringify(message),
      MessageAttributes: {
        'imageId': {
          DataType: 'String',
          StringValue: imageId
        }
      }
    });
    
    // Send the SNS notification
    await snsClient.send(publishCommand);
    logEvent('SNS_NOTIFICATION_SENT', { imageId, topic: 'LabelSubmissions' });
  } catch (error) {
    console.error('Error publishing to SNS:', error);
    // Continue processing even if notification fails
  }
}

// Function to record CloudWatch metrics
async function recordMetrics(metricName, value = 1, dimensions = [{ Name: 'Service', Value: 'PetLabeling' }]) {
  try {
    // Create the CloudWatch metric command
    const metricCommand = new PutMetricDataCommand({
      Namespace: 'PetImageLabeling',
      MetricData: [
        {
          MetricName: metricName,
          Value: value,
          Unit: 'Count',
          Dimensions: dimensions
        }
      ]
    });
    
    // Send the CloudWatch metrics
    await cloudWatchClient.send(metricCommand);
    logEvent('CLOUDWATCH_METRICS_RECORDED', { metricName, value, dimensions });
  } catch (error) {
    console.error(`Error recording CloudWatch metric ${metricName}:`, error);
    // Continue processing even if metrics recording fails
  }
}

// Function to notify about system alerts
async function notifySystemAlert(errorType, errorDetails, severity = 'HIGH') {
  try {
    // Prepare the SNS message
    const message = {
      errorType,
      errorDetails,
      severity,
      timestamp: new Date().toISOString(),
      service: process.env.AWS_LAMBDA_FUNCTION_NAME
    };

    // Create the SNS publish command
    const publishCommand = new PublishCommand({
      TopicArn: process.env.SYSTEM_ALERTS_TOPIC_ARN,
      Message: JSON.stringify(message),
      Subject: `[${severity}] Error in ${process.env.AWS_LAMBDA_FUNCTION_NAME}`,
      MessageAttributes: {
        'severity': {
          DataType: 'String',
          StringValue: severity
        }
      }
    });
    
    // Send the system alert
    await snsClient.send(publishCommand);
    logEvent('SYSTEM_ALERT_SENT', { errorType, severity });
  } catch (error) {
    console.error('Error publishing system alert:', error);
  }
}

module.exports = {
  logEvent,
  notifyImageProcessed,
  notifyLabelsSubmitted,
  recordMetrics,
  notifySystemAlert
};