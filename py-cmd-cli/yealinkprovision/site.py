import requests

# Get API URL from parent
from .api import api_url

class Site:
  def __init__(self, id, name, tenant_name, description, create_date, published, password):
    self.id = id
    self.name = name
    self.tenant_name = tenant_name
    self.description = description if description else 'N/A'
    self.create_date = create_date
    self.published = published
    self.password = password

  def publish(self):
    # Publish the site
    r = requests.post(api_url + '/sites/' + self.id + '/publish')

    # Check if the request was successful
    if r.status_code == 200:
      self.published = True
      return True
    
    print(r.json())
    return False
  
  def unpublish(self):
    # Unpublish the site
    r = requests.delete(api_url + '/sites/' + self.id + '/publish')

    # Check if the request was successful
    if r.status_code == 200:
      self.published = False
      return True
    
    print(r.json())
    return False
  
  def delete(self):
    # Delete the site
    r = requests.delete(api_url + '/sites/' + self.id)

    # Check if the request was successful
    if r.status_code == 200:
      return True
    
    print(r.json())
    return False
  
  def rename(self, name):
    # Rename the site
    r = requests.patch(api_url + '/sites/' + self.id, json={'name': name})

    # Check if the request was successful
    if r.status_code == 200:
      self.name = name
      return True
    
    print(r.json())
    return False
  
def create_site(name, tenant_name):
  # Create the site
  r = requests.post(api_url + '/sites', json={'name': name, 'tenant_name': tenant_name})

  # Check if the request was successful
  if r.status_code == 200:
    description = r.json()['description'] if 'description' in r.json() else "N/A"
    return Site(r.json()['id'], name, tenant_name=r.json()['tenant_name'], description=description, create_date=r.json()['create_date'], published=r.json()['published'], password=r.json()['password'])
  else:
    print(r.json())
    return False
  
def get_sites():
  # Get all sites
  r = requests.get(api_url + '/sites')

  # Check if the request was successful
  if r.status_code == 200:
    sites = []

    # Loop through all sites
    for site in r.json():
      description = site['description'] if 'description' in site else "N/A"
      sites.append(Site(site['id'], site['name'], tenant_name=site['tenant_name'], description=description, create_date=site['create_date'], published=site['published'], password=site['password']))
    
    return sites
  else:
    return False
  
def get_site(id):
  # Get the site
  r = requests.get(api_url + '/sites/' + id)

  # Check if the request was successful
  if r.status_code == 200:
    description = r.json()['description'] if 'description' in r.json() else "N/A"
    return Site(r.json()['id'], r.json()['name'], tenant_name=r.json()['tenant_name'], description=description, create_date=r.json()['create_date'], published=r.json()['published'], password=r.json()['password'])
  else:
    print(r.json())
    return False