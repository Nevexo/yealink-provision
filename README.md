# yealink-provision

## This project is in active development.
Documentation will be improved in the coming weeks.

This project creates a simple Yealink provisioning server that can be used with Yealink RPS to configure
Yealink phones dynamically.

The Python-based CLI can be used to configure the phones, the local server will then dynamically create Yealink cfg files and serve them to the phones.
A web UI might be added in the future.

## Overview

```
+-----------------+     +-----------------+     +-----------------+
|                 |     |                 |     |                 |
| Phone Bootstrap | ==> | Yealink RPS     | ==> |yealink-provision|
|                 |     |                 |     |                 |
+-----------------+     +-----------------+     +-----------------+
```

When a phone starts for the first time, it will contact the Yealink RPS service, which should be configured to redirect
the phone to the yealink-provision server. The phone will need connectivity to the Yealink-Provision server, be that over
the internet, or via VPN. 

Alternatively, the phone can be configured to use the yealink-provision server directly, without using Yealink RPS.

## Containers

The yealink-provision project uses Docker containers to run the webserver, configuration API and MongoDB database.

The MongoDB database holds the configuration for phones, as well as authentication details. 

## Device Authentication

While requesting configuration, the Yealink devices provide a HTTP Basic Auth username and password. The username of the device
corrosponds to the "device ID" stored in yealink-provision, and the password is randomly generated when the device is created.

When the device contacts yealink-provision, the username and password are validated, and then configuration is generated if the
MAC address matches that listed within the database.