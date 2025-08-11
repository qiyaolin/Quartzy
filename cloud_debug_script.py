#!/usr/bin/env python
"""
Debug script for cloud presentation count issue
"""
import requests
import json

# Cloud API configuration
BASE_URL = "https://lab-inventory-467021.nn.r.appspot.com"
TOKEN = "58d9d8def6c67f749e1847db1792ab28504b454e"

headers = {
    "Authorization": f"Token {TOKEN}",
    "Content-Type": "application/json"
}

def test_cloud_dashboard():
    """Test cloud dashboard API"""
    print("=== Cloud Dashboard Analysis ===\n")
    
    # Query dashboard overview
    url = f"{BASE_URL}/schedule/unified-dashboard/overview/"
    try:
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            data = response.json()
            print("Dashboard API Response:")
            print(f"  Status: {response.status_code}")
            print(f"  Stats: {json.dumps(data['stats'], indent=2)}")
            print(f"  Upcoming meetings count: {len(data['upcoming_meetings'])}")
            
            # Show upcoming meetings details
            if data['upcoming_meetings']:
                print(f"\n  Upcoming meetings:")
                for meeting in data['upcoming_meetings']:
                    presenters = meeting.get('presenter_names', [])
                    print(f"    Meeting {meeting['id']}: {meeting['meeting_type']} on {meeting['date']}")
                    print(f"      Presenters: {presenters}")
                    print(f"      Is presenter: {meeting['is_presenter']}")
        else:
            print(f"Dashboard API failed: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"Error accessing dashboard API: {e}")

def analyze_issue():
    """Analyze the presentation count issue"""
    print("\n=== Issue Analysis ===")
    
    print("From the screenshots and API response, we can see:")
    print("1. Admin interface shows 13 meeting instances from Aug-Nov 2025")
    print("2. Users like rodrigo, baishali are assigned as presenters")
    print("3. But dashboard API shows presentations_this_year = 0")
    print("\nPossible causes:")
    print("• Presenter status might be 'assigned' not 'completed'")
    print("• The count logic only counts 'completed' presentations")
    print("• admin user (Token owner) might not have any presentations assigned")
    print("• Year filtering might have an issue")
    
    print("\n=== Recommended Solution ===")
    print("The issue is likely the same as we found in local testing:")
    print("1. Cloud code still only counts 'completed' presentations")  
    print("2. But presenters are in 'assigned' or other non-completed status")
    print("3. Need to deploy the fixed code that counts non-completed statuses")

if __name__ == '__main__':
    test_cloud_dashboard()
    analyze_issue()