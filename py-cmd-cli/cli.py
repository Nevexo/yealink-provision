# Python cmd2-based CLI tool for yealink-provision
# Cameron Fleming 2023

import cmd2

from yealinkprovision import site, device, model, config

class ConfigElementCLI(cmd2.Cmd):
  """Modify or delete a configuration element within a group."""
  prompt = '(yealink-provision-config-PENDING) '

  def __init__(self, element, group_path):
    super().__init__()
    self.group_path = group_path
    self.prompt = f'(yealink-provision-config-edit:{self.group_path}.{element.name}) '

  def do_info(self, arg):
    """Display element information"""
    self.poutput(f"\n=== {self.group_path}.{self.element.name} ===")
    self.poutput(f"ID: {self.element.id}")
    self.poutput(f"Upstream Group ID: {self.element.group_id}")
    self.poutput(f"Key: {self.element.key}")
    self.poutput(f"Value: {self.element.value}")
    self.poutput(f"Published: {self.element.published}")
    self.poutput(f"Created: {self.element.create_date}\n")

  def do_set(self, arg):
    """Set element properties"""
    # Split the arguments
    args = arg.split(' ')

    # Check if the arguments are valid
    if len(args) != 2:
      self.poutput('Invalid arguments')
      return

    # Set the property
    if args[0] == 'value':
      r = self.element.change_value(args[1])
      if not r:
        self.poutput('Error changing value')
        return
    else:
      self.poutput('Invalid property')

  def do_publish(self, arg):
    """Publish the element"""
    r = self.element.publish()
    if not r:
      self.poutput('Error publishing element')
      return

  def do_unpublish(self, arg):
    """Unpublish the element"""
    r = self.element.unpublish()
    if not r:
      self.poutput('Error unpublishing element')
      return
    
  def do_delete(self, arg):
    """Delete the element"""
    r = self.element.delete()
    if not r:
      self.poutput('Error deleting element')
    else:     
      return True

class ConfigGroupChildCLI(cmd2.Cmd):
  """Modify or delete a child group within a parent group."""
  prompt = '(yealink-provision-config-CHILD_PENDING) '

  def __init__(self, group, parent_group, group_path):
    super().__init__()
    self.group = group
    self.group_path = group_path
    self.parent_group = parent_group
    self.prompt = f'(yealink-provision-config-edit:{self.group_path}.{self.group.name}) '

  def do_info(self, arg):
    """Display group information"""
    self.poutput(f"\n=== {self.group_path}.{self.group.name} ===")
    self.poutput(f"ID: {self.group.id}")
    self.poutput(f"Parent Group ID: {self.group.parent_group}")
    self.poutput(f"Published: {self.group.published}")
    self.poutput(f"Created: {self.group.create_date}\n")

  def do_publish(self, arg):
    """Publish the group"""
    r = self.group.publish()
    if not r:
      self.poutput('Error publishing group')
      return
    
  def do_unpublish(self, arg):
    """Unpublish the group"""
    r = self.group.unpublish()
    if not r:
      self.poutput('Error unpublishing group')
      return
    
  def do_delete(self, arg):
    """Delete the group"""
    r = self.group.delete()
    if not r:
      self.poutput('Error deleting group')
    else:     
      return True
    
  create_child_argparser = cmd2.Cmd2ArgumentParser()
  create_child_argparser.add_argument('name', help='Name of the child group')
  create_child_argparser.add_argument('-r', '--remark', help='Description for child group', default=None, required=False)

  @cmd2.with_argparser(create_child_argparser)
  def do_create(self, args):
    """Create a child group"""
    r = self.group.create_child(args.name, args.remark)
    if not r:
      self.poutput('Error creating child group')
      return
    
    # Launch the child group CLI
    child_cli = ConfigGroupChildCLI(r, self.group, f'{self.group_path}.{r.name}')
    child_cli.cmdloop()

  def do_children(self, arg):
    """List child groups"""
    r = self.group.get_children()
    if not r:
      self.poutput('Error getting child groups')
      return

    for child in r:
      self.poutput(f'{child.id} - {self.group_path}.{child.name}')

  def do_child(self, arg):
    """Modify/delete a child group"""
    # Split the arguments
    args = arg.split(' ')

    # Check if the arguments are valid
    if len(args) != 1:
      self.poutput('Invalid arguments')
      return

    # Get the child group
    r = self.group.get_child(args[0])
    if not r:
      self.poutput('Error getting child group')
      return

    # Launch the child group CLI
    child_cli = ConfigGroupChildCLI(r, self.group, f'{self.group_path}.{r.name}')
    child_cli.cmdloop()

  def do_elements(self, arg):
    """List elements"""
    r = self.group.get_elements()
    if not r:
      self.poutput('Error getting elements')
      return

    self.poutput(f'\n=== {self.group_path} elements ===')
    for element in r:
      self.poutput(f'{element.id} - {element.key} - VALUE: {element.value}')

  def do_element(self, arg):
    """Modify/delete an element"""
    # Split the arguments
    args = arg.split(' ')

    # Check if the arguments are valid
    if len(args) != 1:
      self.poutput('Invalid arguments')
      return

    # Get the element
    r = self.group.get_element(args[0])
    if not r:
      self.poutput('Error getting element')
      return

    # Launch the element CLI
    element_cli = ConfigElementCLI(r, self.group, f'{self.group_path}.{self.group.name}')
    element_cli.cmdloop()

