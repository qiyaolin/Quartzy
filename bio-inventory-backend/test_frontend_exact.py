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

# Test the exact same request that frontend would make
from django.test import Client
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token
import json

def test_frontend_exact_data():
    try:
        # Create test user and token (simulating logged in user)
        user, created = User.objects.get_or_create(username='testuser', defaults={'email': 'test@example.com'})
        token, created = Token.objects.get_or_create(user=user)

        print(f'Using token: {token.key}')

        # Simulate exact frontend request with empty strings (not None)
        client = Client()
        
        # This mimics exactly what frontend sends - note the empty strings
        frontend_data = {
            "name": "Frontend Test Fund",
            "description": "",  # Empty string, not None
            "total_budget": 25000.00,
            "funding_source": "",  # Empty string
            "funding_agency": "other",
            "grant_number": "",  # Empty string
            "principal_investigator": "",  # Empty string
            "start_date": "",  # Empty string
            "end_date": "",  # Empty string
            "grant_duration_years": 1,
            "current_year": 1,
            "annual_budgets": {},
            "notes": ""  # Empty string
        }

        print("Sending POST request with exact frontend data (empty strings):")
        print(json.dumps(frontend_data, indent=2))

        response = client.post(
            '/api/funds/',
            json.dumps(frontend_data),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Token {token.key}'
        )

        print(f'Response status: {response.status_code}')
        
        if response.status_code == 201:
            response_data = json.loads(response.content.decode())
            print('SUCCESS: Fund created successfully with empty strings!')
            print(f'Created fund ID: {response_data["id"]}')
            print(f'Fund name: {response_data["name"]}')
        else:
            print(f'ERROR: Response content: {response.content.decode()}')
            if response.status_code == 500:
                print("This is a 500 Internal Server Error - the fix didn't work completely")
            elif response.status_code == 400:
                try:
                    error_data = json.loads(response.content.decode())
                    print(f'Validation errors: {error_data}')
                except:
                    pass
                
    except Exception as e:
        print(f"ERROR: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    test_frontend_exact_data()