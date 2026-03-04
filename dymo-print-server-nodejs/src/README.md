# DYMO Remote Print Server

A centralized printing solution for DYMO label printers that enables remote barcode and label printing through a web-based interface.

## Overview

This system allows you to send print jobs from a web application to DYMO printers located on different machines. It consists of:

- **Print Agent**: A Python service that runs on the machine with the DYMO printer
- **Web Interface**: HTML templates for print job execution and configuration testing
- **Backend Integration**: RESTful API endpoints for job management

## Features

- ✅ **Remote Printing**: Send print jobs from anywhere to local DYMO printers
- ✅ **Multiple Printer Support**: Automatically detect and select appropriate printers
- ✅ **Dynamic Templates**: Support for custom label layouts via .label files
- ✅ **Printer Selection**: Configure specific printer preferences (Label vs Tape)
- ✅ **Real-time Status**: Job status tracking and error reporting
- ✅ **Configuration Testing**: Built-in tools to test printer configurations
- ✅ **Auto-retry**: Automatic retry mechanism for failed print jobs

## Requirements

### Hardware
- DYMO LabelWriter printer (450, 450 DUO, etc.)
- Windows PC connected to the printer

### Software
- Python 3.7+
- DYMO Label Framework v8.7.4+ (free download from DYMO website)
- Modern web browser (Chrome, Firefox, Edge)
- Backend API server (Django/Flask/etc.)

## Installation

