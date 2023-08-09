// yealink-provision - Config API
// Cameron Fleming 2023

import { customAlphabet } from 'nanoid';
import { Router } from 'express';
import { EventEmitter } from 'events';

// Setup nanoid
const nanoid = customAlphabet('1234567890abcdef', 8);

// Create event emitter
export const configEmitter = new EventEmitter();

import { logger } from '../index.js';
import { Element } from '../mongo/schemas/config.js';
import { Group } from '../mongo/schemas/group.js';
import { Site } from '../mongo/schemas/site.js'; 

const router = Router({ mergeParams: true });

// This API is expected to be downstream of a "target" (i.e., /sites/:id/groups/name*/config)
// The calls must check the type of target they're expecting, so for example if a request arrives
// as /device/:target_id/groups/name* - the resolver needs to find groups with a target_type of 'device' and id matching
// the target_id param.
// Should expect target_type, target_id and path* from the upstream.

const get_group_by_id = async (id) => {
  // Get a group from the database and return it's JSON schema.
  const group = await Group.findOne({ id: id });

  if (!group) {
    return false;
  }
  
  return group;
}

const resolve_group = async (target_type, target_id, name) => {
  // Get a group from the database and return it's JSON schema.
  logger.debug(`resolve_group: attempting to find group with target_type: ${target_type}, target_id: ${target_id}, name: ${name}`)
  const group = await Group.findOne({ target_type: target_type, target_id: target_id, name: name });

  if (!group) {
    return false;
  }

  logger.debug(`resolve_group: found ${target_type}/${target_id}/${name}!`)
  return group;
}

const resolve_config_element = async (group_id, path) => {
  // Get a config element from the database and return it's JSON schema.
  logger.debug(`resolve_config_element: attempting to find element with group_id: ${group_id}, name: ${path}`)
  const element = await Element.findOne({ group_id: group_id, name: path });

  if (!element) {
    return false;
  }

  return element;
}

const resolve_children_of_group = async (group_id) => {
  // Includes groups and elements, that are children of the specified group.
  const child_groups = await Group.find({ target_type: "group", target_id: group_id });
  const child_elements = await Element.find({ group_id: group_id });

  return { groups: child_groups, elements: child_elements };
}

const recursive_resolve = async (target_type, target_id, path) => {
  // Recursively resolve a config path, all items of the path are groups
  // except the last item which is a config element.
  // Though it's possible the path has no element at the end.
  // Return an array with all groups, and the element (if one is present.)
  // Use the target_type and target_id to resolve the first group, all subsequent groups
  // will have a target_type of 'group' and a target_id of the previous group's ID.

  // Split the path into an array
  const path_array = path.split('/');

  // Resolve the first group
  const first_group = await resolve_group(target_type, target_id, path_array[0]);

  if (!first_group) {
    logger.debug("recursive_resolve: first group not found, rest of path is invalid.");
    return false;
  }

  // If there's only one item in the path, return the group.
  if (path_array.length == 1) {
    return [first_group];
  }

  // Resolve the child groups, once the final group is reached, attempt to resolve it as
  // a config element, though if it's not found, resolve as a group instead.

  // Create an array to store the groups
  const groups = [first_group];

  // Loop through the path array, resolve all middle groups, skipping the first and last items
  // This is only possible if there are more than 2 items in the path.
  if (path_array.length > 2) {
    logger.debug(`recursive_resolve: path_array.length > 2 (${path_array.length}), resolving intermediate groups.`)
    for (let i = 1; i < path_array.length - 1; i++) {
      logger.debug(`recursive_resolve: resolving group ${i} of ${path_array.length - 1}; name: ${path_array[i]}`)
  
      // Get the group by name, using the target_id of the previous group
      const group = await resolve_group('group', groups[i - 1].id, path_array[i]);
  
      if (!group) {
        logger.debug("recursive_resolve: intermediate group not found, rest of path is invalid.");
        return false;
      }
  
      logger.debug("recursive_resolve: found group: " + JSON.stringify(group));
  
      groups.push(group);
    }
  }
  
  // Get the last group
  const last_group = groups[groups.length - 1];

  // Attempt to resolve the last group as a config element
  logger.debug(`recursive_resolve: attempting to resolve last group as config element: ${last_group.id}/${path_array[path_array.length - 1]}`)
  const element = await resolve_config_element(last_group.id, path_array[path_array.length - 1]);

  if (element) {
    // If the element exists, add it to the array
    logger.debug(`recursive_resolve: found config element: ${JSON.stringify(element)}`)
    groups.push(element);
  } else {
    logger.debug(`recursive_resolve: was not a config element, attempting to resolve last group as group: ${last_group.id}/${path_array[path_array.length - 1]}`)
    // Attempt to resolve as group instead
    const group = await resolve_group('group', last_group.id, path_array[path_array.length - 1]);

    if (!group) {
      logger.debug("recursive_resolve: last group not found, rest of path is still valid.");
    } else {
      groups.push(group);
    }
  }

  logger.debug("recursive_resolve: returning groups: " + JSON.stringify(groups));
  return groups;
}

