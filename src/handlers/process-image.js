const AWS = require("aws-sdk");
const Jimp = require("jimp"); // Image processing library
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

      // Fetch user metadata (e.g., Name)
      const userName = extractUserName(imageKey); // Assuming filename includes user info
      const uploadDate = new Date().toISOString().split("T")[0];

      // Get the uploaded image from S3
      const image = await s3
        .getObject({ Bucket: bucket.name, Key: imageKey })
        .promise();
      const jimpImage = await Jimp.read(image.Body);

      // Add watermark
      const font = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
      jimpImage.print(font, 10, 10, `${userName} - ${uploadDate}`);

      // Convert image to Buffer and save in processed bucket
      const processedBuffer = await jimpImage.getBufferAsync(Jimp.MIME_PNG);
      const newImageKey = `processed/${imageKey}`;

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

// Function to extract user's name from file name (Adjust based on actual implementation)
function extractUserName(fileName) {
  return fileName.split("_")[0] || "UnknownUser";
}
