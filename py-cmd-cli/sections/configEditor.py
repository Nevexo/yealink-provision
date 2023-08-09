# Yealink Provision CLI - Configuration Editor.
# Cameron Fleming (c) 2023

# The configuration editor is a recursive CLI that keeps track
# of the current position in the configuration tree.
# It must track the target_type and target_id of the root group,
# as well as any intermediate groups between the root and either
# currently selected group or the currently selected element.

from .api import api_url

import cmd2
import requests

def delete_config_group_or_element(target_type, target_id, intermediate_tree):
  # Delete the configuration group or element
  r = requests.delete(
    api_url + "/" +
    target_type +
    '/' +
    target_id +
    '/config/' +
    '/'.join(intermediate_tree)
  )

  # Check if the request was successful
  if r.status_code == 200:
    return True
  
  return False

def get_config_group_or_element(target_type, target_id, intermediate_tree):
  # Get the configuration group
  r = requests.get(
    api_url + "/" +
    target_type +
    '/' +
    target_id +
    '/config/' +
    '/'.join(intermediate_tree)
  )

  # Check if the request was successful
  if r.status_code == 200:
    return r.json()
  
  return None

def create_config_group(target_type, target_id, intermediate_tree):
  # Create the configuration group
  url = (
    api_url + "/" +
    target_type +
    '/' +
    target_id +
    '/config/' +
    '/'.join(intermediate_tree)
  )
  print(url)
  r = requests.post(url, json={'enable': True})

  # Check if the request was successful
  if r.status_code == 200:
    return r.json()
  
  return None

def create_config_element(target_type, target_id, intermediate_tree, name, value):
  # Create the configuration element
  url = (
    api_url + "/" +
    target_type +
    '/' +
    target_id +
    '/config/' +
    '/'.join(intermediate_tree) +
    '/' + name
  )
  print(url)
  r = requests.post(
    url, json={'value': value, 'enable': True}
  )

  # Check if the request was successful
  if r.status_code == 200:
    return r.json()
  
  return None

def update_config_element_value(target_type, target_id, intermediate_tree, value):
  # Update the configuration element value
  url = (
    api_url + "/" +
    target_type +
    '/' +
    target_id +
    '/config/' +
    '/'.join(intermediate_tree)
  )
  print(url)
  r = requests.patch(
    url, json={'value': value}
  )

  # Check if the request was successful
  if r.status_code == 200:
    return r.json()
  
  return None

class ConfigElementCLI(cmd2.Cmd):
  """Yealink Provision CLI - Configuration Element Editor"""
  prompt = 'PENDING> '

  def __init__(self, target_type, target_id, target_name, intermediate_tree):
    super().__init__()
    self.target_type = target_type
    self.target_id = target_id
    self.target_name = target_name
    self.intermediate_tree = intermediate_tree

    self.head = self.intermediate_tree[len(self.intermediate_tree) - 1]
    # Check if the head exists, if not, create it.
    tree = ':'.join(self.intermediate_tree)

    self.prompt = f"{self.target_type}-{self.target_name}-config-{tree}> "

  def do_show(self, arg):
    """Show the current configuration element"""
    # Get the current value
    element = get_config_group_or_element(self.target_type, self.target_id, self.intermediate_tree)
    print("Current Value")
    print("-------------")
    print(f"{element['value']}")

  def do_value(self, arg):
    """Set the value of this configuration element"""
    if arg == "":
      print("Please specify a value")
      return
    
    # Set the new value
    new_value = arg
    element = update_config_element_value(self.target_type, self.target_id, self.intermediate_tree, new_value)
    if element == None:
      print("Failed to set value")
      return
    
    print("New Value")
    print("---------")
    print(f"{element['value']}")

  def do_delete(self, arg):
    """Delete this configuration element"""
    if delete_config_group_or_element(self.target_type, self.target_id, self.intermediate_tree):
      print("Deleted")
      return True
    else:
      print("Failed to delete")

  def do_exit(self, arg):
    """Exit the CLI"""
    return True

