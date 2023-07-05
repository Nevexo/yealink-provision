// yealink-provision - Yealink Provisioning Agent.
// Cameron Fleming 2023

import winston from 'winston';
import aixos from 'axios';
import express from 'express';
import cors from 'cors';

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

// Setup routes, handle "/cfg/[MAC ADDRESS].cfg" requests.
app.get('/cfg/:mac', async (req, res) => {
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


  // Fetch device from API server
  let data;
  await axios.get(`/fetch/device/${mac}`, {
    params: {
      username: "cy0eNKDl",
      password: "vgCwAfz29_eji3iyNNP8Oy9Z_ZULd7HA"
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
