const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const productRoutes = require('./routes/productRoute.js');
const userRoutes = require('./routes/userRoute.js');
const orderRoutes = require('./routes/orderRoute.js');
const adminRoutes = require('./routes/adminRoutes.js');
const { errorHandler, notFound } = require('./middleware/errormiddleware.js');
const multer = require('multer');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const User = require('./models/user.js');
const Product = require('./models/product.js');
const Order = require('./models/order.js');
const Admin = require('./models/admin.js');
const { protect, admin } = require('./middleware/authmiddleware.js');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

dotenv.config();

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const storage = multer.memoryStorage();
const upload = multer({ storage });

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(helmet());
app.use(morgan('dev'));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
}));

app.post('/api/upload', upload.single('file'), async (req, res) => {
  const file = req.file;
  const fileName = `uploads/${Date.now()}_${file.originalname}`;

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
    res.status(500).json({ message: 'File upload failed', error });
  }
});

app.use('/api/products', productRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', protect, admin, adminRoutes);

app.use(notFound);
app.use(errorHandler);

mongoose.connect(process.env.MONGO_URI).then(() => console.log('MongoDB Connected')).catch(err => console.log(err));

io.on('connection', (socket) => {
    console.log('A user connected');
    socket.on('orderUpdate', (data) => {
      io.emit('orderUpdate', data);
    });
    socket.on('disconnect', () => {
      console.log('User disconnected');
    });
  });
  
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));