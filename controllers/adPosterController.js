const adPoster = require('../models/adPoster');
const { uploadToS3, deleteFromS3 } = require('../utils/s3upload');

const createAd = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const { url, key } = await uploadToS3(req.file, 'ads');

    const { title, link, startDate, endDate } = req.body;
    const ad = await adPoster.create({
      title:     title,
      imageUrl:  url,
      s3Key:     key,
      link,
      startDate,
      endDate
    });

    res.status(201).json(ad);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

const updateAd = async (req, res) => {
  try {
    const update = { ...req.body };
    const existing = await adPoster.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Ad not found' });

    if (req.file) {
      const { url, key } = await uploadToS3(req.file, 'ads');

      await deleteFromS3(existing.s3Key);

      update.imageUrl = url;
      update.s3Key     = key;
    }

    const ad = await adPoster.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json(ad);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

const deleteAd = async (req, res) => {
  try {
    const ad = await adPoster.findById(req.params.id);
    if (!ad) return res.status(404).json({ message: 'Ad not found' });

    await deleteFromS3(ad.s3Key);
    await adPoster.findByIdAndDelete(req.params.id);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

const getAds = async (req, res) => {
  const ads = await adPoster.find().sort('-createdAt');
  res.json(ads);
};

module.exports = { createAd, updateAd, deleteAd, getAds };