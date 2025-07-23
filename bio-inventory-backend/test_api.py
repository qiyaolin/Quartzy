#!/usr/bin/env python
import os
import sys
import django
from pathlib import Path

# Add the project directory to sys.path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

# Test the API endpoint directly
from django.test import Client
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token
import json

def test_fund_api():
    try:
        # Create test user and token
        user, created = User.objects.get_or_create(username='testuser', defaults={'email': 'test@example.com'})
        token, created = Token.objects.get_or_create(user=user)

        print(f'User token: {token.key}')

        # Test the API endpoint
        client = Client()
        fund_data = {
            'name': 'API Test Fund',
            'total_budget': 50000.00,
            'funding_agency': 'nserc',
            'grant_duration_years': 1,
            'current_year': 1
        }

        response = client.post(
            '/api/funds/',
            json.dumps(fund_data),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Token {token.key}'
        )

        print(f'Response status: {response.status_code}')
        if response.status_code != 201:
            print(f'Response content: {response.content.decode()}')
            try:
                error_data = json.loads(response.content.decode())
                print(f'Error details: {error_data}')
            except:
                pass
        else:
            print('Fund created successfully via API!')
            response_data = json.loads(response.content.decode())
            print(f'Created fund ID: {response_data.get("id")}')
            
    except Exception as e:
        print(f"ERROR: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    test_fund_api()