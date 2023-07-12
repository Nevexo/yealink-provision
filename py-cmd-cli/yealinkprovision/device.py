import requests

from .api import api_url

class Device:
  def __init__(self, 
               id,
               name,
               site_id,
               mac_address,
               password,
               model_id,
               inherit_site_config,
               inherit_model_config,
               inherit_global_config,
               description,
               create_date,
               published):
    self.id = id
    self.name = name
    self.site_id = site_id
    self.mac_address = mac_address
    self.password = password
    self.model_id = model_id
    self.inherit_site_config = inherit_site_config
    self.inherit_model_config = inherit_model_config
    self.inherit_global_config = inherit_global_config
    self.description = description
    self.create_date = create_date
    self.published = published

  def rename(self, name):
    # Rename the device
    r = requests.patch(api_url + '/devices/' + self.id, json={'name': name})

    # Check if the request was successful
    if r.status_code == 200:
      self.name = name
      return True
    
    return False
  
  def publish(self):
    # Publish the device
    r = requests.post(api_url + '/devices/' + self.id + '/publish')

    # Check if the request was successful
    if r.status_code == 200:
      self.published = True
      return True
    
    return False
  
  def unpublish(self):
    # Unpublish the device
    r = requests.delete(api_url + '/devices/' + self.id + '/publish')

    # Check if the request was successful
    if r.status_code == 200:
      self.published = False
      return True
    
    return False
  
  def delete(self):
    # Delete the device
    r = requests.delete(api_url + '/devices/' + self.id)

    # Check if the request was successful
    if r.status_code == 200:
      return True
    
    return False
  
def create_device(name, site_id, mac_address, model_id, description):
  # Create the device
  r = requests.post(api_url + '/devices', json={'name': name, 'site_id': site_id, 'mac_address': mac_address, 'model_id': model_id, 'description': description})

  # Check if the request was successful
  if r.status_code == 200:
    return Device(
      id=r.json()['id'],
      name=r.json()['name'],
      site_id=r.json()['site_id'],
      mac_address=r.json()['mac_address'],
      password=r.json()['password'],
      model_id=r.json()['model_id'],
      inherit_site_config=r.json()['inherit_site_config'],
      inherit_model_config=r.json()['inherit_model_config'],
      inherit_global_config=r.json()['inherit_global_config'],
      description=r.json()['description'],
      create_date=r.json()['create_date'],
      published=r.json()['published']
    )
  
  print(r.json())

  return False

def get_devices():
  # Get the devices
  r = requests.get(api_url + '/devices')

  # Check if the request was successful
  if r.status_code == 200:
    devices = []
    for device in r.json():
      description = device['description'] if 'description' in device else "N/A"
      devices.append(Device(
        id=device['id'],
        name=device['name'],
        site_id=device['site_id'],
        mac_address=device['mac_address'],
        password=device['password'],
        model_id=device['model_id'],
        inherit_site_config=device['inherit_site_config'],
        inherit_model_config=device['inherit_model_config'],
        inherit_global_config=device['inherit_global_config'],
        description=description,
        create_date=device['create_date'],
        published=device['published']
      ))

    return devices
  return False

def get_devices_site(site_id):
  # Get the devices
  r = requests.get(api_url + '/devices?site=' + site_id)

  # Check if the request was successful
  if r.status_code == 200:
    devices = []
    for device in r.json():
      description = device['description'] if 'description' in device else "N/A"
      devices.append(Device(
        id=device['id'],
        name=device['name'],
        site_id=device['site_id'],
        mac_address=device['mac_address'],
        password=device['password'],
        model_id=device['model_id'],
        inherit_site_config=device['inherit_site_config'],
        inherit_model_config=device['inherit_model_config'],
        inherit_global_config=device['inherit_global_config'],
        description=description,
        create_date=device['create_date'],
        published=device['published']
      ))

    return devices
  
  return False

def get_device(id):
  # Get the device
  r = requests.get(api_url + '/devices/' + id)

  # Check if the request was successful
  if r.status_code == 200:
    description = r.json()['description'] if 'description' in r.json() else "N/A"
    return Device(
      id=r.json()['id'],
      name=r.json()['name'],
      site_id=r.json()['site_id'],
      mac_address=r.json()['mac_address'],
      password=r.json()['password'],
      model_id=r.json()['model_id'],
      inherit_site_config=r.json()['inherit_site_config'],
      inherit_model_config=r.json()['inherit_model_config'],
      inherit_global_config=r.json()['inherit_global_config'],
      description=description,
      create_date=r.json()['create_date'],
      published=r.json()['published']
    )
  
  return False