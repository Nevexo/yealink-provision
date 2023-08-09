# Yealink CLI - Site Editor
from .api import api_url

from .configEditor import ConfigCLI
from .device import DeviceCLI

import cmd2
import requests

class Site:
  def __init__(self, id, name, remark, create_date, password):
    self.id = id
    self.name = name
    self.remark = remark
    self.create_date = create_date
    self.password = password

  def rename(self, name):
    # Rename the site
    r = requests.patch(api_url + '/sites/' + self.id, json={'name': name})

    # Check if the request was successful
    if r.status_code == 200:
      self.name = name
      return True
    
    return False
  
  def delete(self):
    # Delete the site
    r = requests.delete(api_url + '/sites/' + self.id)

    # Check if the request was successful
    if r.status_code == 200:
      return True
    
    return False
  
def create_site(name, remark):
  # Create the site
  r = requests.post(api_url + '/sites', json={'name': name, 'remark': remark, 'enable': true})

  # Check if the request was successful
  if r.status_code == 200:
    return Site(r.json()['id'], name, remark, r.json()['create_date'], r.json()['password'])
  
  return None

def get_sites():
  # Get all sites
  r = requests.get(api_url + '/sites')

  # Check if the request was successful
  if r.status_code == 200:
    sites = []
    for site in r.json():
      remark = site['remark'] if 'remark' in site else "N/A"
      sites.append(Site(site['id'], site['name'], remark, site['create_date'], site['password']))
    return sites
  
  return None

def enable_site(id):
  # Enable the site
  r = requests.post(api_url + '/sites/' + id + "/enable")

  # Check if the request was successful
  if r.status_code == 200:
    return True
  
  return False

def get_site(id):
  # Get the site
  r = requests.get(api_url + '/sites/' + id)

  # Check if the request was successful
  if r.status_code == 200:
    remark = r.json()['remark'] if 'remark' in r.json() else "N/A"
    return Site(r.json()['id'], r.json()['name'], remark, r.json()['create_date'], r.json()['password'])
  
  return None

class SiteEditCLI(cmd2.Cmd):
  """Yealink CLI - Site Editor"""
  prompt = 'site...> '

  def __init__(self, site):
    super().__init__()
    self.site = site
    self.prompt = 'site(' + site.name + ')> '


  def do_name(self, args):
    """Rename the site"""
    if self.site.rename(args):
      print('Site Renamed Successfully')
      self.prompt = 'site(' + self.site.name + ')> '
    else:
      print('Site Rename Failed')

  def do_password(self, args):
    """View the Site password"""
    print('Site Password: ' + self.site.password)

  def do_delete(self, arg):
    """Delete the site"""
    if self.site.delete():
      print('Site Deleted Successfully')
      return True
    else:
      print('Site Deletion Failed')
      return False
  
  def do_devices(self, args):
    """List all devices in this site"""
    device = DeviceCLI(self.site)
    device.cmdloop()

  def do_enable(self, arg):
    """Enable the site"""
    if enable_site(self.site.id):
      print('Site Enabled Successfully')
    else:
      print('Site Enable Failed')

  def do_config(self, arg):
    """Edit the site config"""
    config = ConfigCLI("site", self.site.id, self.site.name)
    config.cmdloop()

  def do_exit(self, arg):
    """Exit the CLI"""
    return True

class SiteCLI(cmd2.Cmd):
  """Yealink CLI - Site Management"""
  prompt = 'site> '

  def __init__(self):
    super().__init__()

  def do_create(self, arg):
    """Create a new site"""
    name = input('Site Name: ')
    remark = input('Site remark: ')
    site = create_site(name, remark)
    if site:
      print('Site Created Successfully')
    else:
      print('Site Creation Failed')

  def do_list(self, arg):
    """List all sites"""
    sites = get_sites()
    if sites:
      print('ID\t\tName\t\tremark\t\tCreated')
      for site in sites:
        print(f'{site.id}\t{site.name}\t{site.remark}\t{site.create_date}')
    else:
      print('Failed to get sites')

  def do_edit(self, args):
    """Edit a site"""
    if len(args) == 0:
      print("Please specify a site ID")
      return
    site = get_site(args)
    if site == None:
      print("Failed to get model")
      return
    site_edit = SiteEditCLI(site)
    site_edit.cmdloop()
  
  def do_exit(self, arg):
    """Exit the CLI"""
    return True

  def do_quit(self, arg):
    """Exit the CLI"""
    return True

  def do_EOF(self, arg):
    """Exit the CLI"""
    return True