# E-Commerce Backend

This is the backend e-commerce application built for warehouse-based product ordering. It provides RESTful API endpoints for user authentication, admin management, product management, cart, orders, and wishlist functionalities, with image uploads to AWS S3.

---

## Features

### Authentication & User Management

* **JWT Authentication** with secure login & protected routes
* **User Registration** with document uploads (ABC & Sales Tax Licenses) via AWS S3
* **Admin Approval Workflow** for new users, with email notifications on approval or rejection
* **Password Recovery** via email with expiring reset tokens
* **Profile Management** endpoints (view & update)

### Product Management (Admin)

* **CRUD Products**

  * Support for products with or without flavor variants
  * Optional deals and purchase limits
* **Flavored Products**: individual stock, price, and sold count per flavor
* **Stock Management**: update stock globally or per flavor
* **Deal Management**: percentage or fixed discounts
* **Image Handling**: upload and delete images via AWS S3

### Product Retrieval & Filtering

* **Fetch All Products** with pagination, sorting, and filtering
* **Filters**: category, subCategory, name search, price range, deals
* **Sort**: price (asc/desc), newest, popularity (sold count), name (A→Z)
* **Fetch Single Product** by ID

### Cart Management

* **One-to-One Cart per User**
* **Add / Update / Remove** cart items (supporting flavored items)
* **Clear Cart**

### Order Management

* **Place Order**: clamps quantities to available stock and returns `adjustments` if any items were reduced
* **Stock & Sold Count Updates**: decrements stock and increments sold count per product/flavor
* **Order Cancellation**: restores stock and decrements sold count when a pending order is cancelled
* **Fetch My Orders** with pagination
* **Fetch Order by ID** for detailed view
* **Admin Order Actions**

  * Update status (`Pending`, `Processing`, `Order Ready`, `Delivered`, `Pickedup`, `Cancelled`)
  * Upload invoice (PDF or image) to AWS S3
  * Cancel orders

### Wishlist Management

* **User Wishlist**: add or remove products
* **Fetch Wishlist** for the logged-in user

---

## Core Logic Overview

* **Flavored Products**: each flavor stored with its own `price`, `stock`, and `soldCount` in the product document
* **Quantity Clamping**: on order placement, if requested `qty > availableStock`, item is adjusted to max stock and returned via `adjustments`
* **Stock Restoration**: cancelling an order automatically restores stock and sold count
* **Image Handling**: uses `multer.memoryStorage()` and AWS SDK to upload/delete files
* **Pagination**: API accepts `page` and `limit` query parameters and responds with `page`, `totalPages`, and `totalItems`

---

## API Endpoints

### Authentication & Users

* `POST /api/users/register` – Register with document uploads
* `POST /api/users/login` – Login and receive JWT
* `POST /api/users/forgot-password` – Request password reset email
* `POST /api/users/reset-password` – Reset password with token
* `PUT /api/users/profile` – Update own profile (protected)
* `GET /api/users/wishlist` – Get current user’s wishlist (protected)
* `POST /api/users/wishlist/:productId` – Add to wishlist (protected)
* `DELETE /api/users/wishlist/:productId` – Remove from wishlist (protected)

(Admin-only)

* `GET /api/users` – List all users
* `PUT /api/users/approve/:id` – Approve user and send credentials
* `DELETE /api/users/reject-user/:id` – Reject & delete unapproved user documents
* `GET /api/users/:id` – Get user by ID
* `PUT /api/users/:id` – Update user
* `DELETE /api/users/:id` – Delete user

### Products

* `POST /api/products` – Create product (admin)
* `GET /api/products` – List products (with filters & pagination)
* `GET /api/products/:id` – Get product by ID
* `PUT /api/products/:id` – Update product (admin)
* `DELETE /api/products/:id` – Delete product (admin)
* `PATCH /api/products/:id/stock` – Update stock or flavor stock (admin)

### Cart

* `GET /api/cart` – Get current user’s cart
* `POST /api/cart` – Add/update cart items
* `DELETE /api/cart/:productId` – Remove item (with optional flavor)
* `DELETE /api/cart` – Clear cart

### Orders

* `POST /api/orders/addOrder` – Place order (protected)
* `GET /api/orders/getMyOrders` – Get current user’s orders
* `GET /api/orders/getOrderById/:id` – Get order details
* `PATCH /api/orders/cancelOrder/:id` – Cancel pending order

(Admin-only)

* `GET /api/orders/getOrders` – List all orders
* `PATCH /api/orders/updateOrderStatus/:id/status` – Change status
* `POST /api/orders/uploadInvoice/:id/invoice` – Upload invoice file

---

## Tech Stack

* **Node.js & Express.js** – Server
* **MongoDB & Mongoose** – Database & ODM
* **AWS S3** – File storage (images & documents)
* **JWT** – Authentication
* **Nodemailer** – Email notifications

---

## Environment Variables

```env
PORT=5000
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
AWS_REGION=your_s3_region
AWS_ACCESS_KEY_ID=your_key_id
AWS_SECRET_ACCESS_KEY=your_secret
AWS_S3_BUCKET_NAME=your_bucket_name
EMAIL_USER=your_email
EMAIL_PASS=your_email_password
```

---

## Deployment & CI/CD

* **Render** – Backend auto-deploys on GitHub push
* **MongoDB Atlas** – Database hosting

---

## Maintainer

**Sai Krishna Mohan Kolla**
Full Stack Developer – MERN | AWS | CI/CD