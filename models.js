const mongoose = require('mongoose');

module.exports = {

  Telegram: mongoose.model('Telegram', {
    timestamp: { type: Date, default: Date.now },
    hexSize: { type: Number },
    hexData: { type: String },
    decryptedData: { type: String },
    parsedData: { type: Object },
  })

}
