# A click-based CLI for Yealink-Provision.
# By Cameron Fleming - 2023

# Get the server URL from environment and make it accessible by all commands
# Which are in files.

import os
import requests
import click

# Get the server URL from environment and make it accessible by all commands
# Which are in files.
server_url = os.environ.get("YEALINK_PROVISION_SERVER_URL")
if server_url == None:
    print("ERROR: No server URL specified in environment variable YEALINK_PROVISION_SERVER_URL.")
    print("FOR TESTING: setting to http://localhost:3000")
    server_url = "http://localhost:3000"

# Import all the commands
from groups import site
from groups import model
from groups import device

# Create the CLI
@click.group()
@click.pass_context
def cli(ctx):
  """A CLI for Yealink-Provision."""
  ctx.obj = server_url
  pass

# Add the commands to the CLI
cli.add_command(site.site)
cli.add_command(site.sites)
cli.add_command(model.model)
cli.add_command(model.models)
cli.add_command(device.device)
cli.add_command(device.devices)

# Run the CLI
if __name__ == "__main__":
  cli()