// Get config element/group. This is determined automatically. Must resolve all parents.
// Names are unique to the target_type/target_id combination.
// For example site/xyxy could have a group called "account" and so could device/xyxy.
// But site/xyxy/account and device/xyxy/account are different groups.
router.get('/*', async (req, res) => {
  logger.debug("router: call to GET /*, invoking recursive_resolve against " + req.params.target_type + "/" + req.params.target_id + "/" + req.params[0]);
  const groups = await recursive_resolve(req.params.target_type, req.params.target_id, req.params[0]);

  if (!groups) {
    logger.debug("router: recursive_resolve returned false, returning 404.");
    return res.status(404).send();
  }

  // If the last item in the array is an element, return it.
  if (groups[groups.length - 1].value) {
    logger.debug("router: recursive_resolve returned an element, returning 200.");
    return res.status(200).send(groups[groups.length - 1]);
  }

  // Otherwise, check the last group matches the one requested, by the name of the latest item in the path
  if (groups[groups.length - 1].name == req.params[0].split("/")[req.params[0].split("/").length - 1]) {
    logger.debug("router: recursive_resolve returned a group, matching name of request, getting child elements/groups.");

    // Get all child elements/groups
    const children = await resolve_children_of_group(groups[groups.length - 1].id);

    return res.status(200).send({
      group: groups[groups.length - 1],
      children: children
    });
  }

  // Otherwise, return 404.
  logger.debug("router: recursive_resolve returned a group, not matching name of request, returning 404.");
  return res.status(404).send();
})

// Create a new config element/group, assume group unless "value" is specified, then assume element.
// All parents, if any, must be resolved. If there is only one item in the path, it must be a group
// And it's target_type and target_id should match that from the URL.
// Otherwise, for children, the target_type should be group and the target_id should be the ID of the
// parent, from the resolver.
router.post('/*', async (req, res) => {
  logger.debug("router: call to POST /*, invoking recursive_resolve against " + req.params.target_type + "/" + req.params.target_id + "/" + req.params[0]);
  const groups = await recursive_resolve(req.params.target_type, req.params.target_id, req.params[0]);

  const path = req.params[0].split("/")

  // If there are more than one items in the path, there must be items in the group, if there are no items
  // reject the request as 404, with a JSON message explaining this.
  if (path.length > 1) {
    // There are multiple items in the path, so there must already be at least one parent group.
    // These should've been resolved by recursive_resolve, so if the array is empty, return 404.
    if (!groups) {
      logger.debug("router: recursive_resolve returned false, returning 404.");
      return res.status(404).json({ message: "No parent group found." });
    }

    // Otherwise, ensure all but the last item in the path are groups that exist in the database.
    // For example, if path is /account/1/sip, then "account" and "1" must exist.
    // Iterate over path to check all the groups are in the groups array.
    for (let i = 0; i < path.length - 1; i++) {
      if (groups[i].name != path[i]) {
        logger.debug("router: recursive_resolve returned false, returning 404.");
        return res.status(404).json({ message: "One or more of the parent groups could not be found." });
      }
    }

    // Check if the last item in the path is the element we're trying to create.
    // If it is, return 409.
    if (groups[groups.length - 1].name == path[path.length - 1]) {
      logger.debug("router: recursive_resolve returned false, returning 409.");
      return res.status(409).json({ message: "An element OR group with this name already exists." });
    }

    // If the JSON body contains "value" then this is an element, otherwise it's a group.
    // Create a new element if "value" is present.
    if (req.body.value) {
      // Create a new element
      logger.debug(`router: post*: creating new configuration element from path above.`)
      const element = new Element({
        id: nanoid(8),
        group_id: groups[groups.length - 1].id,
        value: req.body.value,
        name: path[path.length - 1],
        enable: req.body.enable || true
      });

      // Save the element
      await element.save();

      // Return the element
      return res.status(201).json(element);
    } else {
      // No value specified, create a new group with the parent as the previous group in the path.
      logger.debug(`router: post*: creating new group from path above, name: ${path[path.length - 1]}, target_id: ${groups[groups.length - 1].id}`)

      const group = new Group({
        id: nanoid(8),
        target_type: 'group',
        target_id: groups[groups.length - 1].id,
        name: path[path.length - 1],
        enable: req.body.enable || true
      });

      // Save the group
      await group.save();

      // Return the group
      return res.status(201).json(group);
    }

  } else {
    // There is only one item in the path, so this must be a group.
    // Check if the group already exists, if not, create it. The target_type and id should be 
    // that from the URL params.

    // Check if the group already exists
    if (groups.length > 0) {
      // The group already exists, return 409
      logger.debug("router: recursive_resolve returned false, returning 409.");
      return res.status(409).json({ message: "Group already exists." });
    }

    // Create a new group
    logger.debug(`router: post*: creating new group from path above, this is a root group.`)

    if (!['model', 'site', 'device'].includes(req.params.target_type)) {
      logger.debug(`router: create_new_group: aborting, invalid target_type: ${req.params.target_type}.`)
      return res.status(400).json({ message: "Invalid target_type." });
    }

    const group = new Group({
      id: nanoid(8),
      target_type: req.params.target_type,
      target_id: req.params.target_id,
      name: path[path.length - 1],
      enable: req.body.enable || true
    });

    // Save the group
    await group.save();

    // Return the group
    return res.status(201).json(group);
  }
});

