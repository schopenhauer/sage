const crc   = require('crc');
const utils = require('./utils');

const ParseTypes = Object.freeze({"TextBased": 1, "NumericIDs":2, "ReadUnits": 8 });

// Common patterns.
const patterns = {
  TELEGRAM : /^\/...5(.*?)\r\n\r\n((?:.|[\r\n])*?)!([a-f0-9]{4})\r\n$/mi,
  CHECKSUM : /^((?:.|[\r\n])+?!)([a-f0-9]{4})\r\n$/mi,
};

const object_patterns = {
  'dsmr version' : {
    pattern   : /^(1-3:0\.2\.8)\(([0-9]+)\)$/m,
    transform : (v) => String((v / 10).toFixed(1))
  },
  timestamp : {
    pattern   : /^(0-0:1\.0\.0)\(([0-9]{12}[WS])\)$/m,
    transform : utils.parseTimestamp
  },
  'equipment identifier' : {
    pattern   : /^(0-0:96\.1\.1)\(([0-9a-f]+)\)$/mi,
    transform : utils.parseHex
  },
  'gas equipment identifier' : {
    pattern   : /^(0-[0-9]+:96\.1\.0)\(([0-9a-f]+)\)$/mi,
    transform : utils.parseHex
  },
  'text message short' : {
    pattern   : /^(0-0:96\.13\.1)\(([0-9a-f]+)\)$/mi,
    transform : utils.parseHex
  },
  'text message long' : {
    pattern   : /^(0-0:96\.13\.0)\(([0-9a-f]+)\)$/mi,
    transform : utils.parseHex
  },
  'electricity delivered tariff 1' : {
    pattern   : /^(1-0:1\.8\.1)\((([0-9.]+)(\*([a-zA-Z]+))?)/m,
    transform : Number
  },
  'electricity delivered tariff 2' : {
    pattern   : /^(1-0:1\.8\.2)\((([0-9.]+)(\*([a-zA-Z]+))?)/m,
    transform : Number
  },
  'electricity received tariff 1' : {
    pattern   : /^(1-0:2\.8\.1)\((([0-9.]+)(\*([a-zA-Z]+))?)/m,
    transform : Number
  },
  'electricity received tariff 2' : {
    pattern   : /^(1-0:2\.8\.2)\((([0-9.]+)(\*([a-zA-Z]+))?)/m,
    transform : Number
  },
  'tariff indicator electricity' : {
    pattern   : /^(0-0:96\.14\.0)\(([0-9]+)/m,
    transform : Number
  },
  'actual electricity power delivered' : {
    pattern   : /^(1-0:1\.7\.0)\((([0-9.]+)(\*([a-zA-Z]+))?)/m,
    transform : Number
  },
  'actual electricity power received' : {
    pattern   : /^(1-0:2\.7\.0)\((([0-9.]+)(\*([a-zA-Z]+))?)/m,
    transform : Number
  },
  'number of power failures in any phase' : {
    pattern   : /^(0-0:96\.7\.21)\(([0-9.]+)/m,
    transform : Number
  },
  'number of long power failures in any phase' : {
    pattern   : /^(0-0:96\.7\.9)\(([0-9.]+)/m,
    transform : Number
  },
  'number of voltage sags in L1 phase' : {
    pattern   : /^(1-0:32\.32\.0)\(([0-9.]+)/m,
    transform : Number
  },
  'number of voltage sags in L2 phase' : {
    pattern   : /^(1-0:52\.32\.0)\(([0-9.]+)/m,
    transform : Number
  },
  'number of voltage sags in L3 phase' : {
    pattern   : /^(1-0:72\.32\.0)\(([0-9.]+)/m,
    transform : Number
  },
  'number of voltage swells in L1 phase' : {
    pattern   : /^(1-0:32\.36\.0)\(([0-9.]+)/m,
    transform : Number
  },
  'number of voltage swells in L2 phase' : {
    pattern   : /^(1-0:52\.36\.0)\(([0-9.]+)/m,
    transform : Number
  },
  'number of voltage swells in L3 phase' : {
    pattern   : /^(1-0:72\.36\.0)\(([0-9.]+)/m,
    transform : Number
  },
  'instantaneous voltage L1' : {
    pattern   : /^(1-0:32\.7\.0)\((([0-9.]+)(\*([a-zA-Z]+))?)/m,
    transform : Number
  },
  'instantaneous voltage L2' : {
    pattern   : /^(1-0:52\.7\.0)\((([0-9.]+)(\*([a-zA-Z]+))?)/m,
    transform : Number
  },
  'instantaneous voltage L3' : {
    pattern   : /^(1-0:72\.7\.0)\((([0-9.]+)(\*([a-zA-Z]+))?)/m,
    transform : Number
  },
  'instantaneous current L1' : {
    pattern   : /^(1-0:31\.7\.0)\((([0-9.]+)(\*([a-zA-Z]+))?)/m,
    transform : Number
  },
  'instantaneous current L2' : {
    pattern   : /^(1-0:51\.7\.0)\((([0-9.]+)(\*([a-zA-Z]+))?)/m,
    transform : Number
  },
  'instantaneous current L3' : {
    pattern   : /^(1-0:71\.7\.0)\((([0-9.]+)(\*([a-zA-Z]+))?)/m,
    transform : Number
  },
  'instantaneous active power L1 delivered' : {
    pattern   : /^(1-0:21\.7\.0)\((([0-9.]+)(\*([a-zA-Z]+))?)/m,
    transform : Number
  },
  'instantaneous active power L2 delivered' : {
    pattern   : /^(1-0:41\.7\.0)\((([0-9.]+)(\*([a-zA-Z]+))?)/m,
    transform : Number
  },
  'instantaneous active power L3 delivered' : {
    pattern   : /^(1-0:61\.7\.0)\((([0-9.]+)(\*([a-zA-Z]+))?)/m,
    transform : Number
  },
  'instantaneous active power L1 received' : {
    pattern   : /^(1-0:22\.7\.0)\((([0-9.]+)(\*([a-zA-Z]+))?)/m,
    transform : Number
  },
  'instantaneous active power L2 received' : {
    pattern   : /^(1-0:42\.7\.0)\((([0-9.]+)(\*([a-zA-Z]+))?)/m,
    transform : Number
  },
  'instantaneous active power L3 received' : {
    pattern   : /^(1-0:62\.7\.0)\((([0-9.]+)(\*([a-zA-Z]+))?)/m,
    transform : Number
  },
  'gas timestamp' : {
    pattern   : /^(0-[0-9]+:24\.2\.1)\(([0-9.]+[WS])\)/m,
    transform : utils.parseTimestamp
  },
  'gas delivered' : {
    pattern   : /^(0-[0-9]+:24\.2\.1)\([0-9.]+[WS]\)\(([0-9.]+)/m,
    transform : Number
  },
  'logical device name': {
    pattern: /^(0-0:42\.0\.0)\(([0-9.]+)/m,
    transform: String
  },
  'total imported energy register (Q+)': {
    pattern: /^(1-0:3\.8\.0)\((([0-9.]+)(\*([a-zA-Z]+))?)/m,
    transform: Number
  },
  'total imported energy register (Q+) tariff 1': {
    pattern: /^1-0:3\.8\.1\(([0-9.]+)/m,
    transform: Number
  },
  'total imported energy register (Q+) tariff 2': {
    pattern: /^1-0:3\.8\.2\(([0-9.]+)/m,
    transform: Number
  },
  'total exported energy register (Q-)': {
    pattern: /^(1-0:4\.8\.0)\((([0-9.]+)(\*([a-zA-Z]+))?)/m,
    transform: Number
  },
  'total exported energy register (Q-) tariff 1': {
    pattern: /^1-0:4\.8\.1\(([0-9.]+)/m,
    transform: Number
  },
  'total exported energy register (Q-) tariff 2': {
    pattern: /^1-0:4\.8\.2\(([0-9.]+)/m,
    transform: Number
  },
  'instantaneous imported reactive power (Q+)': {
    pattern: /^(1-0:3\.7\.0)\((([0-9.]+)(\*([a-zA-Z]+))?)/m,
    transform: Number
  },
  'instantaneous exported reactive power (Q-)': {
    pattern: /^(1-0:4\.7\.0)\((([0-9.]+)(\*([a-zA-Z]+))?)/m,
    transform: Number
  },
  'actual theshold electricity in kW': {
    pattern: /^(0-0:17\.0\.0)\(([0-9.]+)/m,
    transform: Number
  },
  'switch position electricity' : {
    pattern   : /^(0-0:96\.3\.10)\(([0-9.]+)/m,
    transform : Number
  },
  'electricity received tariff 0' : {
    pattern   : /^(1-0:2\.8\.0)\((([0-9.]+)(\*([a-zA-Z]+))?)/m,
    transform : Number
  },
  'electricity delivered tariff 0' : {
    pattern   : /^(1-0:1\.8\.0)\((([0-9.]+)(\*([a-zA-Z]+))?)/m,
    transform : Number
  },  
};

module.exports = {
  parse(telegram, parseMode) {
    return this.validate(telegram, parseMode);
  },
  validate(telegram, parseMode) {
    return Telegram(telegram, parseMode);
  },
  ParseTypes,
};

function Telegram(telegram, parseMode) {
  if (! (this instanceof Telegram)) return new Telegram(telegram, parseMode);
  this.telegram = telegram;
  if (typeof(parseMode) == 'undefined') {
    parseMode = ParseTypes.TextBased;
  }
  this.parse(parseMode);
};

Telegram.prototype.parse = function(parseMode) {
  var match = this.telegram.match(patterns.TELEGRAM);

  // Validate the overall telegram structure.
  if (! match) throw new Error('INVALID_TELEGRAM');

  // Validate the checksum.
  if (this.checksum() !== match[3]) throw new Error('CHECKSUM_MISMATCH');

  // Parse properties and data.
  this.identifier = match[1];
  this.crc        = match[3];
  this.objects    = this.parseObjects(match[2], parseMode);
};

Telegram.prototype.checksum = function() {
  var data = this.telegram.match(patterns.CHECKSUM)[1];
  return ('0000' + crc.crc16(data).toString(16)).slice(-4).toUpperCase();
}

Telegram.prototype.parseObjects = function(data, parseMode) {
  var objectsByText = {};
  var objectsById = {};

  data.split('\r\n').forEach(line => {
    var processed = false;
    // see if there is a known parser
    Object.keys(object_patterns).forEach((key) => {
      var obj   = object_patterns[key];
      var match = obj.pattern.exec(line);

      if (! match) return;
      var valueIdx = match.length > 5 ? 3 : 2;
      var parsed = (parseMode & ParseTypes.ReadUnits) == 0
        ? obj.transform ? obj.transform.apply(obj, match.slice(valueIdx, valueIdx + 1)) : match[valueIdx]
        : {
        value: obj.transform ? obj.transform.apply(obj, match.slice(valueIdx, valueIdx + 1)) : match[valueIdx],
        unit: match.length > 5 ? match[5] : null,
      };
      if ((parseMode & ParseTypes.TextBased) != 0 || key == 'timestamp') objectsByText[key] = parsed;
      if ((parseMode & ParseTypes.NumericIDs) != 0) objectsById[match[1]] = parsed;
      processed = true;
    });
    if (processed) return;
    if ((parseMode & ParseTypes.NumericIDs) != 0) {
      var matches = /^([0-9]+-[0-9]+:[0-9.]+)\((.+)\)$/m.exec(line);
      if (!matches) return;
      objectsById[matches[1]] = (parseMode & ParseTypes.ReadUnits) == 0 ? matches[2].split(')(') : { value: matches[2].split(')(') }
    }

  })
  return Object.assign({}, objectsByText, objectsById);;
}
