// yealink-provision - Fetch API
// Cameron Fleming 2023

// This router contains routes fetched by the provisioning server to get device configuration information.
// It splits the configuration elements into a hierarchy of configuratin in JSON.

import { Router } from 'express';
import { DeviceConfigElement } from '../mongo/schemas/config.js';
import { Device } from '../mongo/schemas/device.js';
import { Site } from '../mongo/schemas/site.js';
import { Model } from '../mongo/schemas/model.js';
import { EventEmitter } from 'events';

// Create event emitter
export const fetchEmitter = new EventEmitter();

import { logger } from '../index.js';

export const router = Router();

// Get a device by MAC address and password, if both match, return site, device, model and configuration.
// Build the configuration by taking all global elements  and then all site elements and then all device elements, overwriting as needed.
router.get('/device/:mac', async (req, res) => {
  req.params.mac = req.params.mac.toUpperCase();
  const device = await Device.findOne({ mac_address: req.params.mac });
  if (!device) {
    res.status(404).json({
      error: 'not_found',
      message: 'No device with that MAC address was found',
    })
    return;
  }
  
  if (!device.published) {
    res.status(403).json({
      error: 'forbidden',
      message: 'Device is not published',
    })

    fetchEmitter.emit('audit_device_fetch', device, {
      result: 'fail',
      reason: 'device_not_published',
      message: "Attempt to fetch configuration for unpublished device."
    });

    return;
  }
   
  if (device.id != req.query.username) {
    res.status(403).json({
      error: 'forbidden',
      message: 'Incorrect username',
    })

    fetchEmitter.emit('audit_device_fetch', device, {
      result: 'fail',
      reason: 'incorrect_username',
      message: "Attempt to fetch configuration with incorrect username."
    });

    return;
  }

  if (device.password != req.query.password) {
    res.status(403).json({
      error: 'forbidden',
      message: 'Incorrect password',
    })

    fetchEmitter.emit('audit_device_fetch', device, {
      result: 'fail',
      reason: 'incorrect_password',
      message: "Attempt to fetch configuration with incorrect password."
    });

    return;
  }

  const site = await Site.findOne({ id: device.site_id });
  if (!site) {
    res.status(404).json({
      error: 'not_found',
      message: 'No site with ID specified in device configuration - something is wrong here.',
    })

    fetchEmitter.emit('audit_device_fetch', device, {
      result: 'fail',
      reason: 'site_not_found',
      message: "Attempt to fetch configuration for device with invalid site ID."
    });

    return;
  }

  if (!site.published) {
    res.status(403).json({
      error: 'forbidden',
      message: 'Site is not published',
    })

    fetchEmitter.emit('audit_device_fetch', device, {
      result: 'fail',
      reason: 'site_not_published',
      message: "Attempt to fetch configuration for device with unpublished site."
    });

    return;
  }

  const model = await Model.findOne({ id: device.model_id });
  if (!model) {
    res.status(404).json({
      error: 'not_found',
      message: 'No model with ID specified in device configuration - something is wrong here.',
    })

    fetchEmitter.emit('audit_device_fetch', device, {
      result: 'fail',
      reason: 'model_not_found',
      message: "Attempt to fetch configuration for device with invalid model ID."
    });

    return;
  }

  // Get all global config elements
  const globalConfig = await DeviceConfigElement.find({ target_type: 'global' });

  // Get all model config elements
  const modelConfig = await DeviceConfigElement.find({ target_type: 'model', target: model.id });

  // Get all site config elements
  const siteConfig = await DeviceConfigElement.find({ target_type: 'site', target: site.id });

  // Get all device config elements
  const deviceConfig = await DeviceConfigElement.find({ target_type: 'device', target: device.id });

  // Build the config
  let config = {};

  // Add global config
  for (const element of globalConfig) {
    if (element.group_keys) {
      if (!element.published) continue;
      let current = config;
      for (const key of element.group_keys) {
        if (!current[key]) {
          current[key] = {};
        }
        current = current[key];
      }

      current[element.key] = element.value;
    } else {
      config[element.key] = element.value;
    }
  }

  // Add model config
  for (const element of modelConfig) {
    if (!element.published) continue;
    if (element.group_keys) {
      let current = config;
      for (const key of element.group_keys) {
        if (!current[key]) {
          current[key] = {};
        }
        current = current[key];
      }
      current[element.key] = element.value;
    } else {
      config[element.key] = element.value;
    }
  }

  // Add site config
  for (const element of siteConfig) {
    if (!element.published) continue;
    if (element.group_keys) {
      let current = config;
      for (const key of element.group_keys) {
        if (!current[key]) {
          current[key] = {};
        }
        current = current[key];
      }
      current[element.key] = element.value;
    } else {
      config[element.key] = element.value;
    }
  }

  // Add device config
  for (const element of deviceConfig) {
    if (!element.published) continue;
    if (element.group_keys) {
      let current = config;
      for (const key of element.group_keys) {
        if (!current[key]) {
          current[key] = {};
        }
        current = current[key];
      }
      current[element.key] = element.value;
    } else {
      config[element.key] = element.value;
    }
  }

  if (config == {}) {
    res.status(404).json({
      error: 'not_found',
      message: 'No configuration was found for this device',
    })

    fetchEmitter.emit('audit_device_fetch', device, {
      result: 'fail',
      reason: 'no_configuration',
      message: "Attempt to fetch configuration for device with no configuration, possibly due to unpublished entries."
    });

    return;
  }

  res.json({
    site: site,
    device: device,
    model: model,
    config: config,
  })

  fetchEmitter.emit('audit_device_fetch', device, {
    result: 'success',
    reason: "auth_ok_config_present",
    message: "Successfully fetched configuration for device."
  });
});

export const fetchRouter = router;