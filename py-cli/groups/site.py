# Site-based commands for yealink-provision.
# Cameron Fleming 2023

import click
import requests

# "Sites" command should alias to "site list"
@click.command()
@click.pass_context
def sites(ctx):
  """List all sites."""
  r = requests.get(ctx.obj + "/sites")
  if r.status_code == 200:
    sites = r.json()
    for site in sites:
      # Display site ID, name, tenant_name, published status, create_date and password with emojis and text.
      published_status = "\u2705 Published" if site['published'] else "\u274C Not Published"
      click.echo(f"\U0001F5C2  {site['name']} ({site['id']}) - {site['tenant_name']} - {published_status}")

  else:
    print("ERROR: " + str(r.status_code) + " - " + r.text)

@click.group()
def site():
  """Site """
  pass

# Site list should alias the "sites" command
# Should accept "site list" and "site ls"
@site.command("list", help="List all sites.")
@click.pass_context
def site_list(ctx):
  ctx.invoke(sites)

@site.command("info", help="Get info about a site.")
@click.argument("site_id", type=str)
@click.pass_context
def info(ctx, site_id):
  """Get info about a site."""
  r = requests.get(ctx.obj + "/sites/" + site_id)
  if r.status_code == 200:
    site = r.json()
    # Display all properties of the site, using emojis before each property name.
    # Display each property on a new line.
    click.echo(f"\U0001F5C2   Site Name: {site['name']} ({site['id']})")
    click.echo(f"\U0001F4CD  Tenant: {site['tenant_name']}")
    click.echo(f"\U0001F4C5  Creation Date: {site['create_date']}")
    click.echo(f"\U0001F512  Site Password: {site['password']}")
    published_status = "\u2705 Published" if site['published'] else "\u274C Not Published"
    click.echo(f"\U0001F4E6  Publish Status: {published_status}")

  else:
    click.echo("ERROR: " + str(r.status_code) + " - " + r.text)

site.add_command(info)

@click.command(help="Create a new site.")
@click.option("--name", prompt=True, help="Site name.")
@click.option("--tenant", prompt=True, help="Tenant name.")
@click.option("--publish/--no-publish", default=False, help="Automatically publish the site.")
@click.pass_context
def create(ctx, name, tenant, publish):
  """Create a new site."""
  data = {
    "name": name,
    "tenant_name": tenant,
    "published": publish
  }

  r = requests.post(ctx.obj + "/sites", json=data)
  if r.status_code == 200:
    click.echo(f"\U0001F5C2 \u2705 Site created with ID {r.json()['id']}. \U0001F512 Site password: {r.json()['password']}")

    if publish:
      click.echo("\u2705 Site published automatically.")

  else:
    click.echo("ERROR: " + str(r.status_code) + " - " + r.text)

site.add_command(create)

@click.command(help="Delete a site.")
@click.argument("site_id", type=str)
@click.pass_context
def delete(ctx, site_id):
  """Delete a site."""
  r = requests.delete(ctx.obj + "/sites/" + site_id)
  if r.status_code == 200:
    click.echo("\u2705 Site deleted.")

  else:
    click.echo("ERROR: " + str(r.status_code) + " - " + r.text)

site.add_command(delete)

@click.command(help="Publish a site.")
@click.argument("site_id", type=str)
@click.pass_context
def publish(ctx, site_id):
  """Publish a site."""
  r = requests.post(ctx.obj + "/sites/" + site_id + "/publish")
  if r.status_code == 200:
    click.echo("\u2705 Site published.")

  else:
    click.echo("ERROR: " + str(r.status_code) + " - " + r.text)

site.add_command(publish)

@click.command(help="Unpublish a site.")
@click.argument("site_id", type=str)
@click.pass_context
def unpublish(ctx, site_id):
  """Unpublish a site."""
  r = requests.delete(ctx.obj + "/sites/" + site_id + "/publish")
  if r.status_code == 200:
    click.echo("\u2705 Site unpublished.")

  else:
    click.echo("ERROR: " + str(r.status_code) + " - " + r.text)

site.add_command(unpublish)

@click.command(help="Rename a site.")
@click.argument("site_id", type=str)
@click.option("--name", prompt=True, help="New site name.")
@click.pass_context
def rename(ctx, site_id, name):
  """Rename a site."""
  data = {
    "name": name
  }

  r = requests.patch(ctx.obj + "/sites/" + site_id, json=data)
  if r.status_code == 200:
    click.echo("\u2705 Site renamed.")

  else:
    click.echo("ERROR: " + str(r.status_code) + " - " + r.text)

site.add_command(rename)