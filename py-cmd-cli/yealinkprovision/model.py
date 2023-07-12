import requests

# Get API URL from parent
from .api import api_url

class Model:
  def __init__(self, id, name, description, create_date):
    self.id = id
    self.name = name
    self.description = description
    self.create_date = create_date

  def rename(self, name):
    # Rename the site
    r = requests.patch(api_url + '/models/' + self.id, json={'name': name})

    # Check if the request was successful
    if r.status_code == 200:
      self.name = name
      return True
    
    print(r.json())
    return False
  
  def delete(self):
    # Delete the site
    r = requests.delete(api_url + '/models/' + self.id)

    # Check if the request was successful
    if r.status_code == 200:
      return True
    
    print(r.json())
    return False
  
def create_model(name, description):
  # Create the site
  r = requests.post(api_url + '/models', json={'name': name, 'description': description})

  # Check if the request was successful
  if r.status_code == 200:
    return Model(r.json()['id'], name, description, r.json()['create_date'])
  
  print(r.json())
  return None

def get_models():
  # Get all models
  r = requests.get(api_url + '/models')

  # Check if the request was successful
  if r.status_code == 200:
    models = []
    for model in r.json():
      description = model['description'] if 'description' in model else "N/A"
      models.append(Model(model['id'], model['name'], description, model['create_date']))
    return models
  
  return None

def get_model(id):
  # Get the model
  r = requests.get(api_url + '/models/' + id)

  # Check if the request was successful
  if r.status_code == 200:
    model = r.json()
    description = model['description'] if 'description' in model else "N/A"
    return Model(model['id'], model['name'], description, model['create_date'])
  
  return None