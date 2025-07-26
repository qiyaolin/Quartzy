#!/usr/bin/env python
"""
Test email notifications to a specific email address
Run this from the Django project root directory:
python test_email_specific.py
"""

import os
import sys
import django

# Setup Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth.models import User
from inventory_requests.models import Request
from items.models import Vendor
from notifications.email_service import EmailNotificationService
from django.core.mail import send_mail
from django.conf import settings

# Test email address
TEST_EMAIL = "qiyao.lin@mail.mcgill.ca"

def create_or_update_test_user():
    """Create or update a test user with the specified email"""
    try:
        # Try to find existing test user
        test_user = User.objects.filter(username='test_email_user').first()
        
        if not test_user:
            # Create new test user
            test_user = User.objects.create_user(
                username='test_email_user',
                email=TEST_EMAIL,
                first_name='Test',
                last_name='User',
                is_staff=False,
                is_active=True
            )
            print(f"Created test user: {test_user.username}")
        else:
            # Update existing user's email
            test_user.email = TEST_EMAIL
            test_user.save()
            print(f"Updated test user email: {test_user.username}")
        
        return test_user
    except Exception as e:
        print(f"Error creating/updating test user: {e}")
        return None

def create_or_update_admin_user():
    """Create or update admin user with test email"""
    try:
        # Try to find existing admin user
        admin_user = User.objects.filter(is_staff=True).first()
        
        if not admin_user:
            # Create new admin user
            admin_user = User.objects.create_user(
                username='test_admin',
                email=TEST_EMAIL,
                first_name='Test',
                last_name='Admin',
                is_staff=True,
                is_superuser=True,
                is_active=True
            )
            print(f"Created admin user: {admin_user.username}")
        else:
            # Update existing admin's email for testing
            original_email = admin_user.email
            admin_user.email = TEST_EMAIL
            admin_user.save()
            print(f"Updated admin user email from {original_email} to {TEST_EMAIL}")
        
        return admin_user
    except Exception as e:
        print(f"Error creating/updating admin user: {e}")
        return None

def test_basic_email():
    """Test basic email sending functionality"""
    print(f"\n1. Testing basic email to {TEST_EMAIL}...")
    
    try:
        send_mail(
            subject='[Quartzy Lab System] Basic Email Test',
            message='This is a basic test email to verify email configuration is working.\n\nIf you receive this, the email system is configured correctly!',
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[TEST_EMAIL],
            fail_silently=False,
        )
        print("SUCCESS: Basic email test sent successfully!")
        return True
    except Exception as e:
        print(f"FAILED: Failed to send basic email: {e}")
        return False

