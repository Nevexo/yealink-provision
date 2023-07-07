// yealink-provision - Config API
// Cameron Fleming 2023

import { nanoid } from 'nanoid';
import { Router } from 'express';
import { EventEmitter } from 'events';


import { DeviceConfigElement, DeviceConfigGroup } from '../mongo/schemas/config.js';
import { Device } from '../mongo/schemas/device.js';
import { Site } from '../mongo/schemas/site.js';
import { Model } from '../mongo/schemas/model.js';

import { logger } from '../index.js';

const router = Router();

// Create event emitter
export const configEmitter = new EventEmitter();

// Get all configuration groups, sort them by parents and children, and return them.
// I.e., the first level should be any groups without parent_id specified
// and each parent should have its children in a children array.
// Some children may be parents themselves, and should be sorted in the same way.

export const get_groups = async (group_id = null) => {
  // If group_id is specified then get groups that have that group_id as their parent, or id themselves.
  let groups = [];
  if (group_id) {
    groups = await DeviceConfigGroup.find({ $or: [{ id: group_id }, { parent_group: group_id }] });
  } else {
    groups = await DeviceConfigGroup.find();
  }

  // Get all groups without a parent, unless the group has children with its ID as their parent, but only if group_id is not specified.
  let parents = [];
  if (group_id) {
    parents = groups.filter(group => !group.parent_group || groups.filter(child => child.parent_group == group.id).length > 0);
  } else {
    parents = groups.filter(group => !group.parent_group);
  }
  // Get all groups with a parent.
  let children = groups.filter(group => group.parent_group);

  // Recursively resolve children.
  // Do this asynchonously, so the values are returned in time.
  async function resolveChildren(parents) {
    // For each parent, get its children.
    // If the parent has no children, just return the parent.

    for (let i = 0; i < parents.length; i++) {
      const parent = parents[i]._doc;
      logger.debug(`Resolving children of parent ${parent.id}`)
      // Get all children of this parent.
      const childrenOfParent = children.filter(child => child.parent_group == parent.id);
      // Resolve the children of this parent.
      parent.children = await resolveChildren(childrenOfParent);

      // Add config elements for this child
      parent.config_elements = await DeviceConfigElement.find({ group_id: parent.id });

      // Return the parent.
      parents[i] = parent;

      logger.debug(`parent has ${parent.children.length} children.`)
    }
    
    logger.debug("done!!")
    return parents;
  }

  // Resolve the children of the parents.
  const resolved_groups = await resolveChildren(parents)

  return resolved_groups;
}

router.get('/groups', async (req, res) => {
  // Recursively get all groups.
  // Then reoslve their children and sort them into a "children" array.
  // Do the same for children's children. This is recursive.

  const resolved_groups = await get_groups();
  res.json(resolved_groups);
});

// Get a configuration group by ID, return any of it's children, by looking up any 
// configuration groups with it's ID as their parent_id.
router.get('/group/:id', async (req, res) => {
  // Check the group exists
  const group = await DeviceConfigGroup.findOne({ id: req.params.id });
  if (!group) {
    res.status(404).json({
      error: 'not_found',
      message: 'Group not found',
    })
    return;
  }

  // Check if this group has any children.
  // If it doesn't, just return the group.
  // TODO: This is quite inefficent, we're making two database calls.
  const children = await DeviceConfigGroup.find({ parent_group: req.params.id });
  if (children.length == 0) {
    res.json(group);
    return;
  }

  // If it does, get the children, and return them in a children array.
  const reoslved_groups = await get_groups(req.params.id);
  res.json(reoslved_groups);
});

