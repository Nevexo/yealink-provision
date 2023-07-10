# Device Model interaction commands for yealink-provision
# Cameron Fleming 2023

import click
import requests

# "Models" command should alias to "model list"
@click.command()
@click.pass_context
def models(ctx):
  """List all models."""
  r = requests.get(ctx.obj + "/models")
  if r.status_code == 200:
    models = r.json()
    for model in models:
      # Display model ID, name and creation date with emojis and text.
      click.echo(f"\U0001F4C5  {model['name']} ({model['id']}) - {model['create_date']}")

  else:
    print("ERROR: " + str(r.status_code) + " - " + r.text)

@click.group()
def model():
  """Model """
  pass

# Model list should alias the "models" command
@model.command("list", help="List all models.")
@click.pass_context
def model_list(ctx):
  ctx.invoke(models)
  

@model.command("info", help="Get info about a model.")
@click.argument("model_id", type=str)
@click.pass_context
def info(ctx, model_id):
  """Get info about a model."""
  r = requests.get(ctx.obj + "/models/" + model_id)
  if r.status_code == 200:
    model = r.json()
    # Display all properties of the model, using emojis before each property name.
    # Display each property on a new line.
    click.echo(f"\U0001F4C5  Model Name: {model['name']} ({model['id']})")
    click.echo(f"\U0001F4CD  Creation Date: {model['create_date']}")
  else: 
    click.echo("ERROR: " + str(r.status_code) + " - " + r.text)

model.add_command(info)


@model.command("create", help="Create a new model.")
@click.option("--name", prompt=True, help="Model name.")
@click.pass_context
def create(ctx, name):
  """Create a new model."""
  r = requests.post(ctx.obj + "/models", json={"name": name})
  if r.status_code == 200:
    model = r.json()
    # Display all properties of the model, using emojis before each property name.
    # Display each property on a new line.
    click.echo(f"\U0001F4C5  Model Name: {model['name']} ({model['id']})")
    click.echo(f"\U0001F4CD  Creation Date: {model['create_date']}")
  else:
    click.echo("ERROR: " + str(r.status_code) + " - " + r.text)

model.add_command(create)

@model.command("delete", help="Delete a model.")
@click.argument("model_id", type=str)
@click.pass_context
def delete(ctx, model_id):
  """Delete a model."""
  r = requests.delete(ctx.obj + "/models/" + model_id)
  if r.status_code == 200:
    click.echo("SUCCESS: Model deleted.")
  else:
    click.echo("ERROR: " + str(r.status_code) + " - " + r.text)

model.add_command(delete)