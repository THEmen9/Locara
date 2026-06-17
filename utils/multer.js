const multer = require("multer");
const { storage } = require("../cloudConfig");

module.exports = multer({ storage });