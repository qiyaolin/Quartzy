# Centralized Label Printing Setup Guide

This guide will help you set up the centralized label printing system for the Bio-Inventory application.

## System Overview

The centralized printing system consists of three components:

1. **Frontend (React)** - Users submit print requests
2. **Backend (Django)** - Manages print job queue  
3. **Print Server (Python)** - Processes jobs and controls the printer

## Architecture

```
User → Frontend → Backend API → Print Job Queue → Print Server → DYMO Printer
```

## Setup Instructions

### 1. Backend Setup (Django)

The backend components have been automatically created. You need to:

#### Run Migrations
```bash
cd bio-inventory-backend
python manage.py makemigrations printing
python manage.py migrate
```

#### Create API Token for Print Server
```bash
python manage.py shell
```

In the Django shell:
```python
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token

# Create a user for the print server (or use existing)
user = User.objects.create_user('print_server', 'admin@lab.com', 'secure_password')

# Create token
token = Token.objects.create(user=user)
print(f"API Token: {token.key}")
```

Save this token - you'll need it for the print server configuration.

### 2. Print Server Setup

#### Requirements
- Windows computer connected to DYMO printer
- DYMO Label Software installed and working
- Python 3.7+ installed

#### Installation Steps

1. **Install Python dependencies:**
```bash
pip install -r requirements_print_server.txt
```

2. **Configure the print server:**
Edit `print_server_config.json`:
```json
{
  "backend_url": "http://your-django-server:8000",
  "api_token": "your-api-token-from-step-1",
  "server_id": "lab-print-server-001",
  "server_name": "Lab Main Print Server",
  "server_location": "Biology Lab - Room 101",
  "printer_name": "DYMO LabelWriter 450"
}
```

3. **Test the print server:**
```bash
python print_server.py --config print_server_config.json --debug
```

4. **Set up as Windows Service (Optional):**
For production, you may want to run the print server as a Windows service.

### 3. Frontend Integration

The frontend components have been created and are ready to use:

- `PrintSelector` - Smart component that auto-detects available printing methods
- `CentralizedBarcodeComponent` - Handles centralized printing
- `printingService` - API client for print job management

#### Usage in Components

Replace existing `BarcodeComponent` usage with `PrintSelector`:

```tsx
// Before
import BarcodeComponent from './BarcodeComponent';

// After  
import PrintSelector from './PrintSelector';

// In your component
<PrintSelector 
  barcodeData={item.barcode}
  itemName={item.name}
  itemId={item.id}
  priority="normal"
  allowTextEdit={true}
/>
```

### 4. Testing the System

#### Test Print Job Creation
```bash
# Test API endpoint
curl -X POST http://localhost:8000/api/printing/api/queue-job/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Token your-api-token" \
  -d '{
    "label_data": {
      "itemName": "Test Item",
      "barcode": "TEST123"
    },
    "priority": "normal"
  }'
```

#### Test Print Server
1. Start the print server
2. Submit a print job from the frontend
3. Check the print server logs
4. Verify the label prints correctly

## Configuration Options

### Backend Settings (Django)

Add to your Django settings if needed:
```python
# Optional: Custom pagination for print jobs
REST_FRAMEWORK = {
    'PAGE_SIZE': 50
}

# Optional: Print job retention policy
PRINT_JOB_RETENTION_DAYS = 30
```

### Print Server Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| `backend_url` | Django backend URL | `http://localhost:8000` |
| `api_token` | Authentication token | Required |
| `poll_interval` | How often to check for jobs (seconds) | `5` |
| `server_id` | Unique server identifier | Auto-generated |
| `printer_name` | DYMO printer name | Auto-detected |
| `heartbeat_interval` | Heartbeat frequency (seconds) | `60` |

### Frontend Configuration

The frontend automatically detects if centralized printing is available and falls back to local printing if needed.

## Troubleshooting

### Common Issues

#### Print Server Can't Connect to Backend
- Check `backend_url` in configuration
- Verify API token is correct
- Ensure Django server is running
- Check firewall settings

#### DYMO Printer Not Found
- Verify DYMO Label Software is installed
- Check printer is connected and powered on
- Ensure printer drivers are installed
- Check `printer_name` in configuration

#### Print Jobs Stay in "Processing" State
- Check print server logs for errors
- Verify DYMO software is running
- Test printer with DYMO software directly
- Check print server has correct permissions

#### Frontend Shows "Service Unavailable"
- Verify backend is running
- Check Django URLs configuration
- Test API endpoints manually
- Check browser network requests

### Logging

#### Print Server Logs
Logs are written to `print_server.log` and console:
```bash
# View real-time logs
tail -f print_server.log
```

#### Django Logs
Enable Django logging for printing app:
```python
LOGGING = {
    'loggers': {
        'printing': {
            'level': 'DEBUG',
            'handlers': ['console'],
        },
    },
}
```

## Production Deployment

### Security Considerations
- Use strong API tokens
- Run print server with minimal privileges
- Consider VPN for remote print servers
- Regularly rotate API tokens

### Monitoring
- Set up monitoring for print server uptime
- Monitor print job queue length
- Track print success/failure rates
- Alert on printer offline status

### Backup
- Print job data is stored in Django database
- Consider backing up print job history
- Document print server configuration

## API Reference

### Print Job Endpoints

| Endpoint | Method | Description |
|----------|---------|-------------|
| `/api/printing/api/queue-job/` | POST | Create new print job |
| `/api/printing/api/jobs/` | GET | List print jobs |
| `/api/printing/api/jobs/{id}/` | GET | Get specific job |
| `/api/printing/api/jobs/{id}/retry/` | POST | Retry failed job |
| `/api/printing/api/stats/` | GET | Get printing statistics |
| `/api/printing/api/fetch-pending-job/` | GET | Fetch next job (print server) |
| `/api/printing/api/jobs/{id}/update_status/` | POST | Update job status (print server) |

### Print Server Management

| Endpoint | Method | Description |
|----------|---------|-------------|
| `/api/printing/api/servers/` | GET/POST | List/create print servers |
| `/api/printing/api/servers/{id}/heartbeat/` | POST | Send heartbeat |
| `/api/printing/api/servers/online_servers/` | GET | List online servers |

## Support

For issues and questions:
1. Check the logs first
2. Verify configuration settings
3. Test individual components
4. Check network connectivity
5. Review Django admin interface for print jobs and servers