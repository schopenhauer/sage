const SerialPort = require('serialport')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const bunyan = require('bunyan')
const bformat = require('bunyan-format')
const formatOut = bformat({ outputMode: 'short' })
const log = bunyan.createLogger({ name: 'app', stream: formatOut, level: 'debug' });
const mongoose = require('mongoose')
const parser = require('dsmr-parser');
const models = require('./models')
const config = require('./config')
const utils = require('./utils')

let i = 0
let go = false
let decryptedData, previousHexData

mongoose.connect(config.database, {useNewUrlParser: true, useUnifiedTopology: true})
  .catch(err => {
    log.warn(err.message);
});

log.info('Listening to device:', config.device)
const port = new SerialPort(config.device, {
  baudRate: 115200
})

port.on('error', function(err) {
  log.error('Serial port: ', err.message)
})

port.on('data', function (data) {
  i++

  let hexData = data.toString('hex')
  log.debug('Received data ' + i + ':', utils.truncate(hexData) + ' / size: ' + hexData.length)

  switch (data.length) {
    case 496:
      log.trace('Received only first data chunk, waiting for second chunk')
      previousHexData = hexData
      go = false
      break;
    case 151:
      log.trace('Merge data received and go to decryption')
      if (previousHexData) {
        hexData = previousHexData + hexData
        previousHexData = null
        go = true
      } else {
        go = false
      }
    case 1294:
      go = true
      break;
    default:
      log.warn('Unknown data length (' + data.length + '), ignoring data');
      go = false
  }

  if (go) {

    try {

      start_byte = hexData.substr(0, 2)
      valid_start_byte_found = start_byte == 'db' ? true : false

      if (valid_start_byte_found) {
        system_title_length = hexData.substr(2, 1 * 2) // 2 bytes
        system_title = hexData.substr(4, 8 * 2) // 8 bytes
        subsequent_bytes = hexData.substr(22, 2 * 2) // 2 bytes
        frame_counter = hexData.substr(28, 4 * 2) // 8 bytes
        cipher_text = hexData.substr(36, hexData.length - 12 * 2 - 36) // 12 bytes
        gcm_tag = hexData.substr(hexData.length - 12 * 2, 12 * 2) // 12 bytes

        log.trace('data length:', hexData.length, 'bytes')
        log.trace('start_byte:', start_byte)
        log.trace('system_title_length:', system_title_length)
        log.trace('system_title:', system_title)
        log.trace('subsequent_bytes:', subsequent_bytes)
        log.trace('frame_counter:', frame_counter)
        log.trace('cipher_text:', cipher_text)
        log.trace('gcm_tag:', gcm_tag)

        key = utils.hex2bin(config.encryption_key)
        iv = utils.hex2bin(system_title + frame_counter)
        auth_data = utils.hex2bin(config.additional_auth_data)
        auth_tag = utils.hex2bin(gcm_tag)
        cipher = utils.hex2bin(cipher_text)

        const decipher = crypto.createDecipheriv('aes-128-gcm', key, iv)
        decipher.setAAD(auth_data)
        decipher.setAuthTag(auth_tag)
        decryptedData = decipher.update(cipher, 'hex', 'utf8') + decipher.final('utf8')

        log.info('Decrypted data ' + i + ':', utils.truncate(decryptedData))
      }

      if (config.storeDatabase) {
        const telegram = new models.Telegram({
          hexSize: hexData.length,
          hexData: hexData,
          decryptedData: decryptedData,
          parsedData: parser.parse(decryptedData),
        });
        telegram.save().then(() => log.trace('Telegram saved to database:', telegram._id))
      }

      if (config.storeLocalFiles) {
        let timestamp = Date.now()
        let file = path.join(config.storeLocalDirectory, timestamp + '.hex')
        fs.writeFile(file, hexData, function(err){
          if (err) log.error(err);
          log.trace('Raw data saved to file:',  file)
        });
      }

    } catch(err) {
      log.error(err);
    }

  }

})
