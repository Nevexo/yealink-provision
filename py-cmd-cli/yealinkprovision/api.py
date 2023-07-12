# Yealink Provision API Interface
# Cameron Fleming 2023

import requests
import os

# Get API URL from environment variable or use localhost:3000
api_url = os.getenv('API_URL', 'http://localhost:3000')

