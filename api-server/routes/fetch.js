// yealink-provision - Fetch API
// Cameron Fleming 2023

// This router contains routes fetched by the provisioning server to get device configuration information.
// It splits the configuration elements into a hierarchy of configuratin in JSON.

import { Router } from 'express';
import { Element } from '../mongo/schemas/config.js';
import { Group } from '../mongo/schemas/group.js';
import { Device } from '../mongo/schemas/device.js';
import { Site } from '../mongo/schemas/site.js';
import { Model } from '../mongo/schemas/model.js';
import { EventEmitter } from 'events';

import mergician from 'mergician';

// Create event emitter
export const fetchEmitter = new EventEmitter();

import { logger } from '../index.js';

export const router = Router({ mergeParams: true });

const get_children_object = async (root_id) => {
  // Get all children for the root_id, store them in a JSON object that
  // that has parent.children = [{child}] etc.
  // Include elements in the group as "elements"

  let tree = {};

  const child_groups = await Group.find({ target_type: "group", target_id: root_id });
  const child_elements = await Element.find({ group_id: root_id });

  // Add the elements to the tree
  tree.elements = child_elements;
  tree.children = [];

  // Recursively add the children of the groups to the tree
  for (const child_group of child_groups) {
    tree['children'][child_group.name] = await get_children_object(child_group.id);
  }

  return tree;
}

const get_json_structure = async (group_element_tree) => {
  // Recursively build a JSON structure from the group_element_tree. Only uses the group name/element name as the key.
  // If an element has a value, it is stored as the value of the key.
  // Each group should beocme a JSON object, each element should become a key/value pair. Some groups may be empty.

  let json_structure = {};

  // Add the elements to the json_structure
  for (const element of group_element_tree.elements) {
    json_structure[element.name] = element.value;
  }

  // Recursively add the children of the groups to the json_structure
  const downstream_children = group_element_tree.children;
  for (const [group_name, group_element_tree] of Object.entries(downstream_children)) {
    json_structure[group_name] = await get_json_structure(group_element_tree);
  }

  return json_structure;
}

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
  logger.debug(`fetch: fetching configuration for device ${req.params.mac} with authentication mode ${authentication_mode}`)
  const device = await Device.findOne({ mac_address: req.params.mac });
  if (!device) {
    logger.debug("Aborting, mac address not in database.")
    res.status(404).json({
      error: 'not_found',
      message: 'No device with that MAC address was found',
    })
    return;
  }
  
  if (!device.enable) {
    logger.debug("Aborting, device not enabled..")
    res.status(403).json({
      error: 'forbidden',
      message: 'Device is not enabled.',
    })

    fetchEmitter.emit('audit_device_fetch', device, {
      result: 'fail',
      reason: 'device_not_enabled',
      message: "Attempt to fetch configuration for disabled device."
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

  logger.debug("fetch: Authentication successful, validating site")

  if (!site.enable) {
    logger.debug("Aborting, site not enabled.")
    res.status(403).json({
      error: 'forbidden',
      message: 'Site is not enabled',
    })

    fetchEmitter.emit('audit_device_fetch', device, {
      result: 'fail',
      reason: 'site_not_enabled',
      message: "Attempt to fetch configuration for device with disabled site."
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

  logger.debug("fetch: Authentication successful, building configuration.")

  // Build a JSON schema of the configuration, for example: {"account": {"1": {"password": "test"}}}
  // This requires resolving all groups for the target_type, then finding all children, and finally all elements
  // noting that some parents may have elements assigned to them.
  // Do this in the order of global, model, site, device.
  // Overwrite as we go.

  // Fetch all parent configuration groups for all target_types that affect this device.
  // This includes a target to the model_id, a target to the site_id and a target for the device itself.
  // Apply these in order, overwriting as we go.

  // Get model configuration groups, their children and any elements assigned to them.
  // This must be done recursively, as groups may have children, and children may have children.
  // Elements can be assigned to any of the groups, and some groups may have elements and child groups.

  let config_tree = {};

  // Get all model configuration groups.
  logger.debug(`fetch: config_builder: get model config groups for ${model.name} (${model.id})`)
  const model_config_root_groups = await Group.find({ target_type: "model", target_id: model.id });

  // Get elements and children for each root group.
  let model_config_tree = {};
  for (const model_config_root_group of model_config_root_groups) {
    const root_children = await get_children_object(model_config_root_group.id);
    
    // Build configuration JSON structure from the root children.
    model_config_tree[model_config_root_group.name] = await get_json_structure(root_children);
  }

  // Get site configuration groups, their children and any elements assigned to them.
  logger.debug(`fetch: config_builder: get site config groups for ${site.name} (${site.id})`)
  const site_config_root_groups = await Group.find({ target_type: "site", target_id: site.id });

  let site_config_tree = {};
  for (const site_config_root_group of site_config_root_groups) {
    const root_children = await get_children_object(site_config_root_group.id);

    // Build configuration JSON structure from the root children.
    site_config_tree[site_config_root_group.name] = await get_json_structure(root_children);
  }

  // Get device configuration groups, their children and any elements assigned to them.
  logger.debug(`fetch: config_builder: get device config groups for ${device.id} (${device.id})`)
  const device_config_root_groups = await Group.find({ target_type: "device", target_id: device.id });

  let device_config_tree = {};
  for (const device_config_root_group of device_config_root_groups) {
    const root_children = await get_children_object(device_config_root_group.id);

    // Build configuration JSON structure from the root children.
    device_config_tree[device_config_root_group.name] = await get_json_structure(root_children);
  }

  // Merge the three configuration trees together, overwriting as we go.
  // This is done in the order of model, site, device.

  // Merge model and site.
  const model_site_config_tree = mergician(model_config_tree, site_config_tree);

  // Merge model+site and device.
  config_tree = mergician(model_site_config_tree, device_config_tree);

  console.log("=============")
  console.dir(config_tree);

  res.json({
    site: site,
    device: device,
    model: model,
    config: config_tree,
  })

  fetchEmitter.emit('audit_device_fetch', device, {
    result: 'success',
    reason: "auth_ok_config_present",
    message: "Successfully fetched configuration for device."
  });

  logger.debug("router: configuration sent successfully, done.")
});

export const fetchRouter = router;