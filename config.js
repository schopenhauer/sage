require('dotenv').config();

const path = require('path');

module.exports = {

  port: process.env.PORT || 3000,

  device: process.env.DEVICE || '/dev/ttyUSB0',
  encryption_key: process.env.KEY,
  additional_auth_data: process.env.AAD || '3000112233445566778899AABBCCDDEEFF',

  storeDatabase: true,
  database: process.env.DATABASE_URL || 'mongodb://localhost/sage',

  storeLocalFiles: false,
  storeLocalDirectory: path.join(__dirname, 'logs'),

  cutoff: 40,

};
