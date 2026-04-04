/**
 * cloudinaryService.js
 *
 * Centralises all Cloudinary configuration.
 * Exports:
 *   uploadMiddleware  — multer middleware (single file, field: 'document')
 *                       Streams directly to Cloudinary — no disk writes.
 *   deleteFile(publicId) — deletes an uploaded asset
 */

const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

// Store uploads under a dedicated folder; keep original filename clean
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder:        'lendchain/guarantor-docs',
    resource_type: 'auto',                 // supports PDF, images, docx, etc.
    public_id:     `guarantor_${req.user._id}_${Date.now()}`,
    // PDF & docx must be uploaded as 'raw' resource type
    ...(file.mimetype === 'application/pdf' ||
        file.mimetype.includes('word')
      ? { resource_type: 'raw' }
      : {}),
  }),
});

const uploadMiddleware = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
}).single('document');

/**
 * Wraps multer in a promise so it plays nicely in async route handlers.
 */
function uploadDocument(req, res) {
  return new Promise((resolve, reject) => {
    uploadMiddleware(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Delete an asset from Cloudinary by its public_id.
 * resourceType: 'image' | 'raw' | 'video'
 */
async function deleteFile(publicId, resourceType = 'raw') {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    console.error('[Cloudinary] Delete failed:', err.message);
  }
}

module.exports = { uploadDocument, deleteFile, cloudinary };
