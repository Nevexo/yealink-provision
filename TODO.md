# Config Update Plan

- Change config.js routes to just return/create global config elements
- Add config fetching and setting routes to every type, such as device, site model.
  - These routes will fetch configuration groups and elements specific to that device
      Example: /api/devices/:id/config returns config elements with target_type device and target
      as the ID of the device.

  - Fetch groups of a device with GET /api/devices/:id/config
  - Create a new group with POST /api/deivces/:id/config/group/:name
  - Child groups can be created by adding more names to the path
    Example: POST /api/devices/:id/config/group/:name/:name
  - Fetch elements of a group with GET /api/devices/:id/config/group/:name/elements
  - Create a new element with POST /api/devices/:id/config/group/elements/:element_name
  - Fetch elements of a group with GET /api/devices/:id/config/group/:name

  - Fetch a specific element with GET /api/devices/id/config/group/:name/elements/:element_name
    Rememeber sub groups are added to the URL, so if you have a group with a sub group, you can
    fetch the element with GET /api/devices/id/config/group/:name/:name/elements/:element_name

  This replaces the current configuration method of adding everything in config.js
  And makes it easier to implement frontends.

## CLI To Do:
- Add configuration commands to other submenus.
- For example, device edit [name] config will edit the groups for this device.
- And likewise for sites, models.
- Global config will be done from the "global" submenu from the root.
- Configuration will be handled in devices/sites/models by entering "config" in the submenu.
- The config submenu is generic, and will have a further submenu for elements in the group.
- The config submenu will change its prompt based on where it is in the config tree.
- For example, if you type "config" in a device submenu, the prompt will start as
- `yealink-provision-device:DEVICENAME-config>` running `list` at this point will list
- all available groups and elements for this part of the tree (note that the parent cannot have elements)
- you can then enter `edit` with the ID of a group to move to that group. 
- The prompt then changes to `yealink-provision-device:DEVICENAME-config:GROUPNAME>`
- Running list at this stage shows elements for the current group, and any child groups of this group.
- Running `set [key] [value]` either creates a new element or updates an existing one.
- Running `delete [key]` deletes an element.
- Running `delete` without a key deletes the group (with confirmation) and moves to the previous group.
- Running `delete` on a group that has child groups will delete all child groups and elements.
