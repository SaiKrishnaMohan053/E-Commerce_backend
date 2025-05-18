const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  ownerName: { type: String, required: true },
  storeName: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phoneNumber: { type: String, required: true, unique: true, sparse: true, trim: true },
  address: { type: String, required: true },
  einNumber: { type: String, required: true },

  abcLicense: {
    url: { type: String },
    key: { type: String },
    etag: { type: String },
  },

  salesTaxLicense: {
    url: { type: String, required: function () { return this.isNew; } },
    key: { type: String },
    etag: { type: String },
  },

  isApproved: { type: Boolean, default: false },
  isAdmin: { type: Boolean, default: false },
  password: { type: String, required: false },

  resetPasswordToken: { type: String, default: undefined },
  resetPasswordExpires: { type: Date, default: undefined },

  wishlist: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
}, { timestamps: true });

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
module.exports = User;