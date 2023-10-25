# Yealink Provision CLI - Virtual Device Editor
from .api import api_url

from .configEditor import ConfigCLI
from .model import get_model

import cmd2
import requests

class VirtualDevice:
    def __init__(self, site_id, id, name, model_id, remark, create_date):
        self.id = id
        self.name = name
        self.site_id = site_id
        self.model_id = model_id
        self.remark = remark
        self.create_date = create_date
        
    def rename(self, name):
        # Rename the virtual device.
        r = requests.patch(api_url + '/sites/' + self.site_id + '/virtual_devices/' + self.id, json={
            'name': name
        })
        
        if r.status_code == 200:
            self.name = name
            return True
        
        return False
    
    def delete(self):
        # Delete the virtual device
        r = requests.delete(api_url + '/sites/' + self.site_id + '/virtual_devices/' + self.id)
        
        if r.status_code == 200:
            return True
        
        return False
    
def create_virtual_device(site_id, name, model_id, remark):
    # Create the new vdev
    r = requests.post(api_url + '/sites/' + site_id + '/virtual_devices', json={
        'name': name,
        'model_id': model_id,
        'description': remark,
    })
    
    if r.status_code == 200:
        return VirtualDevice(site_id, r.json()['id'], name, model_id, remark, r.json()['create_date'])
    else:
        print(r.text)
        
    return None

def get_virtual_devices(site_id):
    # Get all vdevs within the site
    r = requests.get(api_url + '/sites/' + site_id + '/virtual_devices')
    
    if r.status_code == 200:
        vdevs = []
        for vdev in r.json():
            remark = vdev['description'] if 'description' in vdev else "N/A"
            vdevs.append(VirtualDevice(site_id, vdev['id'], vdev['name'], vdev['model_id'], remark, vdev['create_date']))
        return vdevs
    
    return None

def get_virtual_device(site_id, id):
    # Get a specific device within a site.
    r = requests.get(api_url + '/sites/' + site_id + '/virtual_devices/' + id)
    
    if r.status_code == 200:
        vdev = r.json()
        remark = vdev['description'] if 'description' in vdev else "N/A"
        return VirtualDevice(site_id, vdev['id'], vdev['name'], vdev['model_id'], remark, vdev['create_date'])
    else:
        print(f"vdev: failed to get vdev {r.json()['message']}")
    
    return None

class VirtualDeviceEditCLI(cmd2.Cmd):
    """Yealink Provision CLI - Virtual Device Editor"""
    prompt = 'site-vdev...> '
    
    def __init__(self, site, virtual_device):
        self.site = site
        self.vdev = virtual_device
        super().__init__()
        
        self.prompt = f"site({self.site.name})-vdev({self.vdev.name})> "
        
    def do_rename(self, args):
        """Rename the vdev"""
        if len(args) == 0:
            print("Error: no new name specified.")
            return
        
        if self.vdev.rename(args):
            print("Device renamed.")
            self.prompt = f"site({self.site.name})-vdev({self.vdev.name})> "
        else:
            print("error: failed to rename device.")
        
    def do_show(self, args):
        """Show the virtual device information"""
        print(f"ID: {self.vdev.id}")
        print(f"Name: {self.vdev.name}")
        print(f"Model ID: {self.vdev.model_id}")
        print(f"Remark: {self.vdev.remark}")
        print(f"Create Date: {self.vdev.create_date}")
        
    def do_delete(self, args):
        """Delete this device."""
        if self.vdev.delete():
            print("Device deleted.")
            return True
        else:
            print("Error: device delete failed.")
            
    def do_config(self, args):
        """Enter the virtual device configuration"""
        ConfigCLI("device", self.vdev.id, self.vdev.name).cmdloop()
    
    
class VirtualDeviceCLI(cmd2.Cmd):
    """Yealink Provision - Virtual Device Manager"""
    prompt = 'site-vdev...> '
    def __init__(self, site):
        self.site = site
        super().__init__()
        
        self.prompt = f"site({self.site.name})-vdev> "
    
    def do_show(self, args):
        """List all virtual devices."""
        vdevs = get_virtual_devices(self.site.id)
        if vdevs is None:
            print("Error: failed to get vdevs.")
            return
        
        print("ID\t\tName\t\tModel\t\tRemark\t\tCreate Date")
        for vdev in vdevs:
            print(vdev.id + "\t" + vdev.name + "\t" + get_model(vdev.model_id).name + "\t\t" + vdev.remark + "\t" + vdev.create_date)

    def do_edit(self, args):
        """Edit a device"""
        if len(args) == 0:
            print("Error: no virtual device specified.")
            return
        
        vdev = get_virtual_device(self.site.id, args)
        if vdev is None:
            print("Error: failed to get virtual device.")
            return
        
        VirtualDeviceEditCLI(self.site, vdev).cmdloop()
        
    def do_create(self, args):
        """Create a new vdev"""
        name = input("Name: ")
        model_id = input("Model ID: ")
        remark = input("Remark: ")
        
        vdev = create_virtual_device(self.site.id, name, model_id, remark)
        if vdev is None:
            print("Error: failed to create new virtual device.")
            return
        
        print("Device created, entering editor.")
        VirtualDeviceEditCLI(self.site, vdev).cmdloop()