// Create a new configuration group, if parent_id is specified, ensure the group exists.
router.post('/group', async (req, res) => {
  // Ensure required properties exist, those are name, and type.
  if (!req.body.name || !req.body.type) {
    res.status(400).json({
      error: 'bad_request',
      message: 'Missing required properties',
    })
    return;
  }

  // Ensure type is valid, out of global,site,model,device
  if (!['global', 'site', 'model', 'device', 'child'].includes(req.body.type)) {
    res.status(400).json({
      error: 'bad_request',
      message: 'Invalid type',
    })
    return;
  }

  // Ensure the target is specified if not global.
  if (req.body.type != 'global' && req.body.type != 'child') {
    if (!req.body.target) {
      res.status(400).json({
        error: 'bad_request',
        message: 'Missing target',
      })
      return;
    }
  }

  // Ensure parent_group is specified if type is child.
  if (req.body.type == 'child') {
    if (!req.body.parent_group) {
      res.status(400).json({
        error: 'bad_request',
        message: 'Missing parent_group',
      })
      return;
    }
  }

  if (req.body.type != 'child') {
    if (req.body.parent_group) {
      res.status(400).json({
        error: 'bad_request',
        message: 'Parent group is only valid for child groups',
      })
      return;
    }
  }

  // Ensure the target exists, unless it's global.
  switch (req.body.type) {
    case 'site':
      if (await Site.findOne({ id: req.body.target }) == null) {
        res.status(400).json({
          error: 'bad_request',
          message: 'Site does not exist',
        })
        return;
      }
      break;

    case 'model':
      if (await Model.findOne({ id: req.body.target }) == null) {
        res.status(400).json({
          error: 'bad_request',
          message: 'Model does not exist',
        })
        return;
      }
      break;

    case 'device':
      if (await Device.findOne({ id: req.body.target }) == null) {
        res.status(400).json({
          error: 'bad_request',
          message: 'Device does not exist',
        })
        return;
      }
      break;

    case 'child':
      // Type isn't required for this.
      // TODO: Handler possibly required?
      break;

    case 'global':
      // Type isn't required for this.
      break;

    default:
      logger.error("Hit default on type switch, possible misconfiguration!!")
      res.status(400).json({
        error: 'bad_request',
        message: 'Invalid type',
      })  
      break;
  }

  // Ensure parent group exists if specified
  if (req.body.parent_group) {
    const parent = await DeviceConfigGroup.findOne({ id: req.body.parent_group }) == null
    if (parent) {
      res.status(400).json({
        error: 'bad_request',
        message: 'Parent group does not exist',
      })
      return;
    }

    // If the parent has elements, abort.
    const parent_elements = DeviceConfigElement.find({ group: req.body.parent_group });
    if (parent_elements.length > 0) {
      res.status(400).json({
        error: 'bad_request',
        message: 'Parent group has elements, cannot create child group',
      })
      return;
    }
  }

  // Ensure group does not already exist for the target.
  // TODO: Check safety here.
  if (req.body.type != 'global' && req.body.type != 'child') {
    if (await DeviceConfigGroup.findOne({ name: req.body.name, target: req.body.target }) != null) {
      res.status(400).json({
        error: 'bad_request',
        message: 'Group already exists for target',
      })
      return;
    }
  }

  // Create the group
  const group = new DeviceConfigGroup({
    id: nanoid(8),
    name: req.body.name,
    target_type: req.body.type,
    target: req.body.target || null,
    parent_group: req.body.parent_group || null,
    remark: req.body.remark || null,
    published: req.body.auto_publish || false,
  });

  // Save the group
  await group.save();

  // Emit the event
  configEmitter.emit('group_created', group);

  logger.info(`New configuration group created, id: ${group.id}, name: ${group.name}, target: ${group.target}, parent_group: ${group.parent_group}`)

  // Return the group
  res.json(group);
});