### 1. Install DYMO Label Framework
1. Download and install [DYMO Label Framework](https://www.dymo.com/support) from the official website
2. Ensure the DYMO Web Service is running after installation

### 2. Set Up Print Agent
1. Copy the entire `dymo-print-server-nodejs/src` folder to your print station PC
2. Install Python dependencies:
   ```bash
   pip install requests
   ```

### 3. Configure the Print Agent
Edit `print_agent_config.json`:

```json
{
  "backend_url": "https://your-backend-api.com",
  "server_id": "lab-print-server-001",
  "api_token": "your-api-token-here",
  "api_endpoints": {
    "fetch_job": "/api/printing/api/fetch-pending-job/",
    "get_jobs": "/api/printing/api/jobs/",
    "update_status": "/api/printing/api/jobs/{job_id}/update_status/"
  },
  "poll_interval": 3,
  "default_print_mode": "tape",
  "mode_template_map": {
    "tape": "sample.label",
    "label": "QRcode.label"
  },
  "printer_selection": {
    "mode": "auto",
    "preferred_printer": "",
    "label_printer_keywords": ["Label", "LabelWriter"],
    "tape_printer_keywords": ["Tape", "LabelManager"]
  },
  "mode_printer_map": {
    "tape": { "mode": "tape" },
    "label": { "mode": "label" }
  },
  "auto_close_browser": false,
  "debug_mode": true
}
```

## Configuration Options

### Printer Selection Modes

| Mode | Description | When to Use |
|------|-------------|-------------|
| `auto` | Automatically selects first available printer | Single printer setup |
| `specific` | Uses exact printer name match | When you know the exact printer name |
| `label` | Prefers printers with "Label" keywords | For label-only printing |
| `tape` | Prefers printers with "Tape" keywords | For tape-only printing |

### Key Configuration Parameters

- **`backend_url`**: Your API server URL
- **`api_token`**: Authentication token for API calls
- **`poll_interval`**: How often to check for new jobs (seconds)
- **`default_print_mode`**: Default mode when job does not specify `printMode`
- **`mode_template_map`**: Template mapping for each mode (`tape` / `label`)
- **`mode_printer_map`**: Printer selection mode mapping per print mode
- **`preferred_printer`**: Exact name of preferred printer
- **`auto_close_browser`**: Whether to close print window after completion
- **`debug_mode`**: Enable detailed logging

## Usage

### 1. Test Your Configuration
Open the configuration test tool in your browser:
```
file:///path/to/dymo-print-server-nodejs/src/config_test.html
```

1. Click "🔍 Detect Printers" to see available printers
2. Select your preferred printer mode
3. Click "🧪 Test Configuration" to verify setup
4. Click "🖨️ Simulate Print Job" for a test print

### 2. Start the Print Agent
```bash
cd path/to/dymo-print-server-nodejs/src
python production_print_agent.py
```

You should see:
```
2025-01-XX XX:XX:XX,XXX - INFO - Loading configuration from: /full/path/to/print_agent_config.json
2025-01-XX XX:XX:XX,XXX - INFO - Printer selection mode: specific
2025-01-XX XX:XX:XX,XXX - INFO - Preferred printer: DYMO LabelWriter 450 DUO Tape
2025-01-XX XX:XX:XX,XXX - INFO - Production DYMO Print Agent initialized
2025-01-XX XX:XX:XX,XXX - INFO - Starting DYMO print agent service (Press Ctrl+C to stop)
2025-01-XX XX:XX:XX,XXX - INFO - Health check passed
```

### 3. Send Print Jobs from Your Application
Create print jobs via your backend API with this structure:

```json
{
  "label_data": {
    "itemName": "Sample Item",
    "barcode": "ITEM123456",
    "customText": "Custom Label Text",
    "fontSize": "10",
    "isBold": true,
    "printMode": "tape",
    "templateFile": "sample.label"
  }
}
```

## API Integration

### Backend Requirements
Your backend should provide these endpoints:

#### GET `/api/printing/api/fetch-pending-job/?server_id=<server-id>`
Atomically claims one pending/retryable print job:
```json
{
  "id": 123,
  "status": "processing",
  "label_data": {
    "itemName": "Test Item",
    "barcode": "TEST123",
    "customText": "Custom Text",
    "printMode": "label"
  }
}
```

Returns `204 No Content` when no job is available.

#### GET `/api/printing/api/jobs/`
Legacy list endpoint (kept for compatibility):
```json
{
  "results": [
    {
      "id": 123,
      "status": "pending"
    }
  ]
}
```

#### POST `/api/printing/api/jobs/{job_id}/update_status/`
Updates job status:
```json
{
  "status": "completed",
  "updated_at": "2025-01-XX T XX:XX:XX"
}
```

## Troubleshooting

### Common Issues

#### 1. "No DYMO printers found"
- Ensure DYMO Label Framework is installed
- Check that DYMO Web Service is running
- Verify printer is connected and powered on
- Try restarting the DYMO Web Service

#### 2. "Wrong printer selected"
- Use `config_test.html` to see available printer names
- Update `preferred_printer` with exact name
- Check printer keywords match your hardware

#### 3. "Print job fails"
- Enable `debug_mode: true` in configuration
- Check browser console for detailed errors
- Verify label template is valid
- Ensure printer has compatible label stock

#### 4. "Template type is incompatible with print mode"
- `printMode: "tape"` requires a `ContinuousLabel` template (e.g. `sample.label`)
- `printMode: "label"` requires a `DieCutLabel` template (e.g. `QRcode.label`)
- Avoid sending `QRcode.label` to tape mode, or `sample.label` to label mode

#### 4. "Configuration not loading"
- Check that `print_agent_config.json` is in the same directory as the Python script
- Verify JSON syntax is valid
- Look for "Loading configuration from:" in startup logs

### Debug Information

Enable debug logging by setting `debug_mode: true` in your configuration. This will show:

- 🖨️ Available printers and their connection status
- 🎯 Printer selection logic and results
- 🔧 Configuration parameters being used
- ✅/❌ Print job execution results

### Log Files

The print agent creates a `print_agent.log` file with detailed operation logs. Check this file for:
- Connection errors
- Print job processing details
- API communication issues
- Printer selection decisions

## File Structure

```
dymo-print-server-nodejs/src/
├── production_print_agent.py      # Main print agent service
├── print_agent_config.json        # Configuration file
├── auto_print_template.html        # Print execution template
├── config_test.html               # Configuration testing tool
├── dymo.connect.framework.js      # DYMO JavaScript framework
├── label_template_parser.py       # Dynamic template parser
├── sample.label                   # Example label template
└── README.md                      # This documentation
```

## Support

For issues and troubleshooting:

1. Check the `print_agent.log` file for error details
2. Use the `config_test.html` tool to verify your setup
3. Enable debug mode for detailed logging
4. Ensure all prerequisites are properly installed

## License

This project is provided as-is for internal use. Please ensure compliance with DYMO's terms of service when using their framework and drivers.
