// yealink-provision - Config API
// Cameron Fleming 2023

import { nanoid } from 'nanoid';
import { Router } from 'express';
import { EventEmitter } from 'events';


import { DeviceConfigElement } from '../mongo/schemas/config.js';
import { Device } from '../mongo/schemas/device.js';
import { Site } from '../mongo/schemas/site.js';
import { Model } from '../mongo/schemas/model.js';

import { logger } from '../index.js';

export const router = Router();

// Get all config elements by target_type and target_id (if needed, ignore for global)
router.get('/', async (req, res) => {
  if (!req.query.target_type) {
    res.status(400).json({
      error: 'missing_params',
      message: 'The request must contain a target_type query parameter',
    })
    return;
  }

  if (req.query.target_type != 'global' && !req.query.target_id) {
    res.status(400).json({
      error: 'missing_params',
      message: 'The request must contain a target_id query parameter',
    })
    return;
  }

  const configs = await DeviceConfigElement.find({ target_type: req.query.target_type, target: req.query.target_id || undefined });

  res.json(configs);
});

// Get a single config element by id
router.get('/:id', async (req, res) => {
  const config = await DeviceConfigElement.findOne( { id: req.params.id } );
  if (!config) {
    res.status(404).json({
      error: 'not_found',
      message: 'No config element with that id was found',
    })
    return;
  }

  res.json(config);
});

// Create a new config element
router.post('/', async (req, res) => {
  if (!req.body.target_type) {
    res.status(400).json({
      error: 'missing_params',
      message: 'The request must contain a target_type body parameter',
    })
    return;
  }

  if (req.body.target_type != 'global' && !req.body.target_id) {
    res.status(400).json({
      error: 'missing_params',
      message: 'The request must contain a target_id body parameter',
    })
    return;
  }

  if (!req.body.key || !req.body.group_keys || !req.body.value) {
    res.status(400).json({
      error: 'missing_params',
      message: 'The request must contain a key, group_keys, and value body parameter',
    })
    return;
  }

  // Ensure the target exists.
  switch (req.body.target_type) {
    case "device":
      if (!await Device.findOne({ id: req.body.target_id })) {
        res.status(404).json({
          error: 'not_found',
          message: 'No device with that id was found',
        })
        return;
      }
      break;
    
    case "site":
      if (!await Site.findOne({ id: req.body.target_id })) {
        res.status(404).json({
          error: 'not_found',
          message: 'No site with that id was found',
        })
        return;
      }
      break;

    case "model":
      if (!await Model.findOne({ id: req.body.target_id })) {
        res.status(404).json({
          error: 'not_found',
          message: 'No model with that id was found',
        })
        return;
      }
      break;

    case "global":
      break;

    default:
      res.status(400).json({
        error: 'invalid_params',
        message: 'The target_type parameter must be one of device, site, model, or global',
      })
      return;
  }

  // Ensure a config element with the same key (including group keys) doesn't already exist.
  const result = await DeviceConfigElement.find({ group_keys: req.body.group_keys, key: req.body.key, target_type: req.body.target_type, target: req.body.target_id || undefined });
  if (result.length > 0) {
    res.status(409).json({
      error: 'already_exists',
      message: 'A config element with that key already exists',
    })
    return;
  }

  const config = new DeviceConfigElement({
    id: nanoid(8),
    group_keys: req.body.group_keys,
    key: req.body.key,
    value: req.body.value,
    remark: req.body.remark || undefined,
    target_type: req.body.target_type,
    target: req.body.target_id || undefined,
  });

  await config.save();
  res.json(config);
  logger.info(`Created config element ${config.id}, full key: ${config.group_keys.join('.')}.${config.key}`);
});

// Change value of a config element
router.patch('/:id', async (req, res) => {
  if (!req.body.value) {
    res.status(400).json({
      error: 'missing_params',
      message: 'The request must contain a value body parameter',
    })
    return;
  }

  const config = await DeviceConfigElement.findOne( { id: req.params.id } );
  if (!config) {
    res.status(404).json({
      error: 'not_found',
      message: 'No config element with that id was found',
    })
    return;
  }

  config.value = req.body.value;
  await config.save();
  res.json(config);

  logger.info(`Changed value of config element ${config.id}, full key: ${config.group_keys.join('.')}.${config.key}`);
});

// Delete a config element
router.delete('/:id', async (req, res) => {
  const config = await DeviceConfigElement.findOne( { id: req.params.id } );
  if (!config) {
    res.status(404).json({
      error: 'not_found',
      message: 'No config element with that id was found',
    })
    return;
  }

  await DeviceConfigElement.deleteOne( { id: req.params.id } );
  res.json({
    "status": "deleted_config",
    "message": "Successfully deleted config element."
  })

  logger.info(`Deleted config element ${config.id}, full key: ${config.group_keys.join('.')}.${config.key}`);
});

// Publish a config element.
router.post('/:id/publish', async (req, res) => {
  const config = await DeviceConfigElement.findOne( { id: req.params.id } );
  if (!config) {
    res.status(404).json({
      error: 'not_found',
      message: 'No config element with that id was found',
    })
    return;
  }

  config.published = true;

  await config.save();
  res.json({
    "status": "config_element_published",
    "message": "Successfully published config element."
  });

  logger.info(`Published config element ${config.id}, full key: ${config.group_keys.join('.')}.${config.key}`);
});

// Unpublish a config element.
router.delete('/:id/publish', async (req, res) => {
  const config = await DeviceConfigElement.findOne( { id: req.params.id } );
  if (!config) {
    res.status(404).json({
      error: 'not_found',
      message: 'No config element with that id was found',
    })
    return;
  }

  config.published = false;

  await config.save();
  res.json({
    "status": "config_element_unpublished",
    "message": "Successfully unpublished config element."
  });

  logger.info(`Unpublished config element ${config.id}, full key: ${config.group_keys.join('.')}.${config.key}`);
});

export default router;