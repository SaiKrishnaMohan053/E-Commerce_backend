const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const generateUniqueFileName = (originalName) => {
  const ext = path.extname(originalName);
  const baseName = crypto.randomBytes(16).toString('hex');
  return `${baseName}${ext}`;
};

const validateFile = (file) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!allowedTypes.includes(file.mimetype)) {
    throw new Error('Invalid file type. Allowed: JPEG, PNG, PDF');
  }
  if (file.size > maxSize) {
    throw new Error('File too large. Max size is 5MB');
  }
};

const uploadToS3 = async (file, folder) => {
  try {
    validateFile(file);

    const uniqueFileName = generateUniqueFileName(file.originalname);
    const key = `${folder}/${uniqueFileName}`;

    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    };

    const command = new PutObjectCommand(params);
    const response = await s3.send(command);

    return {
      url: `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
      key,
      etag: response.ETag || null,
    };
  } catch (err) {
    console.error('S3 Upload Error:', err);
    throw err;
  }
};

const deleteFromS3 = async (key) => {
  try {
    if (!key || typeof key !== 'string') {
      throw new Error('Invalid S3 file key');
    }

    const command = new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: key,
    });

    await s3.send(command);
    console.log(`Deleted file from S3: ${key}`);
  } catch (error) {
    console.error('Error deleting file from S3:', error);
    throw error;
  }
};

module.exports = { uploadToS3, deleteFromS3 };