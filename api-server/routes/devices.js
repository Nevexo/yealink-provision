// yealink-provision - Device Management API
// Cameron Fleming 2023

// These endpoints are used to manage Yealink Devices within yealink-provision.

import { customAlphabet } from 'nanoid';
import { Router } from 'express';

import { Device } from '../mongo/schemas/device.js';
import { Site } from '../mongo/schemas/site.js';
import { Model } from '../mongo/schemas/model.js';

import { logger } from '../index.js';

// Setup nanoid
const nanoid = customAlphabet('1234567890abcdef', 8);

const router = Router({ mergeParams: true });

// This router expects to be behind a site ID, (i.e., /sites/:id/devices/:id)
// So any "all" lookups should be done at the site level, not globally.

// Get all devices
router.get('/', async (req, res) => {
  let devices;
  devices = await Device.find({ site_id: req.params.site });
  res.json(devices);
})

// Get a specific device
router.get('/:id', async (req, res) => {
  const device = await Device.findOne({ id: req.params.id, site_id: req.params.site });
  if (!device) {
    res.status(404).json({
      error: 'Not Found',
      message: `Device not found`,
    })
    return;
  }

  res.json(device);
})

// Create a new device
router.post('/', async (req, res) => {
  // Verify required elements are present, except ID which is generated by nanoid.
  if (!req.body.name || !req.body.model_id, !req.body.mac_address) {
    res.status(400).json({
      error: 'missing_params',
      message: 'The request body must contain a name, mac_address, and model_id property',
    })
    return;
  }

  // Generate a new ID
  req.body.id = nanoid(8);

  // Generate a password
  req.body.password = nanoid(32);

  // Verify the site exists
  const site = await Site.findOne({ id: req.params.site });
  if (!site) {
    res.status(400).json({
      error: 'invalid_site',
      message: 'The site provided does not exist',
    })
    return;
  }

  // Verify the model exists
  const model = await Model.findOne({ id: req.body.model_id });
  if (!model) {
    res.status(400).json({
      error: 'invalid_model',
      message: 'The model_id provided does not exist',
    })
    return;
  }

  // Verify MAC address not already present
  const device_mac_check = await Device.findOne({ mac_address: req.body.mac_address });
  if (device_mac_check) {
    res.status(400).json({
      error: 'mac_address_in_use',
      message: 'The mac_address provided is already in use',
    })
    return;
  }

  // Create the new device
  req.body.site_id = req.params.site; // Bit of a hack.
  const device = new Device(req.body);
  await device.save();
  res.json(device);

  logger.info(`Created new device, ID: ${req.body.id}, name: ${req.body.name}, mac: ${req.body.mac_address}`);
});

// Rename a device or change its site.
router.patch('/:id', async (req, res) => {
  const device = await Device.findOne({ id: req.params.id, site_id: req.params.site });
  if (!device) {
    res.status(404).json({
      error: 'not_found',
      message: `Device not found`,
    })
    return;
  }

  // Rename device
  if (req.body.name) {
    device.name = req.body.name;
  }

  // Change site
  if (req.params.site) {
    device.site_id = req.params.site;
  }

  // Save the device
  await device.save();
  res.json(device);

  logger.info(`Updated device, ID: ${device.id}`);
});

// Enable a device
router.post('/:id/enable', async (req, res) => {
  const device = await Device.findOne({ id: req.params.id });
  if (!device) {
    res.status(404).json({
      error: 'not_found',
      message: `Device not found`,
    })
    return;
  }

  // enable the device
  device.enable = true;

  // Save the device
  await device.save();
  res.json(device);

  logger.info(`Enabled device, ID: ${device.id}, name: ${device.name}, mac: ${device.mac_address}`);
});

// Disable a device
router.delete('/:id/enable', async (req, res) => {
  const device = await Device.findOne({ id: req.params.id, site_id: req.params.site });
  if (!device) {
    res.status(404).json({
      error: 'not_found',
      message: `Device not found`,
    })
    return;
  }

  // Disable the device
  device.enable = false;

  // Save the device
  await device.save();
  res.json(device);

  logger.info(`Disabled device, ID: ${device.id}`);
});

// Delete a device
router.delete('/:id', async (req, res) => {
  const device = await Device.findOne({ id: req.params.id, site_id: req.params.site });
  if (!device) {
    res.status(404).json({
      error: 'not_found',
      message: `Device not found`,
    })
    return;
  }

  // Delete the device
  await Device.deleteOne({ id: req.params.id });

  res.json({
    status: 'device_deleted',
    message: `Device ${req.params.id} has been deleted`,
  })

  logger.info(`Deleted device, ID: ${device.id}`)
});

export default router;