// Change the value of an element.
router.patch('/*', async (req, res) => {
  logger.debug(`router: request to PATCH /* path ${req.params[0]}.`);

  if (!req.body.value) {
    // Value is required, fail request.
    logger.debug(`router: request to PATCH /* path ${req.params[0]} failed, no value specified.`);
    return res.status(400).json({ message: "New value is required." });
  }

  const groups = await recursive_resolve(req.params.target_type, req.params.target_id, req.params[0]);

  // If there are no groups, return 404.
  if (!groups) {
    logger.debug("router: recursive_resolve returned false, returning 404.");
    return res.status(404).send();
  }

  // If there are groups, but the last group doesn't match the last item in the path, return 404.
  if (groups[groups.length - 1].name != req.params[0].split("/")[req.params[0].split("/").length - 1]) {
    logger.debug("router: recursive_resolve returned a group, not matching name of request, returning 404.");
    return res.status(404).json({ message: "Element not found." });
  }

  // If the JSON body contains "value" then this is an element, otherwise it's a group.
  // If it's not an element, return 404.
  const element = groups[groups.length - 1];
  if (!element.value) {
    logger.debug("router: recursive_resolve returned an element, returning 404.");
    return res.status(404).json({ message: "Element not found." });
  }

  // Update the element
  logger.debug(`router: patch*: updating element ${element.id} with new value ${req.body.value}.`)
  element.value = req.body.value;
  element.enable = req.body.enable || true;

  // Save the element
  await element.save();

  // Return the element
  return res.status(200).json(element);
})

// Delete an element/group, determined automatically by the existance of "value"
router.delete('/*', async (req, res) => {
  logger.debug(`router: request to DELETE /* path ${req.params[0]}.`);

  const groups = await recursive_resolve(req.params.target_type, req.params.target_id, req.params[0]);

  // If there are no groups, return 404.
  if (!groups) {
    logger.debug("router: recursive_resolve returned false, returning 404.");
    return res.status(404).send();
  }

  // If there are groups, but the last group doesn't match the last item in the path, return 404.
  if (groups[groups.length - 1].name != req.params[0].split("/")[req.params[0].split("/").length - 1]) {
    logger.debug("router: recursive_resolve returned a group, not matching name of request, returning 404.");
    return res.status(404).json({ message: "Element/group not found." });
  }

  // If the JSON body contains "value" then this is an element, otherwise it's a group.
  // Delete accordingly.

  // If it's an element, delete it.
  if (groups[groups.length - 1].value) {
    logger.debug(`router: delete*: deleting element ${groups[groups.length - 1].id}.`)
    await Element.deleteOne({ id: groups[groups.length - 1].id })
    return res.status(200).send();
  } else {
    // If it's a group, check for any children.
    const child_groups = await Group.find({ target_type: 'group', target_id: groups[groups.length - 1].id });
    const child_elements = await Element.find({ group_id: groups[groups.length - 1].id });

    if (child_groups.length > 0 || child_elements.length > 0) {
      // There are children, return 409.
      logger.debug(`router: delete*: group ${groups[groups.length - 1].id} has children, returning 409.`)
      return res.status(409).json({ message: "Group has children." });
    }

    logger.debug(`router: delete*: deleting group ${groups[groups.length - 1].id}`)
    await Group.deleteOne({ id: groups[groups.length - 1].id })

    // Return 200
    return res.status(200).send();
  }
});

export default router;