const dotenv = require('dotenv');
dotenv.config(); // Must run before modules that read env vars at import time.

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const { randomUUID } = require('node:crypto');
const { UPLOAD_TYPES, MAX_UPLOAD_BYTES, validateUpload } = require('./src/shared/security/policies');
const { protect, admin } = require('./middleware/authmiddleware');
const { errorHandler, notFound } = require('./middleware/errormiddleware.js');
const { requestId } = require('./src/shared/http/request-id');
const multer = require('multer');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { loadConfig, resolveOrigins } = require('./src/shared/config');
const { startServer } = require('./src/shared/runtime/start-server');

const productRoutes = require('./routes/productRoute.js');
const userRoutes = require('./routes/userRoute.js');
const cartRoutes = require('./routes/cartRoutes.js');
const orderRoutes = require('./routes/orderRoute.js');
const adminRoutes = require('./routes/adminRoutes.js');
const adminAlertRoutes = require('./routes/adminAlertsRoutes.js');

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, Object.prototype.hasOwnProperty.call(UPLOAD_TYPES, file.mimetype)),
});

const app = express();
app.set('trust proxy', 1);
app.use(requestId); // Applied before CORS and routes so failures can be correlated.

const allowedOrigins = resolveOrigins(process.env);
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS policy: request from origin ${origin} not allowed.`), false);
  },
  credentials: true,
  exposedHeaders: ['X-Request-ID'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(helmet());
app.use(morgan('dev'));
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests. Please try again later.',
  // Apply to every API route. No privileged bypasses.
});
app.use(globalLimiter);

// Authorized uploads: admin only, bounded size/type, unpredictable object key.
app.post('/api/upload', protect, admin, upload.single('file'), async (req, res) => {
  const file = req.file;
  const invalid = validateUpload(file);
  if (invalid) return res.status(400).json({ message: invalid });
  const fileName = `uploads/${randomUUID()}${UPLOAD_TYPES[file.mimetype]}`;

  const params = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: fileName,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  try {
    const command = new PutObjectCommand(params);
    await s3.send(command);
    const url = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
    res.json({ fileUrl: url });
  } catch (error) {
    res.status(500).json({ message: 'File upload failed' });
  }
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ message: 'Upload rejected' });
  }
  return next(err);
});

app.use('/api/products', productRoutes);
app.use('/api/users', userRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin', adminAlertRoutes);

app.use(notFound);
app.use(errorHandler);

async function boot() {
  const config = loadConfig(process.env);
  await startServer({
    config,
    connect: uri => mongoose.connect(uri),
    listen: port => new Promise((resolve, reject) => {
      const server = http.createServer(app);
      server.once('error', reject);
      server.listen(port, () => {
        server.removeListener('error', reject);
        console.log(`Server running on port ${port} (MongoDB connected)`);
        resolve(server);
      });
    }),
  });
}

if (require.main === module && process.env.NODE_ENV !== 'test') {
  boot().catch(error => {
    // Never print secrets or raw connection URIs.
    console.error(`Startup failed: ${error.name || 'Error'}`);
    process.exitCode = 1;
  });
}

module.exports = app;
