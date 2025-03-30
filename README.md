# E-Commerce Backend

This is the backend API for a full-stack e-commerce application built for warehouse-based product ordering. It provides RESTful API endpoints for user authentication, admin management, and future product/order functionalities.

---

## Features

- **JWT Authentication** – Secure login & protected routes
- **User Registration with Document Upload**
  - Upload ABC License & Sales Tax License
- **Admin User Approval System**
  - Admin can approve/reject users with reason
  - Email notifications for both approval and rejection
- **Password Recovery via Email**
  - Forgot/reset password flow with token expiry
- **Admin Dashboard API**
  - Approve, reject, delete, or edit users
- **AWS S3 File Management**
  - Upload and delete licenses from S3
- **Profile Management**
  - Update user profile from frontend
- **Scalable & Modular Codebase**
  - Clean folder structure and async handlers
- **CI/CD Ready**
  - GitHub integration and deployment-ready on Render

---

## Tech Stack

- **Node.js + Express**
- **MongoDB (via Mongoose)**
- **AWS S3** – for document storage
- **JWT Authentication**
- **Nodemailer**
- **Render** – for backend hosting