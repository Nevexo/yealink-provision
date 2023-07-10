// yealink-provision - Yealink Provisioning Agent.
// Cameron Fleming 2023

import winston from 'winston';
import aixos from 'axios';
import express from 'express';
import cors from 'cors';
import https from 'https';
import fs from 'fs';

// Setup Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf((info) => {
      return `${info.timestamp} ${info.level}: ${info.message}`;
    }
  )),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'yealink-provision.log' })
  ]
});

export { logger };

// Setup Express
const app = express();
app.use(cors());

// Setup axios
const axios = aixos.create({
  baseURL: process.env.API_SERVER_URL || 'http://localhost:3000',
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'yealink-provision/Yealink Agent/1.0.0'
  }
});

// Setup routes, handle "/cfg/[sitepw]/[MAC ADDRESS].cfg" requests.
// This route uses site-based authentication with the site password in the URL.
// This is supported in yealink-provision v1 due to the lack of support for device-based authentication.
// This will be replaced by device authentication once it is supported in yealink-provision v2.
app.get('/cfg/:sitepw/:mac', async (req, res) => {
  if (!req.params.mac.endsWith('.cfg')) {
    logger.debug("Received request for non-cfg file.")
    res.sendStatus(404);
    return;
  }
  const mac = req.params.mac.replace('.cfg', '');
  
  if (mac.length != 12) {
    logger.debug("Received request for invalid mac address size.")
    res.sendStatus(404);
    return;
  }

  const macRegex = /^[0-9A-Fa-f]{12}$/;
  if (!macRegex.test(mac)) {
    logger.debug("Received request for invalid mac address format.")
    res.sendStatus(404);
    return;
  }

  logger.debug(`Received request for ${mac}.cfg`);

  logger.debug(`Site password: ${req.params.sitepw}`);

  // Fetch device from API server
  let data;
  await axios.get(`/fetch/device/${mac}`, {
    params: {
      authentication_mode: 'site_pw',
      password: req.params.sitepw
    }
  }).then((response) => {
    data = response.data;

  }).catch(err => {
    logger.error(`Error fetching device ${mac} from API server: ${err.response.status} ${err.response.statusText}`);
    logger.info(`Reason for failure: ${err.response.data.error} (${err.response.data.message})`)

    res.sendStatus(404);
    return;
  });
 
  if (!data) return;
  
  let yealink_configuration = "#!version:1.0.0.1\n";

  // For every element (recursively) set the value in the configuration file, in the following format.
  // key.key = value (where the nested keys are separated by a period)
  // Do this asynchronously to avoid blocking the event loop.

  const setConfig = async (obj, prefix) => {
    for (const key in obj) {
      if (typeof obj[key] === 'object') {
        await setConfig(obj[key], `${prefix}${key}.`);
      } else {
        logger.debug(`${prefix}${key} = ${obj[key]}`)
        yealink_configuration += `${prefix}${key} = ${obj[key]}\n`;
      }
    }
  }
  await setConfig(data.config, '');

  logger.debug(yealink_configuration)

  res.set('Content-Type', 'text/plain');

  res.send(yealink_configuration);
  logger.info("Response sent to device.")
  return;
});

// Start Express
app.listen(process.env.PORT || 8080, () => {
  logger.info(`Yealink Provisioning Agent listening on port ${process.env.PORT || 8080}`);
});

// Start HTTPS server
// https.createServer({
//   key: fs.readFileSync('server.key'),
//   cert: fs.readFileSync('server.cert')
// }, app).listen(443, () => {
//   logger.info(`Yealink Provisioning Agent listening on port 443`);
// });