class ConfigGroupCLI(cmd2.Cmd):
  """Modify or delete a configuration group, as well as manage child elements."""
  prompt = '(yealink-provision-config-PENDING) '

  def __init__(self, group):
    super().__init__()
    self.group = group
    
    # Resolve the name of the target.
    target_name = ""
    if self.group.target_type == 'site':
      target_name = site.get_site(self.group.target).name
    elif self.group.target_type == 'device':
      target_name = device.get_device(self.group.target).name
    elif self.group.target_type == 'model':
      target_name = device.get_device(self.group.target).name
    elif self.group.target_type == 'global':
      target_name = 'global'
    else:
      print("UNKNOWN TARGET ON CONFIG GROUP, DROPPING OUT.")
      return
    
    if target_name == 'global':
      target_path = f'{self.group.target_type}'
    else:
      target_path = f'{self.group.target_type}.{target_name}'

    self.path = f'{target_path}.{self.group.name}'
    self.prompt = f'(yealink-provision-config-edit:{self.path}) '

  def do_info(self, arg):
    """Display group information"""
    self.poutput(f"\n=== {self.group.name} ===")
    self.poutput(f"ID: {self.group.id}")
    self.poutput(f"Parent Group ID: {self.group.parent_group}")
    self.poutput(f"Published: {self.group.published}")
    self.poutput(f"Created: {self.group.create_date}\n")

  def do_publish(self, arg):
    """Publish the group"""
    r = self.group.publish()
    if not r:
      self.poutput('Error publishing group')
      return
    
  def do_unpublish(self, arg):
    """Unpublish the group"""
    r = self.group.unpublish()
    if not r:
      self.poutput('Error unpublishing group')
      return
    
  def do_delete(self, arg):
    """Delete the group"""
    confirm = input('Are you sure you want to delete this group? (y/N) ')
    if confirm.lower() != 'y':
      return
    
    r = self.group.delete()
    if not r:
      self.poutput('Error deleting group')
    else:     
      return True

  def do_children(self, arg):
    """List child groups"""
    # TODO: This is bodged due to an API limitation
    r = config.get_config_group_children(self.group.id)
    if len(r) == 0:
      self.poutput('No Children')
      return
    
    if not r:
      self.poutput('Error getting child groups')
      return

    for child in r:
      self.poutput(f'{child.id} - {self.path}.{child.name}')

  def do_child(self, arg):
    """Modify/delete a child group"""
    # Split the arguments
    args = arg.split(' ')

    # Check if the arguments are valid
    if len(args) != 1:
      self.poutput('Invalid arguments')
      return

    # Get the child group
    r = self.group.get_child(args[0])
    if not r:
      self.poutput('Error getting child group')
      return

    # Launch the child group CLI
    child_cli = ConfigGroupChildCLI(r, self.group, f'{self.path}.{r.name}')
    child_cli.cmdloop()

  def do_elements(self, arg):
    """List elements"""
    r = self.group.get_elements()
    if not r:
      self.poutput('Error getting elements')
      return

    self.poutput(f'\n=== {self.group.name} elements ===')
    for element in r:
      self.poutput(f'{element.id} - {element.key} - VALUE: {element.value}')

  def do_element(self, arg):
    """Modify/delete an element"""
    # Split the arguments
    args = arg.split(' ')

    # Check if the arguments are valid
    if len(args) != 1:
      self.poutput('Invalid arguments')
      return

    # Get the element
    r = self.group.get_element(args[0])
    if not r:
      self.poutput('Error getting element')
      return

    # Launch the element CLI
    element_cli = ConfigElementCLI(r, self.group, f'{self.group.name}')
    element_cli.cmdloop()

