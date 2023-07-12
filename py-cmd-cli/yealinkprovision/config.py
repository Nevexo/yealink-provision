import requests

from .api import api_url

class ConfigElement:
  def __init__(self, id, key, value, group, remark, create_date, published):
    self.id = id
    self.key = key
    self.value = value
    self.group = group
    self.remark = remark
    self.create_date = create_date
    self.published = published

  def publish(self):
    # Publish the config element
    r = requests.post(api_url + '/config/group/' + self.group + '/elements/' + self.id + '/publish')

    # Check if the request was successful
    if r.status_code == 200:
      self.published = True
      return True
    
    return False

  def unpublish(self):
    # Unpublish the config element
    r = requests.delete(api_url + '/config/group/' + self.group + '/elements/' + self.id + '/publish')

    # Check if the request was successful
    if r.status_code == 200:
      self.published = False
      return True
    
    return False
  
  def delete(self):
    # Delete the config element
    r = requests.delete(api_url + '/config/group/' + self.group + '/elements/' + self.id)

    # Check if the request was successful
    if r.status_code == 200:
      return True
    
    return False
  
  def change_value(self, value):
    # Change the config element value
    r = requests.put(api_url + '/config/group/' + self.group + '/elements/' + self.id + '/value', json={'value': value})

    # Check if the request was successful
    if r.status_code == 200:
      self.value = value
      return True
    
    return False
  

class ConfigGroup:
  def __init__(self, id, parent_group, name, remark, target_type, target, create_date, published, children):
    self.id = id
    self.parent_group = parent_group
    self.name = name
    self.remark = remark
    self.target_type = target_type
    self.target = target
    self.create_date = create_date
    self.published = published
    self.children = children
    self.elements = self.get_elements()

  def add_child(self, child):
    self.children.append(child)

  def publish(self):
    # Publish the config group
    r = requests.post(api_url + '/config/group/' + self.id + '/publish')

    # Check if the request was successful
    if r.status_code == 200:
      self.published = True
      return True
    
    return False
  
  def unpublish(self):
    # Unpublish the config group
    r = requests.delete(api_url + '/config/group/' + self.id + '/publish')

    # Check if the request was successful
    if r.status_code == 200:
      self.published = False
      return True
    
    return False
  
  def delete(self):
    # Delete the config group
    r = requests.delete(api_url + '/config/group/' + self.id)

    # Check if the request was successful
    if r.status_code == 200:
      return True
    
    print(r.json())

    return False
  
  def get_elements(self):
    # Get the config group elements
    r = requests.get(api_url + '/config/group/' + self.id + '/elements')

    # Check if the request was successful
    if r.status_code == 200:
      elements = []
      for element in r.json():
        elements.append(ConfigElement(element['id'], element['key'], element['value'], element['group'], element['remark'], element['create_date'], element['published']))
      return elements
    
    return False
  
  def create_element(self, key, value, remark):
    # Create the config group element
    r = requests.post(api_url + '/config/group/' + self.id + '/elements', json={'key': key, 'value': value, 'remark': remark})

    # Check if the request was successful
    if r.status_code == 200:
      return ConfigElement(
        r.json()['id'],
        r.json()['key'],
        r.json()['value'],
        r.json()['group'],
        r.json()['remark'],
        r.json()['create_date'],
        r.json()['published']
      )
    
    return False
  
  def create_child(self, name, remark):
    # Create the config group child
    r = requests.post(api_url + '/config/group/' + self.id + '/children', json={
      'name': name, 
      'remark': remark,
      'target_type': 'child',
      'target': None,
      'parent_group': self.id
      })

    # Check if the request was successful
    if r.status_code == 200:
      return ConfigGroup(
        r.json()['id'],
        r.json()['parent_group'],
        r.json()['name'],
        r.json()['remark'],
        r.json()['target_type'],
        r.json()['target'],
        r.json()['create_date'],
        r.json()['published']
      )
    
    return False

def create_parent_group(name, remark, target_type, target):
  # Create the config group parent
  r = requests.post(api_url + '/config/group', json={
    'name': name, 
    'remark': remark,
    'target_type': target_type,
    'target': target,
    })

  # Check if the request was successful
  if r.status_code == 200:
    return ConfigGroup(
      r.json()['id'],
      r.json()['parent_group'],
      r.json()['name'],
      r.json()['remark'],
      r.json()['target_type'],
      r.json()['target'],
      r.json()['create_date'],
      r.json()['published']
    )
  
  return False

def get_config_groups():
  # Get the config groups
  r = requests.get(api_url + '/config/groups')

  # Check if the request was successful
  if r.status_code == 200:
    groups = []

    # For every group, fetch all children recursively (children can have children etc)
    # For every child's child, create a ConfigGroup object and add it to the children list
    # of the parent ConfigGroup object.
    
    def create_config_group(json_data):
        # Create a ConfigGroup object for the current node
        config_group = ConfigGroup(
            json_data['id'],
            json_data['parent_group'],
            json_data['name'],
            json_data['remark'],
            json_data['target_type'],
            json_data['target'],
            json_data['create_date'],
            json_data['published']
        )

        # Recursively create ConfigGroup objects for each child
        for child_data in json_data['children']:
            child_group = create_config_group(child_data)
            config_group.add_child(child_group)

        return config_group
    
    # For every group, create a ConfigGroup object and add it to the groups list
    for group in r.json():
      groups.append(create_config_group(group))

    return groups
  
  return False

def get_config_group_children(id):
  # Get the object again, and only return the children, as ConfigGroup objects.
  r = requests.get(api_url + '/config/group/' + id)

  # Check if the request was successful
  if r.status_code == 200:
    children = []
    for child in r.json()['children']:
      children.append(ConfigGroup(child['id'], child['parent_group'], child['name'], child['remark'], child['target_type'], child['target'], child['create_date'], child['published']))
    return children
  
  return False

def get_config_group(id):
  # Get the config group
  r = requests.get(api_url + '/config/group/' + id)

  # Check if the request was successful
  if r.status_code == 200:
    return ConfigGroup(
      r.json()['id'],
      r.json()['parent_group'],
      r.json()['name'],
      r.json()['remark'],
      r.json()['target_type'],
      r.json()['target'],
      r.json()['create_date'],
      r.json()['published']
    )
  
  return False

def get_groups_for_site(site_id):
  # There isn't an API endpoint for this, so we have to get all groups and filter them
  groups = get_config_groups()
  if groups:
    return [group for group in groups if group.target_type == 'site' and group.target == site_id]
  
  return False

