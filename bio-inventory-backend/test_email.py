#!/usr/bin/env python
"""
Simple script to test email notification functionality
Run this from the Django project root directory:
python test_email.py
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

def test_email_service():
    """Test email notification service"""
    print("Testing Email Notification Service...")
    
    # Check if we have test data
    try:
        admin_user = User.objects.filter(is_staff=True).first()
        regular_user = User.objects.filter(is_staff=False).first()
        vendor = Vendor.objects.first()
        
        if not admin_user or not regular_user or not vendor:
            print("Error: Missing test data. Please ensure you have:")
            print("- At least one admin user")
            print("- At least one regular user")
            print("- At least one vendor")
            return False
            
        print(f"Admin user: {admin_user.username}")
        print(f"Regular user: {regular_user.username}")
        print(f"Vendor: {vendor.name}")
        
        # Create a test request
        test_request = Request.objects.create(
            item_name="Test Email Notification Item",
            requested_by=regular_user,
            vendor=vendor,
            catalog_number="TEST-001",
            quantity=5,
            unit_size="pieces",
            unit_price=25.00,
            status='NEW',
            notes="This is a test request for email notifications"
        )
        
        print(f"Created test request: {test_request.id}")
        
        # Test 1: New request notification
        print("\n1. Testing new_request email notification...")
        result1 = EmailNotificationService.send_new_request_notification(test_request)
        print(f"New request notification sent: {result1}")
        
        # Test 2: Order placed notification (simulate status change)
        test_request.status = 'ORDERED'
        test_request.save()
        print("\n2. Testing order_placed email notification...")
        result2 = EmailNotificationService.send_order_placed_notification(test_request, admin_user)
        print(f"Order placed notification sent: {result2}")
        
        # Test 3: Item received notification
        test_request.status = 'RECEIVED'
        test_request.save()
        print("\n3. Testing item_received email notification...")
        result3 = EmailNotificationService.send_item_received_notification(
            test_request, 
            admin_user, 
            quantity_received=5,
            location="Test Lab Location"
        )
        print(f"Item received notification sent: {result3}")
        
        # Clean up test data
        test_request.delete()
        print(f"\nTest request {test_request.id} cleaned up")
        
        return result1 or result2 or result3
        
    except Exception as e:
        print(f"Error during email test: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_email_config():
    """Test email configuration"""
    print("Testing Email Configuration...")
    
    from django.conf import settings
    from django.core.mail import send_mail
    
    print(f"EMAIL_BACKEND: {settings.EMAIL_BACKEND}")
    print(f"EMAIL_HOST: {settings.EMAIL_HOST}")
    print(f"EMAIL_PORT: {settings.EMAIL_PORT}")
    print(f"EMAIL_USE_TLS: {settings.EMAIL_USE_TLS}")
    print(f"EMAIL_HOST_USER: {settings.EMAIL_HOST_USER}")
    print(f"DEFAULT_FROM_EMAIL: {settings.DEFAULT_FROM_EMAIL}")
    
    # Get a test recipient
    admin_user = User.objects.filter(is_staff=True, email__isnull=False).exclude(email='').first()
    if not admin_user:
        print("No admin user with email found for basic email test")
        return False
    
    print(f"Test recipient: {admin_user.email}")
    
    # Send a simple test email
    try:
        send_mail(
            subject='[Quartzy Lab System] Email Configuration Test',
            message='This is a test email to verify email configuration is working.',
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[admin_user.email],
            fail_silently=False,
        )
        print("Basic email test sent successfully!")
        return True
    except Exception as e:
        print(f"Failed to send basic email test: {e}")
        return False

if __name__ == "__main__":
    print("=" * 50)
    print("Quartzy Bio-Inventory Email Test")
    print("=" * 50)
    
    # Test basic email configuration
    config_test = test_email_config()
    print(f"Email configuration test: {'PASSED' if config_test else 'FAILED'}")
    
    print("\n" + "=" * 50)
    
    # Test email service functionality
    if config_test:  # Only test email service if basic config works
        service_test = test_email_service()
        print(f"Email service test: {'PASSED' if service_test else 'FAILED'}")
    else:
        print("Skipping email service test due to configuration failure")
        service_test = False
    
    print("\n" + "=" * 50)
    print("Test Summary:")
    print(f"Configuration: {'✓' if config_test else '✗'}")
    print(f"Service: {'✓' if service_test else '✗'}")
    
    if not config_test:
        print("\nTo fix email configuration:")
        print("1. Set EMAIL_HOST_PASSWORD in settings.py or environment variable")
        print("2. Ensure admin users have valid email addresses")
        print("3. Check firewall/network settings for SMTP access")
    
    print("=" * 50)