# E-Commerce Backend

This is the backend e-commerce application built for warehouse-based product ordering. It provides RESTful API endpoints for user authentication, admin management, and full product/order functionalities including flavored product handling, deal management, and S3-based image uploads.

---

## Features

### Authentication & User Management
- **JWT Authentication**
  - Secure login & protected routes
- **User Registration with Document Upload**
  - Upload ABC License & Sales Tax License (AWS S3)
- **Admin User Approval System**
  - Admin can approve/reject users with reason
  - Email notifications for both approval and rejection
- **Password Recovery via Email**
  - Forgot/reset password flow with token expiry
- **Profile Management**
  - Update user profile from frontend

### Product Management (Admin)
- **Create Products**
  - With or without flavor variants
  - With optional deal & purchase limit
- **Flavored Product Support**
  - Each flavor can have individual price & stock
- **Stock Management**
  - Update stock per flavor or non-flavored products
- **Deal Management**
  - Supports discount types: `percent` or `fixed`
- **Product Editing**
  - Update name, description, price, images
- **Image Management via AWS S3**
  - Upload & delete product images from S3
- **Delete Products**
  - Safe delete with image cleanup from S3

### Product Search & Filter
- **Get All Products**
  - With pagination and sorting
- **Filter by**
  - Category, subCategory, name, price range, deals
- **Sort by**
  - Price (asc/desc), newest, popularity (sold count)
- **Get Single Product by ID**
  - Full detail retrieval

### Cart Management
- **Cart Creation and Retrieval**
  - Auto-creates cart on user’s first interaction
- **Add to Cart**
  - Support for flavored/non-flavored product additions
  - If item exists, updates quantity
- **Update Cart Item**
  - Quantity modification or removal when set to 0
- **Remove Item from Cart**
  - Removes selected item (flavored/unflavored match)
- **Clear Cart**
  - Removes all items from user’s cart
- **Cart Items**
  - Includes product ID, flavor, qty, price
  - Populated with product name, images, purchaseLimit

### Admin Dashboard APIs
- Approve, reject (with reason), delete or edit users
- Get all users and specific user details

---

## Tech Stack

| **Backend**   | Node.js, Express.js                         |
| **Database**  | MongoDB (Mongoose ODM)                      |
| **Storage**   | AWS S3 for file & image uploads             |
| **Auth**      | JWT + Role-based Middleware                 |
| **Email**     | Nodemailer                                  |
| **Deployment**| Render                                       |

---

## Core Logic Overview

### Flavored Products
- Support per-flavor price, stock, sold count
- If all prices same: store once in `product.price`
- If prices vary: flavor-wise pricing is used

### Stock Management
- Flavored: stock per flavor name
- Non-flavored: `stock` field at product level

### Deals & Discounts
- `isDeal`: toggle deal mode
- `discountType`: `percent` or `fixed`
- `discountValue`: computed on frontend based on base price

### Image Handling
- `multer.memoryStorage()` for file uploads
- `uploadToS3()` and `deleteFromS3()` for AWS S3

### Cart Logic
- Cart document linked to user (one-to-one)
- Item uniqueness based on `productId` and optional `flavor`
- Automatically creates cart if none exists
- Handles quantity updates, item removal, and full cart clearing

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

## CI/CD & Deployment
- **Backend deployed on [Render](https://render.com/)**
- Auto-deploy on push via GitHub
- Database hosted on MongoDB Atlas

---

## 👨‍💻 Maintained By

**Sai Krishna Mohan Kolla**  
Full Stack Developer – MERN | AWS | CI/CD