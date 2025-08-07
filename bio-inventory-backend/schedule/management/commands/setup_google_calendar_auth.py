"""
Django management command to set up Google Calendar OAuth2 authentication
Usage: python manage.py setup_google_calendar_auth
"""

import os
import json
import webbrowser
from django.core.management.base import BaseCommand, CommandError
from django.conf import settings

try:
    from google_auth_oauthlib.flow import Flow
    from google.auth.transport.requests import Request
except ImportError:
    Flow = None
    Request = None


class Command(BaseCommand):
    help = 'Set up Google Calendar OAuth2 authentication'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--client-secrets-file',
            type=str,
            required=True,
            help='Path to Google OAuth2 client secrets JSON file'
        )
        parser.add_argument(
            '--credentials-output',
            type=str,
            help='Output path for credentials file (default: google_calendar_credentials.json)'
        )
        parser.add_argument(
            '--port',
            type=int,
            default=8080,
            help='Local server port for OAuth callback (default: 8080)'
        )
        parser.add_argument(
            '--no-browser',
            action='store_true',
            help='Do not automatically open browser for authorization'
        )
    
    def handle(self, *args, **options):
        if not Flow:
            raise CommandError(
                "Google OAuth libraries not available. "
                "Please install: pip install google-auth-oauthlib"
            )
        
        client_secrets_file = options['client_secrets_file']
        credentials_output = options.get('credentials_output') or 'google_calendar_credentials.json'
        port = options['port']
        no_browser = options['no_browser']
        
        # Check if client secrets file exists
        if not os.path.exists(client_secrets_file):
            raise CommandError(f"Client secrets file not found: {client_secrets_file}")
        
        # Set up OAuth2 flow
        scopes = [
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/calendar.events'
        ]
        
        try:
            flow = Flow.from_client_secrets_file(
                client_secrets_file,
                scopes=scopes,
                redirect_uri=f'http://localhost:{port}'
            )
            
            # Start the OAuth2 flow
            self.stdout.write("Starting Google Calendar OAuth2 setup...")
            self.stdout.write("")
            
            # Get authorization URL
            auth_url, _ = flow.authorization_url(
                access_type='offline',
                include_granted_scopes='true'
            )
            
            self.stdout.write("Please visit this URL to authorize the application:")
            self.stdout.write(auth_url)
            self.stdout.write("")
            
            if not no_browser:
                self.stdout.write("Opening browser automatically...")
                webbrowser.open(auth_url)
                self.stdout.write("")
            
            # Get authorization code from user
            auth_code = input("Enter the authorization code: ").strip()
            
            if not auth_code:
                raise CommandError("No authorization code provided")
            
            # Exchange code for credentials
            self.stdout.write("Exchanging authorization code for credentials...")
            flow.fetch_token(code=auth_code)
            
            credentials = flow.credentials
            
            # Save credentials
            creds_data = {
                'token': credentials.token,
                'refresh_token': credentials.refresh_token,
                'token_uri': credentials.token_uri,
                'client_id': credentials.client_id,
                'client_secret': credentials.client_secret,
                'scopes': list(credentials.scopes)
            }
            
            with open(credentials_output, 'w') as f:
                json.dump(creds_data, f, indent=2)
            
            self.stdout.write("")
            self.stdout.write(
                self.style.SUCCESS(
                    f"✓ Credentials saved to: {credentials_output}"
                )
            )
            
            # Test the credentials
            self.stdout.write("Testing credentials...")
            if self.test_credentials(credentials_output):
                self.stdout.write(
                    self.style.SUCCESS("✓ Credentials are working!")
                )
                
                # Show next steps
                self.stdout.write("")
                self.stdout.write("=== Next Steps ===")
                self.stdout.write(f"1. Add to your Django settings:")
                self.stdout.write(f"   GOOGLE_CALENDAR_CREDENTIALS_PATH = '{os.path.abspath(credentials_output)}'")
                self.stdout.write(f"   GOOGLE_CALENDAR_ID = 'primary'  # or your specific calendar ID")
                self.stdout.write("")
                self.stdout.write("2. Test the sync:")
                self.stdout.write("   python manage.py sync_google_calendar --status")
                self.stdout.write("")
                self.stdout.write("3. Perform initial sync:")
                self.stdout.write("   python manage.py sync_google_calendar --dry-run")
                self.stdout.write("   python manage.py sync_google_calendar")
                
            else:
                self.stdout.write(
                    self.style.WARNING("⚠ Credentials saved but test failed")
                )
        
        except Exception as e:
            raise CommandError(f"OAuth2 setup failed: {e}")
    
    def test_credentials(self, credentials_file):
        """Test the saved credentials"""
        try:
            from schedule.services.google_calendar_service import GoogleCalendarService
            
            gcal_service = GoogleCalendarService(credentials_path=credentials_file)
            service = gcal_service.get_service()
            
            if service:
                # Try to list calendars to test access
                calendar_list = service.calendarList().list().execute()
                calendars = calendar_list.get('items', [])
                
                self.stdout.write(f"✓ Found {len(calendars)} accessible calendars:")
                for calendar in calendars[:3]:  # Show first 3
                    name = calendar.get('summary', 'Unknown')
                    calendar_id = calendar.get('id', 'Unknown')
                    self.stdout.write(f"  - {name} ({calendar_id})")
                
                return True
            else:
                return False
                
        except Exception as e:
            self.stdout.write(f"Test failed: {e}")
            return False