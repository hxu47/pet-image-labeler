const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

exports.handler = async (event) => {
  try {
    const s3Client = new S3Client({ region: process.env.AWS_REGION });
    const queryParams = event.queryStringParameters || {};
    const filename = queryParams.filename || `upload-${Date.now()}.jpg`;
    
    // Generate a random unique ID for the image
    const imageId = `img-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    
    // Create the key using the image ID and original filename
    const key = `uploads/${imageId}/${filename}`;
    
    // Create the command for the S3 operation
    const command = new PutObjectCommand({
      Bucket: process.env.RAW_BUCKET,
      Key: key,
      ContentType: 'image/*'
    });
    
    // Generate a presigned URL for uploading the file
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,OPTIONS,PUT,POST',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        uploadUrl: presignedUrl,
        imageId: imageId,
        key: key
      })
    };
  } catch (error) {
    console.error('Error generating upload URL:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,OPTIONS,PUT,POST',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Error generating upload URL',
        error: error.message
      })
    };
  }
};