// Mongoose Schema - Device Config Elements

// A device config element is a single configuration element that can be assigned to a device.
// It has a key/value pair that will be converted into a config file entry.
// Config elements require a list of group keys, which is used to determine the hierarchy of the config element.
// The config target_type specifies the type of target this configuration should apply to.
// The config target specifies the exact device that this configuration should apply to, if applicable.
// I.e., a global config element will have a target_type of global, and no target.

// TODO: Does not currently allow for config elements without a group (i.e., top level config elements)
// This isn't a problem for yealink-provision - but may not work with other vendors.

import mongoose from 'mongoose';
const { Schema } = mongoose;

import { logger } from '../../index.js';

import mergician from 'mergician';

export const deviceConfigElementSchema = new Schema({
  id: { type: String, required: true },
  key: { type: String, required: true },
  value: { type: String, required: true },
  group: { type: String, required: true },
  remark: { type: String, required: false },
  create_date: { type: Date, required: true, default: Date.now },
  published: { type: Boolean, required: true, default: false },
});

export const deviceConfigGroupSchema = new Schema({
  id: { type: String, required: true },
  parent_group: { type: String, required: false },
  name: { type: String, required: true },
  remark: { type: String, required: false },
  target_type: { type: String, required: true, enum: ['global', 'model', 'site', 'device', 'child'] },
  target: { type: String, required: false },
  create_date: { type: Date, required: true, default: Date.now },
  published: { type: Boolean, required: true, default: false },
});

export const DeviceConfigElement = mongoose.model('DeviceConfigElement', deviceConfigElementSchema);
export const DeviceConfigGroup = mongoose.model('DeviceConfigGroup', deviceConfigGroupSchema);

export const get_children_and_elements = async (group_id) => {
  // Get all elements in a group, including child groups,
  // include all group information.

  // Get the group
  const group = await DeviceConfigGroup.findOne({ id: group_id });
  if (!group) {
    return [];
  }

  // Add elements for the parent to the "elements" array
  group.elements = await DeviceConfigElement.find({ group: group_id }) || [];

  // Get all children recursively, as children may have children themselves, you'll need to use a recursive function.
  // Each child has a type of "child"
  // Resolve any elements in the group, and add them as "elements"
  const get_children = async (group_id) => {
    const children = await DeviceConfigGroup.find({ parent_group: group_id });
    if (!children) {
      return [];
    }

    let all_children = [];
    for (let child of children) {
      const child_elements = await DeviceConfigElement.find({ group: child.id }) || [];
      child.elements = child_elements;
      all_children.push(child);
      const child_children = await get_children(child.id);
      all_children = all_children.concat(child_children);
    }

    return all_children;
  }

  const children = await get_children(group_id);
  group.children = children;

  return group;
}

export const get_elements_by_group = async (group_id, ignore_unpublished = true) => {
  // Get all elements in a group, including child groups,
  // Don't add any group information.
  // As each child is enumerated, add it's elements to an array, with the name
  // being the name of the group. For example, if the groups are "account", "1" and the 
  // element key is "sip_server" then the object would be:
  // { account: { 1: { sip_server: 'sip.example.com' } } }

  // Take into account the published state, unless ignore_unpublished is true.

  // Get the group
  const group = await DeviceConfigGroup.findOne({ id: group_id });
  if (!group) {
    logger.debug(`get_elements_by_group: Group ${group_id} not found.`)
    return [];
  }

  if (ignore_unpublished && !group.published) {
    logger.debug(`get_elements_by_group: Group ${group_id} is unpublished, ignoring.`)
    return [];
  };

  // Add elements for the parent to the "elements" array on the parent.
  let elements = {
    [group.name]: {}
  };
  const parent_elements = await DeviceConfigElement.find({ group: group_id }) || [];
  for (let element of parent_elements) {
    if (element.published || !ignore_unpublished) {
      elements[group.name][element.key] = element.value;
    }
  }

  // Get all children recursively, as children may have children themselves, you'll need to use a recursive function.
  // Each child has a type of "child"
  // Resolve any elements in the group, and add them as "elements"
  const get_children = async (group_id) => {
    const children = await DeviceConfigGroup.find({ parent_group: group_id });
    if (!children) {
      logger.debug(`get_elements_by_group: No children found for group ${group_id}.`)
      return [];
    }

    let all_children = {};
    
    for (let child of children) {
      const child_elements = await DeviceConfigElement.find({ group: child.id }) || [];
      let child_elements_object = {};
      for (let element of child_elements) {
        if (element.published || !ignore_unpublished) {
          child_elements_object[element.key] = element.value;
        }
      }
      all_children[child.name] = child_elements_object;
      const child_children = await get_children(child.id);
      all_children[child.name] = Object.assign(all_children[child.name], child_children);
    }

    return all_children;
  };

  const children = await get_children(group_id);
  
  let children_elements = {};
  children_elements[group.name] = children;
  elements = mergician(elements, children_elements);

  return elements;
}