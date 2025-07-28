# DYMO Centralized Print System

A production-ready centralized printing solution for DYMO label printers that can be deployed on **any Windows computer** to serve as a print station. Fully portable and self-contained.

## Features
- ✅ **Portable**: Works on any Windows computer
- ✅ **Centralized**: Print job management from remote backend
- ✅ **Automatic**: Polls backend server for new jobs
- ✅ **Reliable**: Embedded data transmission method
- ✅ **Clean**: Auto-close browser windows after printing
- ✅ **Robust**: Comprehensive error handling and logging
- ✅ **Flexible**: Support for custom text and barcode printing
- ✅ **Production-ready**: Stable configuration and deployment

## Quick Start

1. **Setup Requirements**
   - Install DYMO Label Framework from DYMO website
   - Install Python 3.7+ from python.org (check "Add to PATH")
   - Connect DYMO printer via USB

2. **Configure System**
   - Copy `src/print_agent_config.example.json` to `src/print_agent_config.json`
   - Edit configuration file with your backend server URL and API token

3. **Start Print Station**
   - Double-click `start_print_agent.bat`
   - Or run manually: `python src/production_print_agent.py`

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