# E-Commerce Backend

This is the backend e-commerce application built for warehouse-based product ordering. It provides RESTful API endpoints for user authentication, admin management, and full product/order functionalities including flavored product handling, deal management, and S3-based image uploads.

---

## Features

### Authentication & User Management
- **JWT Authentication** with secure login & protected routes
- **User Registration with Document Upload** via AWS S3
- **Admin Approval Workflow** for new users with email notifications
- **Password Recovery** through email with token expiry
- **Profile Management** endpoints

### Product Management (Admin)
- **Create / Read / Update / Delete Products**
  - Supports products with or without flavor variants
  - Optional deal & purchase limit settings
- **Flavored Product Support**: individual stock, price, sold count per flavor
- **Stock Management**: update stock by flavor or overall
- **Deal Management**: `percent` and `fixed` discounts
- **Image Handling**: upload & delete via AWS S3

### Product Retrieval & Filtering
- **Get All Products** with pagination, sorting, and filtering
- **Filters**: category, subCategory, name search, price range, deals
- **Sorting**: price, newest, popularity (sold count), name (A→Z)
- **Get Product by ID**

### Cart Management
- **Add / Update / Remove Cart Items**
- **Clear Cart**
- **One-to-One Cart per User** with flavored item support

### Order Management
- **Place Order** with quantity clamping to available stock
  - Returns an `adjustments` array for any items clamped
- **Order Cancellation** reverses stock and sold counts
- **Fetch My Orders** endpoint with pagination and sorting
- **Fetch Order by ID** for order details
- **Admin Order Actions**: update status, upload invoice, cancel order

---

## Core Logic Overview

### Flavored Products
- Per-flavor pricing and stock stored in product documents

### Stock & Sold Count Tracking
- **Clamping**: automatically adjust order quantities to current stock
- **Backfill**: cancelling an order restores stock and sold counts

### Deals & Discounts
- Flags and fields to support `percent` or `fixed` deals

### Image Handling
- `multer.memoryStorage()` for uploads
- `uploadToS3()` / `deleteFromS3()` utilities

### Pagination
- Endpoints accept `page` & `limit` query params
- Responses include `page`, `totalPages`, and `totalItems`

---

## Tech Stack

- **Node.js & Express.js** for server
- **MongoDB & Mongoose** for database
- **AWS S3** for file storage
- **JWT & Middleware** for auth and roles
- **Nodemailer** for emails

---

## Environment Variables

```env
PORT=5000
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_secret
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_S3_BUCKET=your_bucket_name
EMAIL_USER=your_email
EMAIL_PASS=your_email_password
```

---

## Deployment & CI/CD
- **Backend** deployed on Render with auto-deploy via GitHub

---

## Maintainer

**Sai Krishna Mohan Kolla**  
Full Stack Developer – MERN | AWS | CI/CD