class ConfigCLI(cmd2.Cmd):
  """Manage configuration groups."""
  prompt = '(yealink-provision-config) '

  def __init__(self):
    super().__init__()

  def do_groups(self, arg):
    """List configuration groups"""
    g = config.get_config_groups()
    if not g:
      self.poutput('Error getting configuration groups')
      return

    self.poutput('\n=== Configuration Groups (Parents Only) ===')
    # Display all groups, sorted by target_type, and then target.
    # For example, all groups for target_type 'account' will be displayed together.
    # Followed by all groups for target_type 'account_list' together.

    # Get all target_types, and then the targets within.
    # This should be a 2D array where the first element is the target_type, and the second is a list of targets.
    target_types = []
    for group in g:
      if group.target_type not in target_types:
        # Find all targets with this type
        targets = []
        for group2 in g:
          if group2.target_type == group.target_type:
            if group2.target not in targets:
              if group2.target not in targets:
                targets.append(group2.target)

        target_types.append([group.target_type, targets])

    # Display the groups, sorted by target_type, and then target.
    # Resolve the target by using the relevant API call.
    # For example, "device" targets should use device.get_device() to get the device name.

    # Sort the target_types
    target_types.sort(key=lambda x: x[0])

    # Display the groups
    for tt in target_types:
      target_type = tt[0]
      targets = tt[1]

      for target in targets:
        # Resolve target name, using the relevant API call
        if target_type == 'device':
          r = device.get_device(target)
          if not r:
            self.poutput('Error getting device')
            return
          target_name = r.name
        elif target_type == 'site':        
          r = site.get_site(target)
          if not r:
            self.poutput('Error getting site')
            return
          target_name = r.name
        elif target_type == 'model':
          r = model.get_model(target)
          if not r:
            self.poutput('Error getting model')
            return
          target_name = r.name
      
      if target_type == "global":
        path = target_type
      else:        
        path = f'{target_type}.{target_name}'

      # Display all groups for this target
      #self.poutput(f'{group.id} - {path}.{group.name}')
      for group in g:
        if group.target == target:
          self.poutput(f'{group.id} - {path}.{group.name}')

  def do_edit(self, arg):
    """Modify/delete a configuration group, as well as manage child elements."""
    # Split the arguments
    args = arg.split(' ')

    # Check if the arguments are valid
    if len(args) != 1:
      self.poutput('Invalid arguments')
      return

    # Get the group
    r = config.get_config_group(args[0])
    if not r:
      self.poutput('Error getting configuration group')
      return

    # Launch the group CLI
    group_cli = ConfigGroupCLI(r)
    group_cli.cmdloop()



class DeviceDetailCLI(cmd2.Cmd):
  """Modify/delete a device"""
  prompt = '(yealink-provision-device-edit) '

  def __init__(self, device):
    super().__init__()
    self.device = device
    self.prompt = f'(yealink-provision-device-edit:{self.device.name}) '

  def do_info(self, arg):
    """Display device information"""
    self.poutput(f"\n=== {self.device.name} ===")
    self.poutput(f"ID: {self.device.id}")
    self.poutput(f"Site ID: {self.device.site_id}")
    self.poutput(f"MAC Address: {self.device.mac_address}")
    self.poutput(f"Password: {self.device.password}")
    self.poutput(f"Model ID: {self.device.model_id}")
    self.poutput(f"Inherit Site Config: {self.device.inherit_site_config}")
    self.poutput(f"Inherit Model Config: {self.device.inherit_model_config}")
    self.poutput(f"Inherit Global Config: {self.device.inherit_global_config}")
    self.poutput(f"Description: {self.device.description}")
    self.poutput(f"Published: {self.device.published}")
    self.poutput(f"Created: {self.device.create_date}\n")

  def do_set(self, arg):
    """Set device properties"""
    # Split the arguments
    args = arg.split(' ')

    # Check if the arguments are valid
    if len(args) != 2:
      self.poutput('Invalid arguments')
      return

    # Set the property
    if args[0] == 'name':
      r = self.device.rename(args[1])
      if not r:
        self.poutput('Error renaming device')
        return
    else:
      self.poutput('Invalid property')

  def do_publish(self, arg):
    """Publish the device"""
    # Publish the device
    r = self.device.publish()
    if not r:
      self.poutput('Error publishing device')
      return

  def do_unpublish(self, arg):
    """Unpublish the device"""
    # Unpublish the device
    r = self.device.unpublish()
    if not r:
      self.poutput('Error unpublishing device')
      return

  def do_delete(self, arg):
    """Delete the device"""
    # Confirm
    confirm = input('Are you sure you want to delete this device? (y/N) ')
    if confirm.lower() != 'y':
      return
    
    r = self.device.delete()
    if not r:
      self.poutput('Error deleting device')
      return

    return True
  
