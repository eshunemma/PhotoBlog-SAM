const AWS = require("aws-sdk");
const S3 = new AWS.S3();
const BUCKET_NAME = process.env.BUCKET_NAME;

exports.handler = async (event) => {
    try {
        const body = JSON.parse(event.body);
        const { fileName, fileType, fileContent } = body;

        if (!fileName || !fileType || !fileContent) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Missing fileName, fileType, or fileContent" }),
            };
        }

        // Decode base64 file content
        const buffer = Buffer.from(fileContent, "base64");

        const params = {
            Bucket: BUCKET_NAME,
            Key: fileName,
            Body: buffer,
            ContentType: fileType,
            ACL: "public-read", // Make the uploaded image publicly accessible
        };

        await S3.upload(params).promise();

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Upload successful",
                url: `https://${BUCKET_NAME}.s3.amazonaws.com/${fileName}`,
            }),
        };
    } catch (error) {
        console.error("Upload error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Failed to upload image" }),
        };
    }
};
