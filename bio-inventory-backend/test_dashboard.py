#!/usr/bin/env python
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from funding.models import EnhancedFund
from funding.enhanced_views import EnhancedFundViewSet
from django.test import RequestFactory
from django.contrib.auth.models import User

def test_dashboard_stats():
    """Test the dashboard stats functionality"""
    print("Testing Financial Dashboard...")
    
    # Check if we have test data
    fund_count = EnhancedFund.objects.count()
    print(f"Enhanced funds in database: {fund_count}")
    
    if fund_count == 0:
        print("No test data found. Please create some enhanced funds first.")
        return
    
    # Create a test request
    factory = RequestFactory()
    request = factory.get('/api/enhanced-funds/dashboard_stats/')
    
    # Get a user for the request
    user = User.objects.first()
    if not user:
        print("No users found. Creating test user...")
        user = User.objects.create_user('testuser', 'test@example.com', 'password')
    
    request.user = user
    
    # Test the view
    view = EnhancedFundViewSet()
    view.request = request
    
    try:
        response = view.dashboard_stats(request)
        print(f"Dashboard response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.data
            summary = data.get('summary', {})
            print("\n=== Financial Dashboard Summary ===")
            print(f"Total funds: {summary.get('total_funds', 0)}")
            print(f"Total budget: ${summary.get('total_budget', 0):,.2f}")
            print(f"Total spent: ${summary.get('total_spent', 0):,.2f}")
            print(f"Available budget: ${summary.get('available_budget', 0):,.2f}")
            print(f"Overall utilization: {summary.get('overall_utilization', 0):.1f}%")
            print(f"Expiring funds: {summary.get('expiring_funds', 0)}")
            print("\n✅ Financial Dashboard is working correctly!")
            
            # Test budget analysis endpoint
            response2 = view.budget_analysis(request)
            if response2.status_code == 200:
                print("✅ Budget analysis endpoint is also working!")
            else:
                print("❌ Budget analysis endpoint failed")
                
        else:
            print("❌ Dashboard endpoint failed")
            print(f"Error: {response.data if hasattr(response, 'data') else 'Unknown error'}")
            
    except Exception as e:
        print(f"❌ Error calling dashboard: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_dashboard_stats()