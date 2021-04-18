const SerialPort = require('serialport');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bunyan = require('bunyan');
const bformat = require('bunyan-format');

const formatOut = bformat({ outputMode: 'short' });
const log = bunyan.createLogger({ name: 'app', stream: formatOut, level: 'info' });
const mongoose = require('mongoose');
const parser = require('dsmr-parser');
const models = require('./models');
const config = require('./config');
const utils = require('./utils');
const DSMDatagram = require('./dsmr_datagram');

let packetCnt = 0;
let go = false;
let decryptedData; 
let previousHexData;

const startByte = 0xdb;

const headerLength = 14; 

// DB 08 53 41  47 35 00 00  B3 20 82 01  F2 30
// 219 8 83 65  71 53 0  0            1   242 48

mongoose.connect(config.database, { useNewUrlParser: true, useUnifiedTopology: true })
  .catch((err) => {
    log.warn(err.message);
  });

log.info('Listening to device:', config.device);
const port = new SerialPort(config.device, {
  baudRate: 115200,
});

port.on('error', (err) => {
  log.error('Serial port: ', err.message);
});


const expectedHeader = [0xdb, 0x08, 0x53, 0x41, 0x47];



function DecryptDatagram(datagram, key, auth_data) 
{

  iv = datagram.IV();  //utils.hex2bin(system_title + frame_counter);
  auth_tag = datagram.GCMTag; //utils.hex2bin(gcm_tag);
  cipher = datagram.CipherText; //utils.hex2bin(cipher_text);

  // log.debug(`${datagram.IV().toString('hex')}`)

  const decipher = crypto.createDecipheriv('aes-128-gcm', key, iv);
  decipher.setAAD(auth_data);
  decipher.setAuthTag(auth_tag);
  decryptedData = decipher.update(cipher, 'hex', 'utf8') + decipher.final('utf8');

  log.debug(`Decrypted data:`, utils.truncate(decryptedData));

  return decryptedData;
}

let key = Buffer.from(config.encryption_key, 'hex');
let auth_data = Buffer.from(config.additional_auth_data, 'hex');

port.on('data', (sdata) => {
  packetCnt++;
  let idx = -1;
  log.debug(`Received data ${packetCnt}:`, `${utils.truncate(sdata.toString('hex'))} / size: ${sdata.length}`);

  if (previousHexData != null) {
    data = Buffer.concat([previousHexData, sdata]);
  } else {
    data = sdata;
  }
  // search for datagram begin
  // for(let i = 0; i < data.length; i++) {
  while(data.length > 0) {
    let match = false;
    idx = idx + 1;
    if (data[0] == expectedHeader[0]) {
      match = true;
      for (let j = 1; j < expectedHeader.length; j++) {
        if (data[j] != expectedHeader[j]) {
          match = false;
          break;
        }
      }
    }
    if (data[0] == expectedHeader[0] && !match) {
      log.debug(`ignoring data after startbyte found at ${idx}`);
      
    }
    if (!match) {
      // sequence not as expected - consume byte and go along
      data = data.subarray(1);
      continue;
    }

    // we found the start of a datagram - try reading the datagram
    let datagram = DSMDatagram.Read(data);
    if (datagram == null) {
      log.debug('reading datagram failed - waiting for more data...');
      // previousHexData = data;
      break;
    }

    log.debug(`Datagram header: ${datagram.HeaderToString()}`);
    log.debug(`FrameCounter: ${datagram.FrameCounter.toString('hex')}`)        
    log.debug(`CipherText: ${utils.truncate(datagram.CipherText.toString('hex'))}`)        
    log.debug(`GCM Tag: ${datagram.GCMTag.toString('hex')}`)

    try {
      let decrypted = DecryptDatagram(datagram, key, auth_data);
      log.info(`Decrypted data: ${packetCnt} ${decrypted}`);

      if (config.storeDatabase) {
        const telegram = new models.Telegram({
          hexSize: datagram.MessageLength,
          hexData: data.subarray(0, datagram.MessageLength).toString('hex'),
          decryptedData: decryptedData,
          parsedData: parser.parse(decryptedData),
        });
        telegram.save().then(() => log.info('Telegram saved to database:', telegram._id));
      }

      // let parsedMsg = parser.parse(decryptedData);
      // log.info(parsedMsg);

    } catch (err) {
      log.error(err);
    } 
    // successfully read a datagram - so consume bytes from data
    data = data.subarray(datagram.MessageLength);
   
  }
  previousHexData = data;
  if (previousHexData != null) {
    log.trace(`remaining data: ${previousHexData.length} ${previousHexData.toString('hex')}`)
  }
});