def test_new_request_notification():
    """Test new request notification email"""
    print(f"\n2. Testing new request notification to {TEST_EMAIL}...")
    
    try:
        # Get or create test users and vendor
        test_user = create_or_update_test_user()
        admin_user = create_or_update_admin_user()
        
        if not test_user or not admin_user:
            print("FAILED Failed to create test users")
            return False
        
        # Get or create a vendor
        vendor, created = Vendor.objects.get_or_create(
            name="Test Vendor Co.",
            defaults={
                'website': 'https://testvendor.com'
            }
        )
        
        # Create a test request
        test_request = Request.objects.create(
            item_name="Email Test Reagent Kit",
            requested_by=test_user,
            vendor=vendor,
            catalog_number="EMAIL-TEST-001",
            quantity=3,
            unit_size="boxes",
            unit_price=89.99,
            status='NEW',
            notes="This is a test request to verify email notifications are working properly."
        )
        
        print(f"Created test request: {test_request.id}")
        
        # Send new request notification
        result = EmailNotificationService.send_new_request_notification(test_request)
        
        if result:
            print("SUCCESS: New request notification sent successfully!")
        else:
            print("FAILED: Failed to send new request notification")
        
        # Clean up
        test_request.delete()
        print("Test request cleaned up")
        
        return result
        
    except Exception as e:
        print(f"FAILED Error in new request notification test: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_order_placed_notification():
    """Test order placed notification email"""
    print(f"\n3. Testing order placed notification to {TEST_EMAIL}...")
    
    try:
        # Get test users and vendor
        test_user = create_or_update_test_user()
        admin_user = create_or_update_admin_user()
        vendor = Vendor.objects.first()
        
        if not test_user or not admin_user or not vendor:
            print("FAILED: Missing required test data")
            return False
        
        # Create a test request in ORDERED status
        test_request = Request.objects.create(
            item_name="Order Placed Test Item",
            requested_by=test_user,
            vendor=vendor,
            catalog_number="ORDER-TEST-001",
            quantity=2,
            unit_size="pieces",
            unit_price=45.00,
            status='ORDERED',
            notes="This is a test to verify order placed notifications."
        )
        
        print(f"Created test order: {test_request.id}")
        
        # Send order placed notification
        result = EmailNotificationService.send_order_placed_notification(test_request, admin_user)
        
        if result:
            print("SUCCESS Order placed notification sent successfully!")
        else:
            print("FAILED Failed to send order placed notification")
        
        # Clean up
        test_request.delete()
        print("Test request cleaned up")
        
        return result
        
    except Exception as e:
        print(f"FAILED Error in order placed notification test: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_item_received_notification():
    """Test item received notification email"""
    print(f"\n4. Testing item received notification to {TEST_EMAIL}...")
    
    try:
        # Get test users and vendor
        test_user = create_or_update_test_user()
        admin_user = create_or_update_admin_user()
        vendor = Vendor.objects.first()
        
        if not test_user or not admin_user or not vendor:
            print("FAILED: Missing required test data")
            return False
        
        # Create a test request in RECEIVED status
        test_request = Request.objects.create(
            item_name="Item Received Test Reagent",
            requested_by=test_user,
            vendor=vendor,
            catalog_number="RECEIVED-TEST-001",
            quantity=1,
            unit_size="bottle",
            unit_price=120.00,
            status='RECEIVED',
            notes="This is a test to verify item received notifications."
        )
        
        print(f"Created test received item: {test_request.id}")
        
        # Send item received notification
        result = EmailNotificationService.send_item_received_notification(
            test_request,
            admin_user,
            quantity_received=1,
            location="Main Lab Refrigerator"
        )
        
        if result:
            print("SUCCESS Item received notification sent successfully!")
        else:
            print("FAILED Failed to send item received notification")
        
        # Clean up
        test_request.delete()
        print("Test request cleaned up")
        
        return result
        
    except Exception as e:
        print(f"FAILED Error in item received notification test: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print("=" * 60)
    print("Quartzy Bio-Inventory Email Test")
    print(f"Testing emails to: {TEST_EMAIL}")
    print("=" * 60)
    
    # Print current email configuration
    print(f"EMAIL_BACKEND: {settings.EMAIL_BACKEND}")
    print(f"EMAIL_HOST: {settings.EMAIL_HOST}")
    print(f"EMAIL_PORT: {settings.EMAIL_PORT}")
    print(f"EMAIL_USE_TLS: {settings.EMAIL_USE_TLS}")
    print(f"EMAIL_HOST_USER: {settings.EMAIL_HOST_USER}")
    print(f"DEFAULT_FROM_EMAIL: {settings.DEFAULT_FROM_EMAIL}")
    
    if not settings.EMAIL_HOST_PASSWORD:
        print("\nWARNING  WARNING: EMAIL_HOST_PASSWORD is not set!")
        print("You need to set the email password in settings.py")
        print("For Gmail, use an App Password, not your regular password")
        return
    
    # Run tests
    tests = [
        ("Basic Email", test_basic_email),
        ("New Request Notification", test_new_request_notification),
        ("Order Placed Notification", test_order_placed_notification),
        ("Item Received Notification", test_item_received_notification),
    ]
    
    results = {}
    
    for test_name, test_func in tests:
        try:
            results[test_name] = test_func()
        except Exception as e:
            print(f"FAILED {test_name} failed with exception: {e}")
            results[test_name] = False
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY:")
    print("=" * 60)
    
    for test_name, result in results.items():
        status = "SUCCESS PASSED" if result else "FAILED FAILED"
        print(f"{test_name}: {status}")
    
    total_passed = sum(results.values())
    total_tests = len(results)
    
    print(f"\nOverall: {total_passed}/{total_tests} tests passed")
    
    if total_passed == total_tests:
        print(f"\nSUCCESS All tests passed! Check {TEST_EMAIL} for the test emails.")
    else:
        print(f"\nWARNING  Some tests failed. Please check the configuration and error messages above.")
    
    print("=" * 60)

if __name__ == "__main__":
    main()