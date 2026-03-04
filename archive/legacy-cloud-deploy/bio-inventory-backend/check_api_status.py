#!/usr/bin/env python3
"""
Check API Status after deployment
Tests all the schedule management endpoints
"""

import requests
import json
from datetime import datetime

# API endpoints to test
BASE_URL = "https://lab-inventory-467021.nn.r.appspot.com"
FRONTEND_URL = "https://lab-inventory-467021.web.app"

ENDPOINTS = [
    "/api/schedules/",
    "/api/schedules/initialize_defaults/",
    "/schedule/equipment/",
    "/schedule/equipment/initialize_defaults/",
    "/api/group-meetings/",
    "/api/users/active/",
    "/api/meeting-configurations/",
    "/api/recurring-tasks/",
    "/api/notifications/summary/",
    "/health/",
    "/ready/"
]

def check_endpoint(url, method='GET'):
    """Check if an endpoint is responding"""
    try:
        full_url = f"{BASE_URL}{url}"
        
        if method == 'GET':
            response = requests.get(full_url, timeout=10)
        elif method == 'POST':
            response = requests.post(full_url, json={}, timeout=10)
        
        status = "✅ OK" if response.status_code < 500 else f"❌ ERROR {response.status_code}"
        
        return {
            'url': url,
            'status_code': response.status_code,
            'status': status,
            'response_time': response.elapsed.total_seconds()
        }
        
    except requests.RequestException as e:
        return {
            'url': url,
            'status_code': 'TIMEOUT',
            'status': f"❌ FAILED: {str(e)}",
            'response_time': None
        }

def main():
    print("="*60)
    print("Schedule Management API Status Check")
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*60)
    print()
    
    results = []
    
    # Test GET endpoints
    print("Testing GET endpoints...")
    for endpoint in ENDPOINTS:
        if 'initialize_defaults' not in endpoint:
            result = check_endpoint(endpoint, 'GET')
            results.append(result)
            print(f"{result['status']} {result['url']} ({result['status_code']})")
    
    print()
    
    # Test POST endpoints
    print("Testing POST endpoints...")
    post_endpoints = [
        "/api/schedules/initialize_defaults/",
        "/schedule/equipment/initialize_defaults/"
    ]
    
    for endpoint in post_endpoints:
        result = check_endpoint(endpoint, 'POST')
        results.append(result)
        print(f"{result['status']} {result['url']} ({result['status_code']})")
    
    print()
    print("="*60)
    
    # Summary
    ok_count = sum(1 for r in results if r['status_code'] < 500 and r['status_code'] != 'TIMEOUT')
    total_count = len(results)
    
    print(f"Summary: {ok_count}/{total_count} endpoints responding")
    
    if ok_count == total_count:
        print("🎉 All endpoints are working!")
        print(f"Frontend should now work at: {FRONTEND_URL}")
    else:
        print("⚠️  Some endpoints are not responding correctly.")
        failed = [r for r in results if r['status_code'] >= 500 or r['status_code'] == 'TIMEOUT']
        print("Failed endpoints:")
        for r in failed:
            print(f"  - {r['url']}: {r['status']}")
    
    print()
    print("Next steps:")
    print("1. Open the frontend at:", FRONTEND_URL)
    print("2. Check the browser console for any remaining errors")
    print("3. Test schedule creation and equipment management")
    
    return ok_count == total_count

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)