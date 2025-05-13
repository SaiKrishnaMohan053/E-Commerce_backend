const mongoose = require('mongoose');

const adPosterSchema = new mongoose.Schema({
  title:     { type: String, required: true },
  imageUrl:  { type: String, required: true },
  link:      { type: String },
  startDate: { type: Date },
  endDate:   { type: Date },
  s3Key:     { type: String },
}, { timestamps: true });

module.exports = mongoose.model('adPoster', adPosterSchema);