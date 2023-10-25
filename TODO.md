# Yealink-Provision To-Do List

- Web based UI

- Allow fetching configuration tree from any level.
- Full audit logging from devices and users (via cli/gui)
- IP address locking/provision windows.
- Duplicate configuration from another group
- Mirror configuration between devices (maybe via a virtual device that holds the config, and applies ahead of the physical?)
  - Mirrored configuation must not be simply duplicated, it must be "statically linked" from the original device.
  - The mirrored configuration should come between the site layers, and the physical device. I.e., a mirroed configuration
  should clobber settings set on the site, but not settings set on the final device.
- Virtual Device - a device which doesn't have a MAC address etc and is only used to mirror configuartion to physical devices.
  This could also be "configuration template" that can either be duplicated in place, or mirroed.
  Virtual devices are assigned to sites but should be displayed seperately in the frontend.

## Configuration Abstraction Layer
Add some form of configuration helper service that can offer suggested configurations or convert between
Yealink configuration terms into their numbers within the configuation spec.

I.e., linekey type 16 is "BLF" and type 13 is "speeddial"

The abstraction service would be requested by the frontend application based on the model name, the abstraction
service would then return the known configuration elements, such as:

```json
{
  "device_meta": {
    "model_name": "SIP T-42U",
    "model_vendor_name": "Yealink"
  },
  "config_spec": [
  {
    "friendly_name": "Line Key Group",
    "config_name": "linekey",
    "remark": "Line key group, can contain any number of line keys that will appear on the phone, they will be paginated based on the number of available linekeys on the phone.",
    "type": "group_only",
    "requied_children": [],
    "optional_children": [
        {
          "friendly_name": "Line Key",
          "type": "group_only_numbered",
          "remark": "Line key defintion - a group which contains the specific config values for a linekey. Required to be an incrementing number.",
          "required_children": [
          {
            "friendly_name": "Line Key Label",
            "config_name": "label",
            "remark": "Text displayed on the phone's linekey. NOTE: Some displays may not be wide enough to display the full string.",
            "type": "free_string",
            "default_value": "Line"
          },
          {
            "friendly_name": "Line Key Type",
            "config_name": "type",
            "remark": "Specifies the type of linekey to use, such as a speeddial button, or BLF lamp.",
            "type": "number",
            "supported_values": [{"config_value": 16, "friendly_name": "BLF"}, {"config_value": 13, "friendly_name": "Speed Dial"}],
            "default_value": 16,
          }
          ],
          "optional_children": [
          {
            "friendly_name": "Line Key Value",
            "config_name": "value",
            "remark": "The value for this linekey, only applies to specific types of key.",
            "type": "free_string",
            "default_value": "1001"
          },
          {
            "friendly_name": "Line Key Extension",
            "config_name": "extension",
            "remark": "The extension to use for this linekey, only applies to specific types of linekey.",
            "type": "free_string",
            "default_value": "1001"
          },
          {
            "friendly_name": "Line Key Line",
            "config_name": "line",
            "remark": "The line to use when this linekey is pressed. Only applies to specific types of linekey, usually 1 in a single-line configuration.",
            "type": "free_string",
            "default_value": 1
          }
          ]
        }
      ]
    }
  ]
}
```

These files will be saved in the repository with the name of the model applied with them.
The frontend will request the abstraction information for the model on demand, using a model ID from yealink-provision API.

The abstraction service will then request the model name and vendor from the provisioning API, and attempt to find a matching abstraction
configuration from its datastore.

The frontend can then use this abstraction layer to guide the user through configuration, or retroactively render the information
on the existing configuration, to make it easier for the end-user to decipher.

The abstraction service is not necessary, and frontends should safely handle it's absence.