class ConfigGroupCLI(cmd2.Cmd):
  """Yealink CLI - Configuration Group Editor"""
  prompt = 'PENDING> '

  def __init__(self, target_type, target_id, target_name, intermediate_tree):
    super().__init__()
    self.target_type = target_type
    self.target_id = target_id
    self.target_name = target_name
    self.intermediate_tree = intermediate_tree

    self.head = self.intermediate_tree[len(self.intermediate_tree) - 1]
    # Check if the head exists, if not, create it.

    if get_config_group_or_element(self.target_type, self.target_id, self.intermediate_tree) == None:
      print("creating new group")
      create_config_group(self.target_type, self.target_id, intermediate_tree)
      

    tree = ':'.join(self.intermediate_tree)

    self.prompt = f"{self.target_type}-{self.target_name}-config-{tree}> "

  def do_group(self, arg):
    """Open a further down group"""
    new_tree = self.intermediate_tree + [arg]
    new_cli = ConfigGroupCLI(self.target_type, self.target_id, self.target_name, new_tree)
    new_cli.cmdloop()

  def do_show(self, arg):
    """Show information about this configuration group and it's downstreams (children)"""
    info = get_config_group_or_element(self.target_type, self.target_id, self.intermediate_tree)
    
    print("ID\t\tName\t\tEnabled\t\tCreate Date")
    if "children" in info:
      group_info = info['group']
    else:
      group_info = info
    
    print(f"{group_info['id']}\t\t{group_info['name']}\t\t{group_info['enable']}\t\t{group_info['create_date']}")

    if "children" in info:
      print("\n--- Downstream Groups ---")
      print("ID\t\tName\t\tEnabled\t\tCreate Date")
      if "groups" in info['children']:
        for group in info['children']['groups']:
          print(f"{group['id']}\t\t{group['name']}\t\t{group['enable']}\t\t{group['create_date']}")
      else:
        print("No downstream groups")

      print("\n--- Downstream Elements ---")
      print("ID\t\tName\t\tEnabled\t\tCreate Date\t\tValue")

      if "elements" in info['children']:
        for element in info['children']['elements']:
          print(f"{element['id']}\t\t{element['name']}\t\t{element['enable']}\t\t{element['create_date']}\t\t{element['value']}")
      else:
        print("No downstream elements")

  def do_delete(self, arg):
    """Delete this configuration group"""
    if delete_config_group_or_element(self.target_type, self.target_id, self.intermediate_tree):
      print("Deleted")
      return True
    else:
      print("Failed to delete")

  def do_element(self, arg):
    """Open a configuration element"""
    # Check if the element exists, if not, prompt for a value and create it.
    new_tree = self.intermediate_tree + [arg]

    element = get_config_group_or_element(self.target_type, self.target_id, new_tree)
    if element == None:
      print("creating new element")
      value = input("Enter value: ")
      if value == "":
        print("No value entered.")
        return
      create_config_element(self.target_type, self.target_id, self.intermediate_tree, arg, value)
      element = get_config_group_or_element(self.target_type, self.target_id, new_tree)    

    new_cli = ConfigElementCLI(self.target_type, self.target_id, self.target_name, new_tree)
    new_cli.cmdloop()

  def do_exit(self, arg):
    """Exit the CLI"""
    return True
  
class ConfigCLI(cmd2.Cmd):
  """Yealink CLI - Configuration Manager, use to launch group."""
  # Doesn't yet support root elements.
  prompt = 'config> '

  def __init__(self, target_type, target_id, target_name):
    super().__init__()
    self.target_type = target_type
    self.target_id = target_id
    self.target_name = target_name

    self.prompt = f"config({self.target_type}-{self.target_name})> "

  def do_group(self, arg):
    """Open a group"""
    new_cli = ConfigGroupCLI(self.target_type, self.target_id, self.target_name, [arg])
    new_cli.cmdloop()

  def do_exit(self, arg):
    """Exit the CLI"""
    return True