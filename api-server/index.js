// api-server@yealink-provision - Yealink Provisioning Server
// Cameron Fleming 2023

import winston from 'winston';
import mongoose from 'mongoose';
import express from 'express';
import cors from 'cors';
import events from 'events';
import { customAlphabet } from 'nanoid';
import { Server } from 'socket.io';

// Setup nanoid
const nanoid = customAlphabet('1234567890abcdef', 8);

// Import express routers
import sitesRouter from './routes/sites.js';
import modelsRouter from './routes/models.js';
import deviceRouter from './routes/devices.js';
import {fetchRouter, fetchEmitter} from './routes/fetch.js';
import configRouter from './routes/config.js';
import virtualDeviceRouter from './routes/virtual_device.js';

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
    new winston.transports.File({ filename: 'api-server.log' })
  ]
});

export { logger };

// Setup MongoDB with mongoose

const main = async () => {
  logger.debug("yealink-provision api-server starting up...");
  await mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/yealink-provision', { useNewUrlParser: true, useUnifiedTopology: true }).catch((err) => {
    logger.error("Failed to connect to MongoDB: " + err);
    process.exit(1);
  });
  logger.info("Connected to MongoDB.");

  // Setup Express
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Setup routes
  app.use('/sites', sitesRouter);
  app.use('/models', modelsRouter);
  app.use('/sites/:site/devices', deviceRouter);
  app.use('/sites/:site/virtual_devices', virtualDeviceRouter);
  app.use('/:target_type/:target_id/config', configRouter)
  app.use('/fetch', fetchRouter);

  // Capture events from fetchEmitter
  // fetchEmitter.on('audit_device_fetch', async (device, result) => {
  //   logger.info("Device fetch audit event: " + device.mac_address);
  //   await io.emit('audit_device_fetch', device.mac_address);

  //   // Add new audit log entry.
  //   await FetchAudit.create({
  //     id: nanoid(8),
  //     type: "device_specific",
  //     device_id: device.id,
  //     success: result.result == 'success',
  //     state_string: result.reason || "N/A",
  //     remark: result.message || "N/A",
  //   });
  // });

  // Start Express
  app.listen(process.env.HTTP_PORT || 3000, () => {
    logger.info("yealink-provision api-server listening on port " + (process.env.HTTP_PORT || 3000));
  });

  // Setup Socket.IO server
  const io = new Server();
  io.listen(process.env.WS_PORT || 3001, () => {
    logger.info("yealink-provision api-server listening for websocket connections on port " + (process.env.WS_PORT || 3001));
  });
}

main();