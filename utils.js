const config = require('./config');

module.exports = {

  truncate(str) {
    return `${str.replace(/\r?\n|\r/g, ' ').substr(0, config.cutoff)} ${str.length > config.cutoff ? '(truncated)' : ''}`;
  },

};
