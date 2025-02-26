const AWS = require("aws-sdk");
const sharp = require("sharp");
const s3 = new AWS.S3();
const dynamoDB = new AWS.DynamoDB.DocumentClient();

const STAGING_BUCKET = process.env.STAGING_BUCKET;
const PROCESSED_BUCKET = process.env.PROCESSED_BUCKET;
const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE;

exports.handler = async (event) => {
  try {
    for (const record of event.Records) {
      const { bucket, object } = record.s3;
      const imageKey = object.key;

      // Extract user metadata (Assume filename contains user info)
      // const userName = extractUserName(imageKey);
      const userName = imageKey;
      const uploadDate = new Date().toISOString().split("T")[0];

      // Get the uploaded image from S3
      const image = await s3
        .getObject({ Bucket: bucket.name, Key: imageKey })
        .promise();

      // Generate watermark text
      const watermarkText = `${userName} - ${uploadDate}`;

      // Create a watermark overlay
      const watermark = await sharp({
        text: {
          text: watermarkText,
          font: "sans",
          rgba: true,
          width: 500,
          height: 50,
          align: "center",
        },
      })
        .png()
        .toBuffer();

      // Process the image with Sharp (Adding watermark)
      const processedBuffer = await sharp(image.Body)
        .composite([{ input: watermark, gravity: "southeast" }]) // Position watermark
        .toFormat("png")
        .toBuffer();

      // Define the new processed image key
      const newImageKey = `processed/${imageKey}`;

      // Upload processed image to Primary S3 bucket
      await s3
        .putObject({
          Bucket: PROCESSED_BUCKET,
          Key: newImageKey,
          Body: processedBuffer,
          ContentType: "image/png",
        })
        .promise();

      // Save metadata in DynamoDB
      await dynamoDB
        .put({
          TableName: DYNAMODB_TABLE,
          Item: {
            imageId: imageKey,
            userName: userName,
            processedUrl: `https://${PROCESSED_BUCKET}.s3.amazonaws.com/${newImageKey}`,
            uploadDate: uploadDate,
          },
        })
        .promise();

      // Delete original image from Staging bucket
      await s3
        .deleteObject({ Bucket: STAGING_BUCKET, Key: imageKey })
        .promise();

      console.log(`Successfully processed ${imageKey}`);
    }
  } catch (error) {
    console.error("Error processing image:", error);
    throw error;
  }
};

// Extract user's name from filename (Adjust logic based on actual naming convention)
function extractUserName(fileName) {
  return fileName.split("_")[0] || "UnknownUser";
}
