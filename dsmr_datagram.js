
const bunyan = require('bunyan');
const bformat = require('bunyan-format');
const formatOut = bformat({ outputMode: 'short' });

const log = bunyan.createLogger({ name: 'dsmr', stream: formatOut, level: 'debug' });


const system_title_length_idx = 1;
const system_title_idx = 2;
const content_length_length = 2;
const frame_counter_length = 4;
const gcm_tag_length = 12;


class DSMDatagram {

  static Read(datagram) 
  {
    if (datagram.length < system_title_length_idx + 1) {
      log.trace(`datagram too short to contain header info`);
      return null;
    }
    
    let system_title_length =  datagram.readUInt8(system_title_length_idx);
    if (datagram.length < system_title_idx + system_title_length + content_length_length + 1) {
      log.trace(`datagram too short to contain header info and system title`);
      return null;
    }

    let system_title = datagram.subarray(system_title_idx, system_title_idx + system_title_length); // typically 8 bytes 
    let subsequent_bytes = datagram.readUInt16BE(system_title_idx + system_title_length + 1); // there is one separator byte inbetween
    let message_length = system_title_idx + system_title_length + content_length_length  + subsequent_bytes + 1
    
    if (datagram.length < message_length) {
      log.trace(`datagram too short to contain body`);
      log.trace(`${datagram.length} < ${message_length} (${system_title_idx} + ${system_title_length} + ${content_length_length} + ${subsequent_bytes} + 1)`);
      return null;      
    }
    let frame_counter = datagram.subarray(system_title_idx + system_title_length + content_length_length + 2, 
      system_title_idx + system_title_length + content_length_length + frame_counter_length + 2); // 8 bytes
    let cipher_text = datagram.subarray(system_title_idx + system_title_length + content_length_length + frame_counter_length + 2, message_length - gcm_tag_length);  // everything except the last 12 bytes
    let gcm_tag = datagram.subarray(message_length - gcm_tag_length, message_length); // 12 bytes

    let retVal = new DSMDatagram();
    retVal.SystemTitle = system_title;
    retVal.SystemTitleLength = system_title_length;
    retVal.ContentLength = subsequent_bytes;
    retVal.FrameCounter = frame_counter;
    retVal.CipherText = cipher_text;
    retVal.GCMTag = gcm_tag;
    retVal.GCMTagLength = gcm_tag_length;
    retVal.MessageLength = message_length;
    return retVal;
  }

  HeaderToString() {
    return `SystemTitle: ${this.SystemTitle.toString('hex')} (${this.SystemTitle}); SystemTitleLength: ${this.SystemTitleLength}; ContentLength: ${this.ContentLength};`;
  }

  IV() {
    return Buffer.concat([this.SystemTitle, this.FrameCounter]);
  }
}

module.exports = DSMDatagram;