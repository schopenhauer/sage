const bunyan = require('bunyan')
const bformat = require('bunyan-format')
const formatOut = bformat({ outputMode: 'short' })
const log = bunyan.createLogger({ name: 'parser', stream: formatOut, level: 'debug' });
const mongoose = require('mongoose')
const models = require('./models')
const config = require('./config')
const utils = require('./utils')
const parser   = require('dsmr-parser');

mongoose.connect(config.database, {useNewUrlParser: true})
  .catch(err => {
    log.warn(err.message);
});

log.info('Parsing telegrams...')

let query = models.Telegram.find({decryptedData: { $exists: true, $ne: null } })

query.exec(function (err, telegrams) {
  if (err) return log.error(err);
  telegrams.map(function(t) {
    t.parsedData = parser.parse(t.decryptedData)
    t.markModified('parsedData');
    t.save(function(err) {
      if (err) return log.error(err);
    });
  })
  log.info('Done.')
});
