const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const sharp = require('sharp');
const { 
  logEvent, 
  notifyImageProcessed, 
  recordMetrics, 
  notifySystemAlert 
} = require('monitoring-util');

exports.handler = async (event) => {
  try {
    logEvent('FUNCTION_INVOKED', { event: { Records: event.Records.length } });

    // Create clients
    const s3Client = new S3Client({ region: process.env.AWS_REGION });
    const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
    const docClient = DynamoDBDocumentClient.from(ddbClient);
    
    // Get the object from the event
    const bucket = event.Records[0].s3.bucket.name;
    const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
    
    logEvent('PROCESSING_IMAGE', { bucket, key });

    // Get the image
    const getObjectCommand = new GetObjectCommand({ Bucket: bucket, Key: key });
    const imageData = await s3Client.send(getObjectCommand);
    
    // Extract image buffer
    const imageBuffer = await imageData.Body.transformToByteArray();
    
    // Generate thumbnail using Sharp
    // Create a 300px wide thumbnail while maintaining aspect ratio
    const thumbnailBuffer = await sharp(imageBuffer)
      .resize({
        width: 300,
        height: 300,
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 80 })
      .toBuffer();
    
    // Extract metadata for logging purposes
    const metadata = await sharp(imageBuffer).metadata();
    const imageMetadata = {
      format: metadata.format,
      width: metadata.width,
      height: metadata.height,
      size: imageBuffer.length
    };
    logEvent('IMAGE_METADATA', imageMetadata);
    
    // Create processed keys for different versions
    const baseName = key.split('/').pop();
    const folderPath = key.substring(0, key.lastIndexOf('/') + 1);
    const thumbnailKey = `${folderPath}thumbnails/${baseName}`;
    
    // Upload thumbnail to processed bucket
    const putThumbnailCommand = new PutObjectCommand({
      Bucket: process.env.PROCESSED_BUCKET,
      Key: thumbnailKey,
      Body: thumbnailBuffer,
      ContentType: 'image/jpeg'
    });
    
    await s3Client.send(putThumbnailCommand);
    logEvent('THUMBNAIL_CREATED', { bucket: process.env.PROCESSED_BUCKET, key: thumbnailKey });
    
    // Extract the user ID from the object metadata
    let uploadedBy = 'system';
        
    if (imageData.Metadata && imageData.Metadata['user-id']) {
      uploadedBy = imageData.Metadata['user-id'];
    }

    // Create a record in DynamoDB
    const imageId = baseName.split('.')[0];
    const imageRecord = {
      imageId: imageId,
      originalKey: key,
      thumbnailKey: thumbnailKey,
      uploadedAt: new Date().toISOString(),
      uploadedBy: uploadedBy,   // Use the extracted user ID
      labelStatus: 'unlabeled',
      contentType: imageData.ContentType || 'image/jpeg',
      metadata: imageMetadata
    };
    
    const putCommand = new PutCommand({
      TableName: process.env.IMAGES_TABLE,
      Item: imageRecord
    });
    
    await docClient.send(putCommand);
    logEvent('DATABASE_RECORD_CREATED', { imageId, table: process.env.IMAGES_TABLE });
    
    // Send notification and record metrics
    await notifyImageProcessed(imageId, imageMetadata);
    
    // Record image size metrics
    await recordMetrics('ImageSizeKB', Math.round(imageBuffer.length / 1024), [
      { Name: 'Service', Value: 'ImageProcessor' }
    ]);
    
    // Record image processed count
    await recordMetrics('ImagesProcessed', 1, [
      { Name: 'Service', Value: 'ImageProcessor' }
    ]);

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Image processed successfully', 
        imageId: imageId,
        originalSize: `${metadata.width}x${metadata.height}`,
        thumbnailSize: '300px max dimension'
      })
    };
  } catch (error) {
    console.error('Error processing image:', error);
    // Send system alert for critical errors
    await notifySystemAlert('ImageProcessingError', error.message);

    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error processing image', error: error.message })
    };
  }
};
