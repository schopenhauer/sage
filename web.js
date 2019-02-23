const Koa = require('koa')
const views = require('koa-views')
const serve = require('koa-static')
const Router = require('koa-router');
const bunyan = require('bunyan')
const bformat = require('bunyan-format')
const formatOut = bformat({ outputMode: 'short' })
const log = bunyan.createLogger({ name: 'web', stream: formatOut, level: 'debug' });
const voca = require('voca');
const moment = require('moment')
const mongoose = require('mongoose')
const models = require('./models')
const path = require('path')
const config = require('./config')
const utils = require('./utils')

const app = new Koa()
const router = new Router();

const tools = { moment, voca, utils }

mongoose.connect(config.database, {useNewUrlParser: true})
  .catch(err => {
    log.warn(err.message);
})

app.use(serve(path.join(__dirname, 'public')));
app.use(views(path.join(__dirname, 'views'), { map: { html: 'ejs' } } ))

router.get('/', async (ctx, next) => {
  let telegrams = await models.Telegram.find({}).limit(10).sort({ timestamp: -1 })
  let series1 = []
  let series2 = []

  let s1 = await models.Telegram.aggregate(
      [
          { "$group": {
              "_id": {
                "hour": { "$hour": "$timestamp" },
              },
              /*"avgInstCurrent": { "$avg": "$parsedData.objects.instantaneous current L2" },
              "minInstCurrent": { "$min": "$parsedData.objects.instantaneous current L2" },
              "maxInstCurrent": { "$max": "$parsedData.objects.instantaneous current L2" },*/
              "avgActElectricitryDelivered": { "$avg": "$parsedData.objects.actual electricity power delivered" },
              /*"avgTotalImportEnergyQ+": { "$avg": "$parsedData.objects.total imported energy register (Q+)" },
              "avgTotalExportEnergyQ-": { "$avg": "$parsedData.objects.total exported energy register (Q-)" },
              "avgInstImportedReactivePower": { "$avg": "$parsedData.objects.instantaneous imported reactive power (Q+)" },
              "avgInstExportedReactivePower": { "$avg": "$parsedData.objects.instantaneous exported reactive power (Q-)" },
              "avgElectricityTariffReceived": { "$avg": "$parsedData.objects.electricity received tariff 0" },
              "avgElectricityTariffDelivered": { "$avg": "$parsedData.objects.electricity delivered tariff 0" },*/
            }
        }]).exec()

    for(const [i, item] of s1.entries()) {
      series1.push([
        i+1,
        item.avgActElectricitryDelivered
      ])
    }
    series1 = JSON.stringify(series1)

    let s2 = await models.Telegram.aggregate(
        [
            { "$group": {
                "_id": {
                  "year": { "$year": "$timestamp" },
                  "month": { "$month": "$timestamp" },
                  "day": { "$dayOfMonth": "$timestamp" },
                },
                "min": { "$min": "$parsedData.objects.electricity delivered tariff 0" },
                "max": { "$max": "$parsedData.objects.electricity delivered tariff 0" },
                //"avg": { "$avg": "$parsedData.objects.electricity delivered tariff 0" },
            }
          }]).exec()

      for(const item of s2) {
        series2.push([
          Date.UTC(item['_id']['year'], item['_id']['month'], item['_id']['day']),
          item.max - item.min
        ])
      }
      series2 = JSON.stringify(series2)

  await ctx.render('dashboard', {
    telegrams,
    series1,
    series2,
    ...tools,
  })
});

router.get('/telegrams', async (ctx, next) => {
  let telegrams = await models.Telegram.find({}).limit(10).sort({ timestamp: -1 })
  let count = await models.Telegram.countDocuments({})
  await ctx.render('telegrams', {
    telegrams,
    count,
    ...tools,
  })
});

app
  .use(router.routes())
  .use(router.allowedMethods());

app.listen(config.port, () => {
  log.info('Web interface listening on port ' + config.port)
})
