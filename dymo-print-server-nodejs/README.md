# DYMO Centralized Print System

A production-ready centralized printing solution for DYMO label printers that can be deployed on any Windows computer to serve as a print station.

## Features
- ✅ Centralized print job management
- ✅ Automatic job polling from backend server
- ✅ Reliable data transmission using embedded data method
- ✅ Auto-close browser windows after printing
- ✅ Comprehensive error handling and logging
- ✅ Support for custom text and barcode printing
- ✅ Production-ready configuration

## Quick Start

1. **Install Requirements**
   - DYMO Label Framework
   - Python 3.7+
   - Connected DYMO printer

2. **Configure**
   - Edit `src/print_agent_config.json` with your backend URL
   - Verify DYMO framework path in `src/auto_print_template.html`

3. **Run**
   ```cmd
   cd src
   python production_print_agent.py
   ```

## File Structure
```
dymo-print-server-nodejs/
├── src/
│   ├── production_print_agent.py    # Main print agent
│   ├── auto_print_template.html     # Print template
│   └── print_agent_config.json     # Configuration
├── DEPLOYMENT_GUIDE.md             # Detailed setup guide
└── README.md                       # This file
```

## Configuration
Edit `src/print_agent_config.json`:
```json
{
  "backend_url": "https://your-backend-server.com",
  "api_token": "",
  "poll_interval": 3,
  "auto_close_browser": true,
  "debug_mode": false
}
```

## API Integration
Your backend should provide:
- `GET /api/printing/api/jobs/` - Return pending print jobs
- `POST /api/printing/api/jobs/{id}/update-status/` - Receive status updates

## Print Job Format
```json
{
  "id": 123,
  "label_data": {
    "itemName": "Sample Item",
    "barcode": "SAMPLE-123",
    "customText": "Optional custom text",
    "fontSize": "8",
    "isBold": false
  }
}
```

## Troubleshooting
- Check `print_agent.log` for detailed error information
- Verify DYMO framework installation and printer connection
- Ensure backend API endpoints are accessible
- Test with manual print jobs first

For detailed setup instructions, see [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md).

## Version
Production v1.0.0 - Stable release with embedded data method