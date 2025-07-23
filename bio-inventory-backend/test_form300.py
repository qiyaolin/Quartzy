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

# Test the Form 300 API endpoint directly
from django.test import Client
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token
from funding.models import Fund
import json

def test_form300_api():
    try:
        # Create test user and token
        user, created = User.objects.get_or_create(username='testuser', defaults={'email': 'test@example.com'})
        token, created = Token.objects.get_or_create(user=user)

        print(f'User token: {token.key}')

        # Get Tri-Agency funds
        tri_agency_funds = Fund.objects.filter(funding_agency__in=['cihr', 'nserc', 'sshrc'])
        print(f"Found {tri_agency_funds.count()} Tri-Agency funds:")
        for fund in tri_agency_funds:
            print(f"  - {fund.name} ({fund.funding_agency}): ${fund.total_budget}")

        # Test the Form 300 API endpoint
        client = Client()
        form300_data = {
            'fiscal_year': 2025,
            'fund_ids': list(tri_agency_funds.values_list('id', flat=True))
        }

        response = client.post(
            '/api/reports/generate_form300/',
            json.dumps(form300_data),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Token {token.key}'
        )

        print(f'Response status: {response.status_code}')
        if response.status_code == 201:
            response_data = json.loads(response.content.decode())
            print('Form 300 generated successfully!')
            print(f'Report ID: {response_data["report"]["id"]}')
            
            # Print form300 data summary
            form300_data = response_data.get('form300_data', {})
            print(f'Form 300 Summary:')
            print(f'  Total Direct: ${float(form300_data.get("total_direct", 0)):,.2f}')
            print(f'  Total Indirect: ${float(form300_data.get("total_indirect", 0)):,.2f}')
            print(f'  Grand Total: ${float(form300_data.get("grand_total", 0)):,.2f}')
            print(f'  Fiscal Year: {form300_data.get("fiscal_year", "N/A")}')
            
            # Show direct costs breakdown
            direct_costs = form300_data.get('direct_costs', {})
            print(f'  Direct Costs Breakdown:')
            for category, amount in direct_costs.items():
                print(f'    {category.title()}: ${float(amount):,.2f}')
                
            # Show indirect costs breakdown
            indirect_costs = form300_data.get('indirect_costs', {})
            print(f'  Indirect Costs Breakdown:')
            for category, amount in indirect_costs.items():
                print(f'    {category.title()}: ${float(amount):,.2f}')
                
        else:
            print(f'Response content: {response.content.decode()}')
            try:
                error_data = json.loads(response.content.decode())
                print(f'Error details: {error_data}')
            except:
                pass
            
    except Exception as e:
        print(f"ERROR: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    test_form300_api()