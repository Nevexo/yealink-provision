# Yealink CLI - Model Editor
from .api import api_url

from .configEditor import ConfigCLI

import cmd2
import requests

class Model:
  def __init__(self, id, name, vendor, remark, create_date):
    self.id = id
    self.name = name
    self.remark = remark
    self.vendor = vendor
    self.create_date = create_date

  def rename(self, name):
    # Rename the site
    r = requests.patch(api_url + '/models/' + self.id, json={'name': name})

    # Check if the request was successful
    if r.status_code == 200:
      self.name = name
      return True
    
    return False
  
  def delete(self):
    # Delete the site
    r = requests.delete(api_url + '/models/' + self.id)

    # Check if the request was successful
    if r.status_code == 200:
      return True
    
    return False
  
def create_model(name, vendor, remark):
  # Create the site
  r = requests.post(api_url + '/models', json={'name': name, 'vendor': vendor,'remark': remark})

  # Check if the request was successful
  if r.status_code == 200:
    return Model(r.json()['id'], name, vendor, remark, r.json()['create_date'])
  
  return None

def get_models():
  # Get all models
  r = requests.get(api_url + '/models')

  # Check if the request was successful
  if r.status_code == 200:
    models = []
    for model in r.json():
      remark = model['remark'] if 'remark' in model else "N/A"
      models.append(Model(model['id'], model['name'], remark, model['vendor'], model['create_date']))
    return models
  
  return None

def get_model(id):
  # Get the model
  r = requests.get(api_url + '/models/' + id)

  # Check if the request was successful
  if r.status_code == 200:
    model = r.json()
    remark = model['remark'] if 'remark' in model else "N/A"
    return Model(model['id'], model['name'], model['vendor'], remark, model['create_date'])
  
  return None

class ModelCLI(cmd2.Cmd):
  """Yealink CLI - Model Management"""
  prompt = 'model> '

  def __init__(self):
    super().__init__()
    self.models = get_models()

  def do_list(self, args):
    """List all models"""
    self.models = get_models()

    if self.models == None:
      print("Failed to get models")
      return
    for model in self.models:
      print(model.id + ": " + model.name)

  def do_create(self, args):
    """Create a new model"""
    name = input("Name: ")
    vendor = input("Vendor: ")
    remark = input("Remark: ")
    model = create_model(name, vendor, remark)
    if model != None:
      self.models.append(model)
      print("Successfully created model " + model.name)
      # Drop into CLI for this model
      model_editor = ModelEditCLI(model)
      model_editor.cmdloop()
    else:
      print("Failed to create model")

  def do_edit(self, args):
    """Edit a model"""
    if len(args) == 0:
      print("Please specify a model ID")
      return
    model = get_model(args)
    if model == None:
      print("Failed to get model")
      return
    model_editor = ModelEditCLI(model)
    model_editor.cmdloop()

class ModelEditCLI(cmd2.Cmd):
  """Yealink CLI - Model Editor"""
  prompt = 'model> '

  def __init__(self, model):
    super().__init__()
    self.model = model
    self.prompt = 'model(' + model.name + ')> '

  def do_name(self, args):
    """Change the name of the model"""
    if len(args) == 0:
      print("Please specify a new name")
      return
    if self.model.rename(args):
      print("Successfully renamed model to " + args)
      self.model.name = args
      self.prompt = 'model(' + args + ')> '
    else:
      print("Failed to rename model")

  def do_info(self, args):
    """Get info about the model"""
    print("ID: " + self.model.id)
    print("Name: " + self.model.name)
    print("Vendor: " + self.model.vendor)
    print("Remark: " + self.model.remark)
    print("Create Date: " + self.model.create_date)

  def do_config(self, arg):
    """Edit the site config"""
    config = ConfigCLI("model", self.model.id, self.model.name)
    config.cmdloop()

  def do_delete(self, args):
    """Delete the model"""
    if self.model.delete():
      print("Successfully deleted model")
      return True
    else:
      print("Failed to delete model")
      return
    
  def do_exit(self, args):
    """Exit the model editor"""
    return True
  
  def do_EOF(self, args):
    """Exit the model editor"""
    return True