class DeviceCLI(cmd2.Cmd):
  """Yealink Provision Devices CLI"""
  prompt = '(yealink-provision-devices) '

  def __init__(self):
    super().__init__()
    self.prompt = '(yealink-provision-devices) '

  list_argparser = cmd2.Cmd2ArgumentParser()
  list_argparser.add_argument('-s', '--site', help='Filter by site ID', required=False)

  @cmd2.with_argparser(list_argparser)
  def do_list(self, arg):
    """List all devices"""
    # Get the devices
    if (arg.site):
      devices = device.get_devices_site(arg.site)
    else:
      devices = device.get_devices()

    # Display the devices
    if len(devices) == 0:
      self.poutput('No devices found')
      return
    
    for d in devices:
      model_name = model.get_model(d.model_id).name
      site_name = site.get_site(d.site_id).name
      self.poutput(f"{d.id} - {d.name} - SITE: {site_name} ({d.site_id}) - MAC: {d.mac_address} - MODEL: {model_name} ({d.model_id}) - CREATED: {d.create_date}")

  def do_edit(self, arg):
    """View details of a device"""
    # Get the device
    d = device.get_device(arg)
    if d == None:
      self.poutput('Device not found')
      return

    # Open the device detail CLI
    cli = DeviceDetailCLI(d)
    cli.cmdloop()

  create_argparser = cmd2.Cmd2ArgumentParser()
  create_argparser.add_argument('-n', '--name', help='Device name', required=True)
  create_argparser.add_argument('-s', '--site', help='Site ID', required=True)
  create_argparser.add_argument('-m', '--mac', help='MAC address', required=True)
  create_argparser.add_argument('--model', help='Model ID', required=True)
  create_argparser.add_argument('-d', '--description', help='Device description', required=False, default='N/A')

  @cmd2.with_argparser(create_argparser)
  def do_create(self, arg):
    """Create a new device"""
    # Create the device
    d = device.create_device(arg.name, arg.site, arg.mac, arg.model, arg.description)
    if not d:
      self.poutput('Error creating device')
      return

    # Open detail CLI
    cli = DeviceDetailCLI(d)
    cli.cmdloop()

class ModelDetailCLI(cmd2.Cmd):
  """Modify/delete a model"""
  prompt = '(yealink-provision-model-edit) '

  def __init__(self, model):
    super().__init__()
    self.model = model
    self.prompt = f'(yealink-provision-model-edit:{self.model.name}) '

  def do_info(self, arg):
    """Display model information"""
    self.poutput(f"\n=== {self.model.name} ===")
    self.poutput(f"ID: {self.model.id}")
    self.poutput(f"Description: {self.model.description}")
    self.poutput(f"Created: {self.model.create_date}\n")

  def do_delete(self, arg):
    """Delete the model"""
    # Confirm
    confirm = input('Are you sure you want to delete this model? (y/N) ')
    if confirm.lower() != 'y':
      return
    
    r = self.model.delete()
    if not r:
      self.poutput('Failed to delete model')

    # Exit this CLI
    return True

class ModelCLI(cmd2.Cmd):
  """Yealink Provision Model CLI"""
  prompt = '(yealink-provision-models) '

  def do_list(self, arg):
    """List models"""
    models = model.get_models()
    
    for m in models:
      self.poutput(f"{m.id} - {m.name} ({m.description}) CREATED: {m.create_date}")

  def do_edit(self, arg):
    """Edit a model"""
    args = arg.split(' ')
    if len(args) < 1:
      self.poutput('Invalid arguments')
      return
    
    m = model.get_model(args[0])
    if m is None:
      self.poutput('Failed to get model')
      return
    
    # Enter the site detail CLI
    cli = ModelDetailCLI(m)
    cli.cmdloop()

  argparser = cmd2.Cmd2ArgumentParser()
  argparser.add_argument('-n', '--name', help='Model name', required=True)
  argparser.add_argument('-d', '--description', help='Model description', required=False)

  @cmd2.with_argparser(argparser)
  def do_create(self, args):
    """Create a model"""
    m = model.create_model(args.name, args.description)
    if m is None:
      self.poutput('Failed to create model')
      return
    
    # Open the site detail CLI
    cli = ModelDetailCLI(m)
    cli.cmdloop()

