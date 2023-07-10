# Device interaction commands - yealink-provision
# Cameron Fleming 2023

import click
import requests
import os

# "Devices" command should alias to "device list"
# This command should accept --site, but it's optional.
@click.command()
@click.option("--site", type=str, help="Site ID to filter by.")
@click.pass_context
def devices(ctx, site):
  """List all devices."""
  if site == None:
    r = requests.get(ctx.obj + "/devices")
  else:
    r = requests.get(ctx.obj + "/devices?site=" + site)

  if r.status_code == 200:
    devices = r.json()
    for device in devices:
      # Display device ID, name and creation date with emojis and text.
      # Get name of model and site
      model = "N/A"
      site = "N/A"

      r = requests.get(ctx.obj + "/models/" + device["model_id"])
      if r.status_code == 200:
        model = r.json()["name"]
      
      r = requests.get(ctx.obj + "/sites/" + device["site_id"])
      if r.status_code == 200:
        site = r.json()["name"]

      click.echo(f"\U0001F4DE  {device['name']} ({device['id']}) - {model} - {site}")
  
  else:
    print("ERROR: " + str(r.status_code) + " - " + r.text)
  
@click.group()
def device():
  """Device """
  pass

# "device list" command should invoke devices
@device.command("list", help="List all devices.")
@click.option("--site", type=str, help="Site ID to filter by.")
@click.pass_context
def device_list(ctx, site):
  ctx.invoke(devices, site=site)

# "device info" command should invoke device_info
@device.command("info", help="Get info about a device.")
@click.argument("device_id", type=str)
@click.pass_context
def device_info(ctx, device_id):
  """Get info about a device."""
  r = requests.get(ctx.obj + "/devices/" + device_id)
  if r.status_code == 200:
    # Display the name (ID), site name, model name, MAC address, creation date, device password, publish status.
    # Site and model names will need to be requested separately.
    device = r.json()
    model = "N/A"
    site = "N/A"

    r = requests.get(ctx.obj + "/models/" + device["model_id"])
    if r.status_code == 200:
      model = r.json()["name"]

    r = requests.get(ctx.obj + "/sites/" + device["site_id"])
    if r.status_code == 200:
      site = r.json()["name"]

    pubilshed_state = "\U00002705 Published" if device["published"] else "\U0000274C  Not published"

    click.echo(f"\U0001F4DE  {device['name']} ({device['id']})")
    click.echo(f"\U0001F3E2  Site: {site} ({device['site_id']})")
    click.echo(f"\U0001F4F1  Model: {model} ({device['model_id']})")
    click.echo(f"\U0001F5A5   MAC: {device['mac_address']}")
    click.echo(f"\U0001F4C5  Created: {device['create_date']}")
    click.echo(f"\U0001F511  Password: {device['password']}")
    click.echo(f"\U0001F4E6  Published: {pubilshed_state}")

  else:
    print("ERROR: " + str(r.status_code) + " - " + r.text)

# "device create" command should invoke device_create
@device.command("create", help="Create a new device.")
@click.option("--name", prompt=True, help="Device name.")
@click.option("--model", prompt=True, help="Model ID.")
@click.option("--site", prompt=True, help="Site ID.")
@click.option("--mac", prompt=True, help="MAC address.")
@click.pass_context
def device_create(ctx, name, model, site, mac):
  """Create a new device."""
  r = requests.post(ctx.obj + "/devices", json={
    "name": name,
    "model_id": model,
    "site_id": site,
    "mac_address": mac
  })

  if r.status_code == 200:
    click.echo(f"\U00002705  Device created. ID: {r.json()['id']} - You probably want to publish it now, with 'device publish'")
    # Set the ID as an environment variable so we can use it later.
    os.environ["YEALINK_PROVISION_LAST_DEVICE_ID"] = r.json()["id"]
  else:
    print("ERROR: " + str(r.status_code) + " - " + r.text)

# Create publish command, check if device ID is set in environment variables, if not, prompt for it.
# If it does exist, prompt to confirm.
@device.command("publish", help="Publish a device.")
@click.option("--device", help="Device ID.")
@click.pass_context
def device_publish(ctx, device):
  """Publish a device."""
  if device == None:
    if "YEALINK_PROVISION_LAST_DEVICE_ID" in os.environ:
      device = os.environ["YEALINK_PROVISION_LAST_DEVICE_ID"]
      click.confirm(f"Publish last modified device {device}?", abort=True)
    else:
      device = click.prompt("Device ID")

  r = requests.post(ctx.obj + "/devices/" + device + "/publish")

  if r.status_code == 200:
    click.echo(f"\U00002705  Device published.")
  else:
    print("ERROR: " + str(r.status_code) + " - " + r.text)

# Create unpublish command, check if device ID is set in environment variables, if not, prompt for it.
# If it does exist, prompt to confirm.
@device.command("unpublish", help="Unpublish a device.")
@click.option("--device", help="Device ID.")
@click.pass_context
def device_unpublish(ctx, device):
  """Unpublish a device."""
  if device == None:
    if "YEALINK_PROVISION_LAST_DEVICE_ID" in os.environ:
      device = os.environ["YEALINK_PROVISION_LAST_DEVICE_ID"]
      click.confirm(f"Unpublish last modified device {device}?", abort=True)
    else:
      device = click.prompt("Device ID")

  r = requests.post(ctx.obj + "/devices/" + device + "/unpublish")

  if r.status_code == 200:
    click.echo(f"\U00002705  Device unpublished.")
  else:
    print("ERROR: " + str(r.status_code) + " - " + r.text)

# Delete a device, accept device_id as argument.
@device.command("delete", help="Delete a device.")
@click.argument("device_id", type=str)
@click.pass_context
def device_delete(ctx, device_id):
  """Delete a device."""
  r = requests.delete(ctx.obj + "/devices/" + device_id)

  if r.status_code == 200:
    click.echo(f"\U00002705  Device deleted.")
  else:
    print("ERROR: " + str(r.status_code) + " - " + r.text)

# Add a command that gets the configuration for this device, using the fetch module of the API.
@device.command("config", help="Fetch a device's configuration.")
@click.argument("device_id", type=str)
@click.pass_context
def config(ctx, device_id):
  """Fetch a device's configuration."""
  # Get device information first, as we need the MAC address.
  r = requests.get(ctx.obj + "/devices/" + device_id)
  if r.status_code == 200:
    device = r.json()
    # Now we can fetch the configuration.
    r = requests.get(ctx.obj + f"/fetch/device/{device['mac_address']}?authentication_mode=device_pw&username={device_id}&password={device['password']}")

    if r.status_code == 200:
      # Loop through the JSON object, displaying it as a tree, with icons and indentation.
      # Some objects may have multiple children, so we need to loop through them.
      print("Device Configuration Tree includes all settings, applied and overwritten in the following order:")
      print("Global, Model, Site, Device.\n\nConfig Tree:")
      def loop(obj, level):
        for key in obj:
          if isinstance(obj[key], dict):
            click.echo("  " * level + f"\U0001F4C1  {key}")
            loop(obj[key], level + 1)
          elif isinstance(obj[key], list):
            click.echo("  " * level + f"\U0001F4C1  {key}")
            for item in obj[key]:
              loop(item, level + 1)
          else:
            click.echo("  " * level + f"\U0001F4C4  {key}: {obj[key]}")

      loop(r.json()['config'], 0)
          
    else:
      print("ERROR: " + str(r.status_code) + " - " + r.text)

  else:
    print("ERROR: " + str(r.status_code) + " - " + r.text)