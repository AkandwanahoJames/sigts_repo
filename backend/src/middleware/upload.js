// backend/src/middleware/upload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const uuidv4 = () => crypto.randomUUID();

function isServerlessRuntime() {
    return Boolean(
        process.env.VERCEL ||
        process.env.AWS_LAMBDA_FUNCTION_NAME ||
        process.env.NOW_REGION
    );
}

// Ensure upload directories exist (local / Render only)
const createDirectory = (dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

// Configure storage (memory on Vercel/serverless — disk is read-only)
const storage = isServerlessRuntime()
    ? multer.memoryStorage()
    : multer.diskStorage({
    destination: (req, file, cb) => {
        let uploadPath = 'uploads/';
        
        // Determine folder based on file type
        if (file.fieldname === 'sighting_photo') {
            uploadPath += 'sightings/';
        } else if (file.fieldname === 'profile_pic') {
            uploadPath += 'profiles/';
        } else if (file.fieldname === 'animal_image') {
            uploadPath += 'animals/';
        } else if (file.fieldname === 'story_media') {
            uploadPath += 'cultural/';
        } else {
            uploadPath += 'misc/';
        }
        
        createDirectory(uploadPath);
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const fileExt = path.extname(file.originalname);
        const fileName = `${uuidv4()}${fileExt}`;
        cb(null, fileName);
    }
});

// File filter
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|mp4|mp3|wav|ogg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
        cb(null, true);
    } else {
        cb(new Error('Only images, audio, and video files are allowed'));
    }
};

// Configure multer
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
        files: 10
    },
    fileFilter: fileFilter
});

// Middleware for single file upload
const uploadSingle = (fieldName) => upload.single(fieldName);

// Middleware for multiple file upload
const uploadMultiple = (fieldName, maxCount = 5) => upload.array(fieldName, maxCount);

// Middleware for multiple fields
const uploadFields = (fields) => upload.fields(fields);

// Process uploaded image (resize, optimize)
const processImage = async (filePath) => {
    const sharp = require('sharp');
    const outputPath = filePath.replace(/(\.[\w\d]+)$/, '_optimized$1');
    
    await sharp(filePath)
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toFile(outputPath);
    
    // Replace original with optimized
    fs.unlinkSync(filePath);
    fs.renameSync(outputPath, filePath);
    
    return filePath;
};

// Delete uploaded file
const deleteFile = (filePath) => {
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
    }
    return false;
};

// Get file URL
const getFileUrl = (req, filename) => {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return `${baseUrl}/uploads/${filename}`;
};

module.exports = {
    isServerlessRuntime,
    upload,
    uploadSingle,
    uploadMultiple,
    uploadFields,
    processImage,
    deleteFile,
    getFileUrl
};