const User = require('../models/user.js');
const generateToken = require('../utils/generateToken.js');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { uploadToS3, deleteFromS3 } = require('../utils/s3upload.js');
const { sendApprovalEmail, sendResetPasswordEmail, sendDocumentRejectionEmail } = require('../utils/sendEmail.js');

const findUserById = async (id) => {
  const user = await User.findById(id);
  if (!user) {
    res.status(404).json({ message: 'User not found' });
  }
  return user;
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (!user.isApproved) {
      return res.status(403).json({ message: 'User is not approved. Please wait for admin approval.' });
    }

    res.json({ token: generateToken(user) });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const registerUser = async (req, res) => {
  try {
    const { ownerName, storeName, email, phoneNumber, address, einNumber } = req.body;
    const salesTaxFile = req?.files?.salesTaxLicense?.[0];
    const abcFile = req?.files?.abcLicense?.[0];

    if (!salesTaxFile) {
      return res.status(400).json({ message: 'Sales Tax License is required' });
    }

    if (await User.findOne({ email })) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const [salesTaxLicenseUrl, abcLicenseUrl] = await Promise.all([
      uploadToS3(salesTaxFile, 'licenses/salestax'),
      abcFile ? uploadToS3(abcFile, 'licenses/abc') : null
    ]);

    const user = await User.create({
      ownerName,
      storeName,
      email,
      phoneNumber,
      address,
      einNumber,
      abcLicense: abcLicenseUrl,
      salesTaxLicense: salesTaxLicenseUrl,
      isApproved: false,
    });

    res.status(201).json({ message: 'User registered successfully. Waiting for admin approval.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.isApproved) return res.status(403).json({ message: 'User is not approved. Please wait for admin approval.' });

    const resetToken = crypto.randomBytes(20).toString('hex');

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();

    await sendResetPasswordEmail(user.email, resetToken);
    res.json({ message: 'Reset email sent' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    const user = await User.findOne({
      resetPasswordToken: resetToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) return res.status(400).json({ message: 'Invalid or expired token' });

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const approveUser = async (req, res) => {
  try {
    const user = await findUserById(req.params.id);
    if (user.isApproved) return res.status(400).json({ message: 'User is already approved' });

    const generatedPassword = Math.random().toString(36).slice(-8);
    user.password = await bcrypt.hash(generatedPassword, 10);
    user.isApproved = true;
    await user.save();

    await sendApprovalEmail(user.email, user.ownerName, generatedPassword);
    res.json({ message: 'User approved successfully and email sent' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const deleteUserIfDocsIncorrect = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const user = await findUserById(id);

    if (user.isApproved) return res.status(400).json({ message: 'Cannot delete an approved user' });

    if (user.salesTaxLicense?.key) await deleteFromS3(user.salesTaxLicense.key);
    if (user.abcLicense?.key) await deleteFromS3(user.abcLicense.key);

    await sendDocumentRejectionEmail(user.email, reason);
    await User.findByIdAndDelete(id);

    res.json({ message: 'User deleted, documents removed from S3, and notified due to incorrect documents' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getUsers = async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getUserById = async (req, res) => {
  try {
    const user = await findUserById(req.params.id);
    res.json(user);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

const updateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.salesTaxLicense?.key) await deleteFromS3(user.salesTaxLicense.key);
    if (user.abcLicense?.key) await deleteFromS3(user.abcLicense.key);

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    Object.assign(user, req.body);
    await user.save();

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  loginUser,
  registerUser,
  requestPasswordReset,
  resetPassword,
  approveUser,
  deleteUserIfDocsIncorrect,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  updateUserProfile
};