class SiteDetailCLI(cmd2.Cmd):
  """Modify/delete a site"""
  prompt = '(yealink-provision-site-edit) '

  def __init__(self, site):
    super().__init__()
    self.site = site
    self.prompt = f'(yealink-provision-site-edit:{self.site.name}) '

  def do_info(self, arg):
    """Display site information"""
    self.poutput(f"\n=== {self.site.name} ===")
    self.poutput(f"ID: {self.site.id}")
    self.poutput(f"Name: {self.site.name}")
    self.poutput(f"Description: {self.site.description}")
    self.poutput(f"Tenant: {self.site.tenant_name}")
    self.poutput(f"Created: {self.site.create_date}")
    self.poutput(f"Password: {self.site.password}")
    self.poutput(f"Published: {'Yes' if self.site.published else 'No'}\n")

  def do_publish(self, arg):
    """Publish the site"""
    r = self.site.publish()
    if not r:
      self.poutput('Failed to publish site')

  def do_unpublish(self, arg):
    """Unpublish the site"""
    r = self.site.unpublish()
    if not r:
      self.poutput('Failed to unpublish site')

  def do_delete(self, arg):
    """Delete the site"""
    # Confirm
    confirm = input('Are you sure you want to delete this site? (y/N) ')
    if confirm.lower() != 'y':
      return
    
    r = self.site.delete()
    if not r:
      self.poutput('Failed to delete site')

    # Exit this CLI
    return True
  
  def do_set(self, arg):
    """Set site properties"""
    args = arg.split(' ')
    if len(args) < 2:
      self.poutput('Invalid arguments')
      return
    
    if args[0] == 'name':
      r = self.site.rename(' '.join(args[1:]))
      if not r:
        print(r)
        self.poutput('Failed to rename site')
    else:
      self.poutput('Invalid property')

class SiteCLI(cmd2.Cmd):
  """Yealink Provision Site CLI"""
  prompt = '(yealink-provision-sites) '
  file = None

  def do_list(self, arg):
    """List sites"""
    sites = site.get_sites()
    
    for s in sites:
      self.poutput(f"{s.id} - {s.name} ({s.description}) TENANT: {s.tenant_name}, CREATED: {s.create_date}, PUBLISHED: {s.published}")

  def do_edit(self, arg):
    s = site.get_site(arg)
    if s:
      SiteDetailCLI(s).cmdloop()
    else:
      self.poutput('site not found')

  # Create new site, prompt for name and description if not provided in args.
  argparser = cmd2.Cmd2ArgumentParser()
  argparser.add_argument('-n', '--name', type=str, help='Site name', required=True)
  argparser.add_argument('-t', '--tenant', type=str, help='Site tenant name', required=True)

  @cmd2.with_argparser(argparser)
  def do_create(self, args):
    """Create a new site"""
    s = site.create_site(args.name, args.tenant)
    if s:
      SiteDetailCLI(s).cmdloop()
    else:
      self.poutput('Failed to create site')

  def do_exit(self, arg):
    """Exit the CLI"""
    return True
  

class YealinkProvisionCLI(cmd2.Cmd):
  """Yealink Provision CLI"""
  intro = 'Welcome to the Yealink Provision CLI. Type help or ? to list commands.\n'
  prompt = '(yealink-provision) '
  file = None

  def do_site(self, arg):
    """Site sub-CLI, list, view or manage sites"""
    SiteCLI().cmdloop()

  def do_device(self, arg):
    """Manage devices"""
    DeviceCLI().cmdloop()

  def do_model(self, arg):
    """Manage models"""
    ModelCLI().cmdloop()

  def do_config(self, arg):
    """Manage configs"""
    ConfigCLI().cmdloop()

  def do_exit(self, arg):
    """Exit the CLI"""
    return True
  
  def do_quit(self, arg):
    """Exit the CLI"""
    return True
  
  def do_EOF(self, arg):
    """Exit the CLI"""
    return True
  
  def do_clear(self, arg):
    """Clear the screen"""
    self.clear()

  def do_help(self, arg):
    """Show help"""
    cmd2.Cmd.do_help(self, arg)

if __name__ == '__main__':
  # YealinkProvisionCLI().cmdloop()
  g = config.get_config_groups()
  print(g)
  print('Goodbye!')