const express = require('express');
const { loginUser, registerUser, requestPasswordReset, resetPassword, approveUser, getUsers, getUserById, updateUser, deleteUser, deleteUserIfDocsIncorrect, updateUserProfile } = require('../controllers/userController.js');
const { protect, admin } = require('../middleware/authmiddleware.js');
const multer = require('multer');

const router = express.Router();
const upload = multer();

router.post('/login', loginUser);
router.post('/register', upload.fields([{ name: 'abcLicense', maxCount: 1 }, { name: 'salesTaxLicense', maxCount: 1 }]), registerUser);
router.post('/forgot-password', requestPasswordReset);
router.post('/reset-password', resetPassword);
router.put('/profile', protect, updateUserProfile);
router.put('/approve/:id', protect, admin, approveUser);
router.get('/', protect, admin, getUsers);
router.get('/:id', protect, admin, getUserById);
router.get('/profile/:id', protect, getUserById);
router.put('/:id', protect, admin, updateUser);
router.delete('/:id', protect, admin, deleteUser);
router.delete('/reject-user/:id', protect, admin, deleteUserIfDocsIncorrect);

module.exports = router;