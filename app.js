const SerialPort = require('serialport');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bunyan = require('bunyan');
const bformat = require('bunyan-format');

const formatOut = bformat({ outputMode: 'short' });
const log = bunyan.createLogger({ name: 'app', stream: formatOut, level: 'info' });
const Influx = require('influx');
const parser = require('./dsmr-parser');
const config = require('./config');
const utils = require('./utils');
const DSMDatagram = require('./dsmr_datagram');

let packetCnt = 0;
let go = false;
let decryptedData; 
let previousHexData;

const startByte = 0xdb;
const headerLength = 14; 

let influx = null;
if (config.storeInfluxDB) {
  let dbFields = Object.assign({}, {"dsmr_version": Influx.FieldType.STRING }, ...Object.keys(config.influx_database_mapping).map((key) => ({[config.influx_database_mapping[key]]: Influx.FieldType.FLOAT })));
  influx = new Influx.InfluxDB({
    host: config.influxDBHost,
    port: config.influxDBPort,
    database: config.influxDBName,
    schema: [
    {
      measurement: config.influxDBMeasurement,
      fields: dbFields,
      tags: [ 'identifier' ]
    }]
  });
  influx.getDatabaseNames()
   .then(names => {
    if (!names.includes(config.influxDBMeasurement)) {
      return influx.createDatabase(config.influxDBMeasurement);
    }
   });
}

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

  iv = datagram.IV();
  auth_tag = datagram.GCMTag;
  cipher = datagram.CipherText;

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

      if (config.storeInfluxDB) {
        const telegram = parser.parse(decryptedData, parser.ParseTypes.NumericIDs | parser.ParseTypes.ReadUnits);

        let timestamp = telegram.objects.timestamp;
        delete telegram.objects.timestamp;
        let fields = {};
        Object.keys(config.influx_database_mapping).forEach((key) => { 
          if (Object.keys(telegram.objects).includes(key)) { 
            fields[config.influx_database_mapping[key]] = telegram.objects[key].value;
          }
        });
        influx.writePoints([{
          measurement: config.influxDBMeasurement,
          fields: fields,
          tags: { identifier: telegram.identifier },
          timestamp: timestamp.value //* 1e6
        }], {
          database: config.influxDBName,
          precision: 's',
        })
        .then(() => log.info("Data saved to DB"))
        .catch(error => log.error(error));
      }

      if (config.storeMongoDB) {
        const telegram = new models.Telegram({
          hexSize: datagram.MessageLength,
          hexData: data.subarray(0, datagram.MessageLength).toString('hex'),
          decryptedData: decryptedData,
          parsedData: parser.parse(decryptedData),
        });
        telegram.save()
        .then(() => log.info('Telegram saved to database:', telegram._id))
        .catch(error => log.error(error));

      }

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
