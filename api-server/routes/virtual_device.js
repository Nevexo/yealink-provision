// yealink-provision - Virtual Device Management API
// Cameron Fleming 2023

// These endpoints are used to manage virtual devices within sites.

import { customAlphabet } from "nanoid";
import { Router } from "express";

import {VirtualDevice, virtualDeviceSchema} from '../mongo/schemas/virtual_device.js';
import { Site } from '../mongo/schemas/site.js';
import { Model } from '../mongo/schemas/model.js';

import { logger } from '../index.js';

// Setup nanoid with custom alphabet
const nanoid = customAlphabet('1234567890abcdef', 8);

const router = Router({ mergeParams: true });

// This router expects to behind a site ID (i.e., /sites/:id/virtual_devices/:id)
// So any requests to the root (/sites/:id/virtual_devices) will return devices specific to the site.

// Get all virtual devices
router.get('/', async(req, res) => {
  let virtual_devices;
  virtual_devices = await VirtualDevice.find( {site_id: req.params.site} );
  res.json(virtual_devices);
})

// Get a specific virtual device
router.get('/:id', async(req, res) => {
  const virtual_device = await VirtualDevice.findOne({id: req.params.id, site_id: req.params.site});
  if (!virtual_device) {
    res.status(404).json({
      error: 'not_found',
      message: 'This virtual device does not exist.'
    })
    return;
  }
  
  res.json(virtual_device);
})

// Create a new virtual device
router.post('/', async(req, res) => {
  // Verify the required params are present, except the ID which is generated dynamically.
  if (!req.body.name || !req.body.model_id) {
    res.status(400).json({
      error: 'missing_params',
      message: 'This endpoint requires a name and a model_id.'
    })
    logger.warn("vdev: rejecting creation of new vdev, missing params.")
    return;
  }
  
  // Generate new ID
  req.body.id = nanoid(8);
  
  // Verify the site exists
  const site = Site.findOne({id: req.params.site});
  if (!site) {
    res.status(400).json({
      error: 'invalid_site',
      message: 'The provided site does not exist.'
    })
    logger.warn("vdev: rejecting creation of new vdev, site doesn't exist.")
    return;
  }
  
  // Verify the model exists
  const model = await Model.findOne({id: req.body.model_id});
  if (!model) {
    res.status(400).json({
      error: 'invalid_model',
      message: 'No model exists with that ID.'
    })
    logger.warn("vdev: rejecting creation of new vdev, model doesn't exist.")
    return;
  }
  
  // Create the new device.
  req.body.site_id = req.params.site;
  const virtual_device = new VirtualDevice(req.body);
  await virtual_device.save();
  
  if (!virtual_device) {
    res.status(500).json({
      error: 'failed_to_create_virtual_device',
      message: 'Failed to create the virtual device.'
    })
    logger.error("vdev: Creation of the vdev failed.")
    return;
  }
  logger.info(`vdev: new virtual device created: ${virtual_device.id} - ${virtual_device.name} on site ${site.name}!`)

  res.json(virtual_device);
})

// Rename a vdevice or change its site.
router.patch('/:id', async(req, res) => {
  const virtual_device = await VirtualDevice.findOne({ id: req.params.id, site_id: req.params.site });
  if (!virtual_device) {
    res.status(400).json({
      error: 'invalid_virtual_device',
      message: 'This virtual device does not exist, or is not a member of this site.'
    })
    return;
  }
  
  // Rename the virtual device
  if (req.body.name) {
    logger.info(`vdev: virtual device ${virtual_device.id} renamed from ${virtual_device.name} to ${req.body.name}`)
    virtual_device.name = req.body.name;
  }
  
  // Save the changes
  await virtual_device.save();
  res.json(virtual_device);
  
  logger.info("vdev: device updates saved.")
})

// Delete a virtual device
router.delete('/:id', async(req, res) => {
  const virtual_device = VirtualDevice.findOne({ id: req.params.id, site_id: req.params.site });
  if (!virtual_device) {
    res.status(400).json({
      status: 'invalid_virtual_device',
      message: 'This virtual device does not exist, or does not belong to this site.'
    })
    return;
  }
  
  // Delete the virtual device.
  await VirtualDevice.deleteOne({ id: req.params.id });
  
  res.json({
    status: 'virtual_device_deleted',
    message: 'The virtual device was deleted successfully.'
  })
  
  logger.info(`vdev: virtual device delete: ${virtual_device.id}`)
})

export default router;