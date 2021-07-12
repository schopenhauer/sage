require('dotenv').config();

const path = require('path');

module.exports = {

  port: process.env.PORT || 3000,

  device: process.env.DEVICE || '/tmp/ttyVS0',
  encryption_key: process.env.KEY ||         'E4F2FBA8A04B1137E92D43557CDDA40C',
  additional_auth_data: process.env.AAD || '30D8164B26C0A0E9BD75A761FE35B22BA3', //'3000112233445566778899AABBCCDDEEFF',

  storeMongoDB: false,
  mongoDB: process.env.DATABASE_URL || 'mongodb://localhost/sage',

  storeInfluxDB: true,
  influxDBHost: process.env.DATABASE_HOST || 'localhost',
  influxDBPort: process.env.DATABASE_PORT || '8086',
  influxDBName: process.env.DATABASE_NAME || 'sage',
  influxDBMeasurement: process.env.DATABASE_MEASUREMENT || 'smartmeter',

  storeLocalFiles: false,
  storeLocalDirectory: path.join(__dirname, 'logs'),

  cutoff: 40,

  influx_database_mapping: {
  // "1-3:0.2.8": "dsmr_version",
	  "1-0:1.8.0": "active_energy_delivered_total",
	  "1-0:1.8.1": "active_energy_delivered_t1",
	  "1-0:1.8.2": "active_energy_delivered_t2",
	  "1-0:1.7.0": "active_instant_power_delivered",
	  "1-0:2.8.0": "active_energy_received_total",
	  "1-0:2.8.1": "active_energy_received_t1",
	  "1-0:2.8.2": "active_energy_received_t2",
	  "1-0:2.7.0": "active_instant_power_received",
	  "1-0:3.8.0": "reactive_energy_delivered_total",
	  "1-0:3.8.1": "reactive_energy_delivered_t1",
	  "1-0:3.8.2": "reactive_energy_delivered_t2",
	  "1-0:3.7.0": "reactive_instant_power_delivered",
	  "1-0:4.8.0": "reacive_energy_received_total",
	  "1-0:4.8.1": "reacive_energy_received_t1",
	  "1-0:4.8.2": "reacive_energy_received_t2",
	  "1-0:4.7.0": "reacive_instant_power_received",
	},

};
