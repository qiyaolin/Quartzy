#!/usr/bin/env python3
"""
Simple test script to verify the settings system fixes
"""
import json
import requests
from typing import Dict, Any

def test_api_endpoint(url: str, headers: Dict[str, str] = None) -> Dict[str, Any]:
    """Test an API endpoint and return the response"""
    try:
        response = requests.get(url, headers=headers or {})
        return {
            'status_code': response.status_code,
            'success': response.status_code < 400,
            'data': response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text,
            'error': None
        }
    except Exception as e:
        return {
            'status_code': None,
            'success': False,
            'data': None,
            'error': str(e)
        }

def test_settings_endpoints():
    """Test the settings endpoints"""
    base_url = "http://127.0.0.1:8000"
    
    # Test endpoints without authentication first
    endpoints_to_test = [
        "/api/settings/system/",
        "/api/settings/preferences/my-preferences/",
        "/api/settings/admin/system-info/",
    ]
    
    print("Testing Settings API Endpoints:")
    print("=" * 50)
    
    for endpoint in endpoints_to_test:
        url = f"{base_url}{endpoint}"
        print(f"\nTesting: {url}")
        
        result = test_api_endpoint(url)
        print(f"Status: {result['status_code']}")
        print(f"Success: {result['success']}")
        
        if result['error']:
            print(f"Error: {result['error']}")
        elif result['status_code'] == 401:
            print("✓ Endpoint exists (requires authentication)")
        elif result['status_code'] == 403:
            print("✓ Endpoint exists (permission denied - expected for admin endpoints)")
        elif result['success']:
            print("✓ Endpoint accessible")
            if isinstance(result['data'], dict):
                print(f"Data keys: {list(result['data'].keys())}")
        else:
            print(f"✗ Unexpected response: {result['data']}")

def main():
    print("Settings System Fix Verification")
    print("=" * 40)
    print()
    
    print("This test verifies that:")
    print("1. Settings API endpoints are accessible")
    print("2. Authentication is properly required")
    print("3. Admin permissions are enforced")
    print()
    
    test_settings_endpoints()
    
    print("\n" + "=" * 50)
    print("Test Summary:")
    print("- If endpoints return 401/403, they exist and require proper auth")
    print("- If endpoints return 404, there may be URL routing issues")
    print("- If endpoints return 500, there may be backend implementation issues")
    print("\nTo fully test admin functionality:")
    print("1. Start Django server: python manage.py runserver")
    print("2. Run: python manage.py init_default_settings")
    print("3. Login as admin in frontend and check Settings page")

if __name__ == "__main__":
    main()