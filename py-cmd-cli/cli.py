# yealink-provision CLI Tool
# Cameron Fleming (c) 2023

import cmd2

from sections.model import ModelCLI
from sections.site import SiteCLI

class YealinkProvisionCLI(cmd2.Cmd):
  """Yealink CLI - Provisioning Tool"""
  intro = 'Welcome to Yealink Provision CLI, type help or ? to list commands.\n'
  prompt = 'yealink-provision> '

  def __init__(self):
    super().__init__()

  def do_model(self, arg):
    """Yealink CLI - Model Editor"""
    model = ModelCLI()
    model.cmdloop()

  def do_site(self, arg):
    """Yealink CLI - Site Editor"""
    site = SiteCLI()
    site.cmdloop()

  def do_exit(self, arg):
    """Exit the CLI"""
    return True

  def do_quit(self, arg):
    """Exit the CLI"""
    return True

  def do_EOF(self, arg):
    """Exit the CLI"""
    return True

if __name__ == '__main__':
  cli = YealinkProvisionCLI()
  cli.cmdloop()