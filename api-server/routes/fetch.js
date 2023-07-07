// yealink-provision - Fetch API
// Cameron Fleming 2023

// This router contains routes fetched by the provisioning server to get device configuration information.
// It splits the configuration elements into a hierarchy of configuratin in JSON.

import { Router } from 'express';
import { DeviceConfigElement, DeviceConfigGroup, get_elements_by_group } from '../mongo/schemas/config.js';
import { Device } from '../mongo/schemas/device.js';
import { Site } from '../mongo/schemas/site.js';
import { Model } from '../mongo/schemas/model.js';
import { EventEmitter } from 'events';

import mergician from 'mergician';

// Create event emitter
export const fetchEmitter = new EventEmitter();

import { logger } from '../index.js';

export const router = Router();

// Get a device by MAC address and password, if both match, return site, device, model and configuration.
// Build the configuration by taking all global elements  and then all site elements and then all device elements, overwriting as needed.
router.get('/device/:mac', async (req, res) => {
  let authentication_mode = "device_pw";
  // TODO: temporary measure for site passwords until Yealink authentication is resolved.
  if (req.query.authentication_mode != undefined) {
    if (req.query.authentication_mode == "site_pw") {
      authentication_mode = "site_pw";
    }
  }

  req.params.mac = req.params.mac.toUpperCase();
  logger.debug(`Fetching configuration for device ${req.params.mac} with authentication mode ${authentication_mode}`)
  const device = await Device.findOne({ mac_address: req.params.mac });
  if (!device) {
    logger.debug("Aborting, mac address not in database.")
    res.status(404).json({
      error: 'not_found',
      message: 'No device with that MAC address was found',
    })
    return;
  }
  
  if (!device.published) {
    logger.debug("Aborting, device not published.")
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

  const site = await Site.findOne({ id: device.site_id });
  
  if (!site) {
    logger.debug("Aborting, site not found.")
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

  // Authenticate the request, this either uses device passwords, where the "username" should match the device ID,
  // or site passwords - which are a temporary measure until I can get Yealink authentication working.
  // The site password will generally be passed to the configuration agents as /cfg/[sitepw]/[mac].cfg
  // TODO: Resolve this properly, then depreciate site passwords.
  switch (authentication_mode) {
    case "device_pw":
      if (device.id != req.query.username) {
        logger.debug("Aborting, incorrect username.")
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
        logger.debug("Aborting, incorrect device password.")
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

      break;

    case "site_pw":
      if (req.query.password != site.password) {
        logger.debug("Aborting, incorrect site password.")
        return res.status(403).json({
          error: 'forbidden',
          message: 'Incorrect password',
        })
      }
      break;

    default:
      logger.debug("Aborting, incorrect authentication mode - incorrectly written configuration agent?")
      res.status(403).json({
        error: 'forbidden',
        message: 'Incorrect authentication mode',
      })
      return;
  }

  logger.debug("Authentication successful, validating site")

  if (!site.published) {
    logger.debug("Aborting, site not published.")
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
    logger.debug("Aborting, model not found.")
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

  logger.debug("Authentication successful, building configuration.")

  // Build a JSON schema of the configuration, for example: {"account": {"1": {"password": "test"}}}
  // This requires resolving all groups for the target_type, then finding all children, and finally all elements
  // noting that some parents may have elements assigned to them.
  // Do this in the order of global, model, site, device.
  // Overwrite as we go.

  let config = {};

  // Get all global groups
  const global_groups = await DeviceConfigGroup.find({ target_type: "global" });
  
  // For every global group, use get_elements_by_group to resolve all elements,
  // then merge the result into the config object.
  for (const group of global_groups) {
    const elements = await get_elements_by_group(group.id);
    // combine the two config objects, merge with mergician
    config = await mergician(config, elements)
  }

  // Get all model groups
  const model_groups = await DeviceConfigGroup.find({ target_type: "model", target: model.id });

  // For every model group, use get_elements_by_group to resolve all elements.
  for (const group of model_groups) {
    const elements = await get_elements_by_group(group.id);
    // combine the two config objects, merge with mergician
    config = await mergician(config, elements)
  }

  // Get all site groups
  const site_groups = await DeviceConfigGroup.find({ target_type: "site", target: site.id });

  // For every site group, use get_elements_by_group to resolve all elements.
  for (const group of site_groups) {
    const elements = await get_elements_by_group(group.id);
    // combine the two config objects, merge with mergician
    config = await mergician(config, elements)
  }

  // Get all device groups
  const device_groups = await DeviceConfigGroup.find({ target_type: "device", target: device.id });

  // For every device group, use get_elements_by_group to resolve all elements.
  for (const group of device_groups) {
    const elements = await get_elements_by_group(group.id);
    // combine the two config objects, merge with mergician
    config = await mergician(config, elements)
  }

  // If the config object is empty, then there is no configuration for this device.
  // This is likely due to unpublished entries.

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

  logger.debug("Configuration sent successfully, done.")
});

export const fetchRouter = router;