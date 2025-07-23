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

def test_frontend_fund_creation():
    try:
        # Create test user and token (simulating logged in user)
        user, created = User.objects.get_or_create(username='testuser', defaults={'email': 'test@example.com'})
        token, created = Token.objects.get_or_create(user=user)

        print(f'Using token: {token.key}')

        # Simulate exact frontend request
        client = Client()
        
        # This is the exact payload that frontend sends
        frontend_data = {
            "name": "Test Fund from Frontend",
            "description": "Testing fund creation from frontend simulation",
            "total_budget": 25000.00,
            "funding_source": "University Research Grant",
            "funding_agency": "other",
            "grant_number": "URG-2025-001",
            "principal_investigator": "Dr. Test Researcher",
            "start_date": "2025-01-01",
            "end_date": "2025-12-31",
            "grant_duration_years": 1,
            "current_year": 1,
            "annual_budgets": {},
            "notes": "Test fund for debugging frontend issues"
        }

        print("Sending POST request to /api/funds/ with data:")
        print(json.dumps(frontend_data, indent=2))

        response = client.post(
            '/api/funds/',
            json.dumps(frontend_data),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Token {token.key}'
        )

        print(f'Response status: {response.status_code}')
        print(f'Response headers: {dict(response.items())}')
        
        if response.status_code == 201:
            response_data = json.loads(response.content.decode())
            print('Fund created successfully!')
            print(f'Created fund: {response_data}')
        else:
            print(f'Error response content: {response.content.decode()}')
            if response.status_code == 500:
                print("This is a 500 Internal Server Error - check Django server logs")
                
    except Exception as e:
        print(f"ERROR: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    test_frontend_fund_creation()