const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const sharp = require('sharp');

exports.handler = async (event) => {
  try {
    // Create clients
    const s3Client = new S3Client({ region: process.env.AWS_REGION });
    const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
    const docClient = DynamoDBDocumentClient.from(ddbClient);
    
    // Get the object from the event
    const bucket = event.Records[0].s3.bucket.name;
    const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
    
    console.log(`Processing new image upload: ${key} from bucket: ${bucket}`);
    
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
    console.log(`Image metadata: ${JSON.stringify({
      format: metadata.format,
      width: metadata.width,
      height: metadata.height,
      size: imageBuffer.length
    })}`);
    
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
    console.log(`Thumbnail created in processed bucket: ${thumbnailKey}`);
    
    // Create a record in DynamoDB
    const imageId = baseName.split('.')[0];
    const putCommand = new PutCommand({
      TableName: process.env.IMAGES_TABLE,
      Item: {
        imageId: imageId,
        originalKey: key,
        thumbnailKey: thumbnailKey,
        uploadedAt: new Date().toISOString(),
        uploadedBy: 'system', // This would be replaced with actual user ID
        labelStatus: 'unlabeled',
        contentType: imageData.ContentType || 'image/jpeg',
        metadata: {
          width: metadata.width,
          height: metadata.height,
          format: metadata.format,
          size: imageBuffer.length
        }
      }
    });
    
    await docClient.send(putCommand);
    
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
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error processing image', error: error.message })
    };
  }
};
