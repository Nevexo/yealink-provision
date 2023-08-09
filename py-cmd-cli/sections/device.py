# Yealink Provision CLI - Device Editor
from .api import api_url

from .configEditor import ConfigCLI
from .model import get_model

import cmd2
import requests

class Device:
  def __init__(self, site_id, id, name, model_id, mac_address, remark, create_date):
    self.id = id
    self.name = name
    self.site_id = site_id
    self.model_id = model_id
    self.mac_address = mac_address
    self.remark = remark
    self.create_date = create_date

  def rename(self, name):
    # Rename the site
    r = requests.patch(api_url + '/sites/' + self.site_id + '/devices/' + self.id, json={'name': name})

    # Check if the request was successful
    if r.status_code == 200:
      self.name = name
      return True
    
    return False
  
  def delete(self):
    # Delete the site
    r = requests.delete(api_url + '/sites/' + self.site_id + '/devices/' + self.id)

    # Check if the request was successful
    if r.status_code == 200:
      return True
    
    return False
  
def create_device(site_id, name, mac, model_id, remark):
  # Create the site
  r = requests.post(api_url + '/sites/' + site_id + '/devices', json={
    'name': name,
    'mac_address': mac,
    'model_id': model_id,
    'remark': remark,
    'enable': True
  })

  # Check if the request was successful
  if r.status_code == 200:
    return Device(site_id, r.json()['id'], name, model_id, mac, remark, r.json()['create_date'])
  else:
    print(r.text)
  
  return None

def enable_device(site_id, id):
  # Enable the device
  r = requests.post(api_url + '/sites/' + site_id + '/devices/' + id + '/enable')

  # Check if the request was successful
  if r.status_code == 200:
    return True
  
  return False

def get_devices(site_id):
  # Get all sites
  r = requests.get(api_url + '/sites/' + site_id + '/devices')

  # Check if the request was successful
  if r.status_code == 200:
    devices = []
    for device in r.json():
      remark = device['remark'] if 'remark' in device else "N/A"
      devices.append(Device(site_id, device['id'], device['name'], device['model_id'], device['mac_address'], remark, device['create_date']))
    return devices
  
  return None

def get_device(site_id, id):
  # Get the device
  r = requests.get(api_url + '/sites/' + site_id + '/devices/' + id)

  # Check if the request was successful
  if r.status_code == 200:
    remark = r.json()['remark'] if 'remark' in r.json() else "N/A"
    return Device(site_id, r.json()['id'], r.json()['name'], r.json()['model_id'], r.json()['mac_address'], remark, r.json()['create_date'])
  
  return None

class DeviceEditCLI(cmd2.Cmd):
  """Yealink Provision CLI - Device Editor"""
  prompt = 'site-device...> '

  def __init__(self, site, device):
    self.site = site
    self.device = device
    super().__init__()

    self.prompt = f"site({self.site.name})-device({self.device.name})> "

  def do_name(self, args):
    """Rename the device"""
    if len(args) == 0:
      print("Error: No name specified")
      return
    
    if self.device.rename(args):
      print("Device renamed")
    else:
      print("Error: Failed to rename device")

  def do_show(self, args):
    """Show the device information"""
    print("ID: " + self.device.id)
    print("Name: " + self.device.name)
    print("MAC Address: " + self.device.mac_address)
    print("Model: " + get_model(self.device.model_id).name)
    print("Remark: " + self.device.remark)
    print("Create Date: " + self.device.create_date)

  def do_delete(self, args):
    """Delete the device"""
    if self.device.delete():
      print("Device deleted")
    else:
      print("Error: Failed to delete device")

  def do_enable(self, args):
    """Enable the device"""
    if enable_device(self.site.id, self.device.id):
      print("Device enabled")
    else:
      print("Error: Failed to enable device")

  def do_config(self, args):
    """Edit the device configuration"""
    ConfigCLI("device", self.device.id, self.device.name).cmdloop()

class DeviceCLI(cmd2.Cmd):
  """Yealink Provision CLI - Device Manager"""

  prompt = 'site-device...> '

  def __init__(self, site):
    self.site = site
    super().__init__()

    self.prompt = f"site({self.site.name})-device> "

  def do_list(self, args):
    """List all devices"""
    devices = get_devices(self.site.id)
    if devices is None:
      print("Error: Failed to get devices")
      return
    
    print("ID\t\tName\t\tMAC Address\t\tModel\t\tRemark\t\tCreate Date")
    for device in devices:
      print(device.id + "\t" + device.name + "\t" + device.mac_address + "\t" + get_model(device.model_id).name + "\t" + device.remark + "\t" + device.create_date)

  def do_edit(self, args):
    """Edit a device"""
    if len(args) == 0:
      print("Error: No device ID specified")
      return
    
    device = get_device(self.site.id, args)
    if device is None:
      print("Error: Failed to get device")
      return
    
    DeviceEditCLI(self.site, device).cmdloop()
  
  def do_create(self, args):
    """Create a device"""
    name = input("Name: ")
    mac = input("MAC Address (fmt. AABBCCDDEEFF): ")
    model_id = input("Model ID: ") # TODO: Make this interactive.
    remark = input("Remark: ")

    device = create_device(self.site.id, name, mac, model_id, remark)
    if device is None:
      print("Error: Failed to create device")
      return
    
    print("Device created")

    DeviceEditCLI(self.site, device).cmdloop()