// Delete a configuration group by ID.
router.delete('/group/:id', async (req, res) => {
  // Check the group exists
  const group = await DeviceConfigGroup.findOne({ id: req.params.id });
  if (!group) {
    res.status(404).json({
      error: 'not_found',
      message: 'Group not found',
    })
    return;
  }

  // Check the group has no children
  // const children = await DeviceConfigGroup.find({ parent_group: req.params.id });
  // if (children.length > 0) {
  //   res.status(400).json({
  //     error: 'bad_request',
  //     message: 'Group has children',
  //   })
  //   return;
  // }

  // Delete the group
  await group.deleteOne({ id: req.params.id });

  // Emit the event
  configEmitter.emit('group_deleted', group);

  res.sendStatus(204);
});

// Publish a group
router.post('/group/:id/publish', async (req, res) => {
  // Check the group exists
  const group = await DeviceConfigGroup.findOne({ id: req.params.id });
  if (!group) {
    res.status(404).json({
      error: 'not_found',
      message: 'Group not found',
    })
    return;
  }

  // If the group has a parent, ensure it's published.
  if (group.parent_group) {
    const parent = await DeviceConfigGroup.findOne({ id: group.parent_group });
    if (!parent.published) {
      res.status(400).json({
        error: 'bad_request',
        message: 'Parent group is not published',
      })
      return;
    }
  }

  // Publish the group
  group.published = true;
  await group.save();

  // Emit the event
  configEmitter.emit('group_published', group);

  logger.debug(`Published group ${group.id}`)

  res.sendStatus(204);
});

// Unpublish a group
router.delete('/group/:id/publish', async (req, res) => {
  // Check the group exists
  const group = await DeviceConfigGroup.findOne({ id: req.params.id });
  if (!group) {
    res.status(404).json({
      error: 'not_found',
      message: 'Group not found',
    })
    return;
  }

  // Automatically unpublish all children
  const children = await DeviceConfigGroup.find({ parent_group: req.params.id });
  for (const child of children) {
    logger.debug(`Unpublishing child group ${child.id}`)
    child.published = false;
    await child.save();

    // Emit the event
    configEmitter.emit('group_unpublished', child);
  }

  // Unpublish the group
  group.published = false;
  await group.save();

  // Emit the event
  configEmitter.emit('group_unpublished', group);

  logger.debug(`Unpublished group ${group.id}`)

  res.sendStatus(204);
});

// Get config elements for a group
router.get('/group/:id/elements', async (req, res) => {
  // Check the group exists
  const group = await DeviceConfigGroup.findOne({ id: req.params.id });
  if (!group) {
    res.status(404).json({
      error: 'not_found',
      message: 'Group not found',
    })
    return;
  }

  // Get the elements
  const elements = await DeviceConfigElement.find({ group: req.params.id });

  res.json(elements);
});

// Create a config element
router.post('/group/:id/elements', async (req, res) => {
  // Ensure the required fields are present
  if (!req.body.key || !req.body.value) {
    res.status(400).json({
      error: 'bad_request',
      message: 'Missing required fields',
    })
    return;
  }

  // Check the group exists
  const group = await DeviceConfigGroup.findOne({ id: req.params.id });
  if (!group) {
    res.status(404).json({
      error: 'not_found',
      message: 'Group not found',
    })
    return;
  }

  // // Ensure the group doesn't have any elements
  // if (await DeviceConfigElement.findOne({ group: req.params.id }) != null) {
  //   res.status(400).json({
  //     error: 'bad_request',
  //     message: 'Group already has elements',
  //   })
  //   return;
  // }

  // Check the element doesn't already exist
  if (await DeviceConfigElement.findOne({ group: req.params.id, key: req.body.key }) != null) {
    res.status(400).json({
      error: 'bad_request',
      message: 'Element already exists for group',
    })
    return;
  }

  // Create the element
  const element = new DeviceConfigElement({
    id: nanoid(8),
    group: req.params.id,
    key: req.body.key,
    value: req.body.value,
    remark: req.body.remark || null,
    published: req.body.auto_publish || false,
  });

  // Save the element
  await element.save();

  // Emit the event
  configEmitter.emit('element_created', element);

  logger.info(`New configuration element created, id: ${element.id}, key: ${element.key}, value: ${element.value}, group: ${element.group}`)

  // Return the element
  res.json(element);
});

// Change a config element's value
router.patch('/group/:id/elements/:key_id', async (req, res) => {
  // Ensure the required fields are present
  if (!req.body.value) {
    res.status(400).json({
      error: 'bad_request',
      message: 'Missing required fields',
    })
    return;
  }

  // Check the group exists
  const group = await DeviceConfigGroup.findOne({ id: req.params.id });
  if (!group) {
    res.status(404).json({
      error: 'not_found',
      message: 'Group not found',
    })
    return;
  }

  // Check the element exists
  const element = await DeviceConfigElement.findOne({ group: req.params.id, id: req.params.key_id });
  if (!element) {
    res.status(404).json({
      error: 'not_found',
      message: 'Element not found',
    })
    return;
  }

  // Update the element
  element.value = req.body.value;

  // Save the element
  await element.save();

  // Emit the event
  configEmitter.emit('element_updated', element);

  logger.info(`Configuration element updated, id: ${element.id}, key: ${element.key}, value: ${element.value}, group: ${element.group}`)

  // Return the element
  res.json(element);
});

// Publish a config element
router.post('/group/:id/elements/:key_id/publish', async (req, res) => {
  // Check the group exists
  const group = await DeviceConfigGroup.findOne({ id: req.params.id });
  if (!group) {
    res.status(404).json({
      error: 'not_found',
      message: 'Group not found',
    })
    return;
  }

  // Ensure the group is published
  if (!group.published) {
    res.status(400).json({
      error: 'bad_request',
      message: 'Group is not published',
    })
    return;
  }

  // Check the element exists
  const element = await DeviceConfigElement.findOne({ group: req.params.id, id: req.params.key_id });
  if (!element) {
    res.status(404).json({
      error: 'not_found',
      message: 'Element not found',
    })
    return;
  }

  // Publish the element
  element.published = true;

  // Save the element
  await element.save();

  // Emit the event
  configEmitter.emit('element_published', element);

  logger.debug(`Published element ${element.id}`)

  res.sendStatus(204);
});

// Unpublish a config element
router.delete('/group/:id/elements/:key_id/publish', async (req, res) => {
  // Check the group exists
  const group = await DeviceConfigGroup.findOne({ id: req.params.id });
  if (!group) {
    res.status(404).json({
      error: 'not_found',
      message: 'Group not found',
    })
    return;
  }

  // Check the element exists
  const element = await DeviceConfigElement.findOne({ group: req.params.id, id: req.params.key_id });
  if (!element) {
    res.status(404).json({
      error: 'not_found',
      message: 'Element not found',
    })
    return;
  }

  // Unpublish the element
  element.published = false;

  // Save the element
  await element.save();

  // Emit the event
  configEmitter.emit('element_unpublished', element);

  logger.debug(`Unpublished element ${element.id}`)

  res.sendStatus(204);
});

// Delete a config element
router.delete('/group/:id/elements/:key_id', async (req, res) => {
  // Check the group exists
  const group = await DeviceConfigGroup.findOne({ id: req.params.id });
  if (!group) {
    res.status(404).json({
      error: 'not_found',
      message: 'Group not found',
    })
    return;
  }

  // Check the element exists
  const element = await DeviceConfigElement.findOne({ group: req.params.id, id: req.params.key_id });
  if (!element) {
    res.status(404).json({
      error: 'not_found',
      message: 'Element not found',
    })
    return;
  }

  // Delete the element
  await DeviceConfigElement.deleteOne({ group: req.params.id, id: req.params.key_id });
  
  // Emit the event
  configEmitter.emit('element_deleted', element);

  logger.info(`Configuration element deleted, id: ${element.id}, key: ${element.key}, value: ${element.value}, group: ${element.group}`)

  res.sendStatus(204);
});

export default router;