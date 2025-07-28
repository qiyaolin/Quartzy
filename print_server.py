#!/usr/bin/env python3
"""
Centralized Print Server for Bio-Inventory System

This script runs on the computer connected to the DYMO label printer
and polls the Django backend for print jobs to process.

Requirements:
- Python 3.7+
- requests library
- DYMO printer connected and installed
- DYMO Connect software running

Usage:
    python print_server.py --config config.json
    
Environment Variables:
    BACKEND_URL - Django backend URL (default: http://localhost:8000)
    API_TOKEN - Authentication token for Django API
    POLL_INTERVAL - Polling interval in seconds (default: 5)
    SERVER_ID - Unique identifier for this print server
    PRINTER_NAME - Name of the DYMO printer to use
"""

import os
import sys
import time
import json
import logging
import argparse
import requests
import platform
from datetime import datetime, timedelta
from typing import Dict, Optional, Any, List
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('print_server.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class PrintServerConfig:
    """Configuration management for the print server"""
    
    def __init__(self, config_file: Optional[str] = None):
        self.config = self._load_config(config_file)
    
    def _load_config(self, config_file: Optional[str]) -> Dict[str, Any]:
        """Load configuration from file and environment variables"""
        config = {
            'backend_url': 'http://localhost:8000',
            'api_token': '',
            'poll_interval': 5,
            'server_id': f'print-server-{platform.node()}',
            'printer_name': '',
            'server_name': f'Print Server - {platform.node()}',
            'server_location': '',
            'max_retries': 3,
            'retry_delay': 10,
            'heartbeat_interval': 60,
            'label_template_path': 'label_templates/default.label',
            'debug': False
        }
        
        # Load from config file if provided
        if config_file and Path(config_file).exists():
            try:
                with open(config_file, 'r') as f:
                    file_config = json.load(f)
                config.update(file_config)
                logger.info(f"Loaded configuration from {config_file}")
            except Exception as e:
                logger.error(f"Failed to load config file {config_file}: {e}")
        
        # Override with environment variables
        env_mappings = {
            'BACKEND_URL': 'backend_url',
            'API_TOKEN': 'api_token',
            'POLL_INTERVAL': 'poll_interval',
            'SERVER_ID': 'server_id',
            'PRINTER_NAME': 'printer_name',
            'SERVER_NAME': 'server_name',
            'SERVER_LOCATION': 'server_location',
            'DEBUG': 'debug'
        }
        
        for env_var, config_key in env_mappings.items():
            env_value = os.environ.get(env_var)
            if env_value:
                if config_key in ['poll_interval', 'max_retries', 'retry_delay', 'heartbeat_interval']:
                    config[config_key] = int(env_value)
                elif config_key == 'debug':
                    config[config_key] = env_value.lower() in ('true', '1', 'yes')
                else:
                    config[config_key] = env_value
        
        return config
    
    def get(self, key: str, default=None):
        return self.config.get(key, default)
    
    def validate(self) -> bool:
        """Validate required configuration"""
        required = ['backend_url', 'api_token']
        missing = [key for key in required if not self.config.get(key)]
        
        if missing:
            logger.error(f"Missing required configuration: {', '.join(missing)}")
            return False
        
        return True


class DymoConnector:
    """Interface for DYMO printer operations"""
    
    def __init__(self, config: PrintServerConfig):
        self.config = config
        self.printer_name = config.get('printer_name')
        self._dymo_available = self._check_dymo_availability()
    
    def _check_dymo_availability(self) -> bool:
        """Check if DYMO printing capabilities are available"""
        try:
            # Try to import dymo libraries
            if platform.system() == 'Windows':
                return self._check_windows_dymo()
            else:
                return self._check_linux_dymo()
        except Exception as e:
            logger.error(f"DYMO availability check failed: {e}")
            return False
    
    def _check_windows_dymo(self) -> bool:
        """Check DYMO availability on Windows"""
        try:
            import win32print
            import subprocess
            
            # Check if DYMO printers are available
            printers = win32print.EnumPrinters(2)
            dymo_printers = [p[2] for p in printers if 'dymo' in p[2].lower()]
            
            if not dymo_printers:
                logger.warning("No DYMO printers found in system")
                return False
            
            logger.info(f"Found DYMO printers: {dymo_printers}")
            
            # Use specified printer or first available
            if not self.printer_name:
                self.printer_name = dymo_printers[0]
                logger.info(f"Using printer: {self.printer_name}")
            
            return True
            
        except ImportError:
            logger.error("Windows printing libraries not available. Install pywin32.")
            return False
        except Exception as e:
            logger.error(f"Windows DYMO check failed: {e}")
            return False
    
    def _check_linux_dymo(self) -> bool:
        """Check DYMO availability on Linux"""
        try:
            import subprocess
            
            # Check if lpr is available
            result = subprocess.run(['lpstat', '-p'], capture_output=True, text=True)
            if result.returncode != 0:
                logger.error("CUPS printing system not available")
                return False
            
            # Look for DYMO printers
            printers = result.stdout
            dymo_printers = [line.split()[1] for line in printers.split('\n') 
                           if 'dymo' in line.lower()]
            
            if not dymo_printers:
                logger.warning("No DYMO printers found in CUPS")
                return False
            
            logger.info(f"Found DYMO printers: {dymo_printers}")
            
            if not self.printer_name:
                self.printer_name = dymo_printers[0]
                logger.info(f"Using printer: {self.printer_name}")
            
            return True
            
        except Exception as e:
            logger.error(f"Linux DYMO check failed: {e}")
            return False
    
    def get_printer_status(self) -> Dict[str, str]:
        """Get current printer status"""
        if not self._dymo_available:
            return {'status': 'unavailable', 'message': 'DYMO not available'}
        
        try:
            if platform.system() == 'Windows':
                return self._get_windows_printer_status()
            else:
                return self._get_linux_printer_status()
        except Exception as e:
            logger.error(f"Failed to get printer status: {e}")
            return {'status': 'error', 'message': str(e)}
    
    def _get_windows_printer_status(self) -> Dict[str, str]:
        """Get printer status on Windows"""
        try:
            import win32print
            
            # Open printer
            printer_handle = win32print.OpenPrinter(self.printer_name)
            printer_info = win32print.GetPrinter(printer_handle, 2)
            win32print.ClosePrinter(printer_handle)
            
            status = printer_info['Status']
            if status == 0:
                return {'status': 'ready', 'message': 'Printer ready'}
            else:
                return {'status': 'error', 'message': f'Printer status: {status}'}
                
        except Exception as e:
            return {'status': 'error', 'message': str(e)}
    
    def _get_linux_printer_status(self) -> Dict[str, str]:
        """Get printer status on Linux"""
        try:
            import subprocess
            
            result = subprocess.run(['lpstat', '-p', self.printer_name], 
                                  capture_output=True, text=True)
            
            if result.returncode == 0 and 'enabled' in result.stdout:
                return {'status': 'ready', 'message': 'Printer ready'}
            else:
                return {'status': 'error', 'message': result.stdout or result.stderr}
                
        except Exception as e:
            return {'status': 'error', 'message': str(e)}
    
    def print_label(self, label_data: Dict[str, Any]) -> bool:
        """Print a label with the given data"""
        if not self._dymo_available:
            raise Exception("DYMO printing not available")
        
        try:
            # Create label content
            label_content = self._create_label_content(label_data)
            
            # Print using platform-specific method
            if platform.system() == 'Windows':
                return self._print_windows(label_content)
            else:
                return self._print_linux(label_content)
                
        except Exception as e:
            logger.error(f"Print failed: {e}")
            raise
    
    def _create_label_content(self, label_data: Dict[str, Any]) -> str:
        """Create DYMO label XML content"""
        item_name = label_data.get('itemName', '')
        barcode = label_data.get('barcode', '')
        custom_text = label_data.get('customText', item_name)
        font_size = label_data.get('fontSize', 8)
        is_bold = label_data.get('isBold', False)
        
        # DYMO label template (similar to frontend)
        template = f'''<?xml version="1.0" encoding="utf-8"?>
<DieCutLabel Version="8.0" Units="twips" MediaType="Default">
    <PaperOrientation>Portrait</PaperOrientation>
    <Id>Small30334</Id>
    <IsOutlined>false</IsOutlined>
    <PaperName>30334 2-1/4 in x 1-1/4 in</PaperName>
    <DrawCommands>
        <RoundRectangle X="0" Y="0" Width="3240" Height="1800" Rx="270" Ry="270" />
    </DrawCommands>
    <ObjectInfo>
        <TextObject>
            <Name>textbox</Name>
            <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
            <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
            <LinkedObjectName />
            <Rotation>Rotation0</Rotation>
            <IsMirrored>False</IsMirrored>
            <IsVariable>False</IsVariable>
            <GroupID>-1</GroupID>
            <IsOutlined>False</IsOutlined>
            <HorizontalAlignment>Center</HorizontalAlignment>
            <VerticalAlignment>Top</VerticalAlignment>
            <TextFitMode>ShrinkToFit</TextFitMode>
            <UseFullFontHeight>True</UseFullFontHeight>
            <Verticalized>False</Verticalized>
            <StyledText>
                <Element>
                    <String xml:space="preserve">{custom_text}</String>
                    <Attributes>
                        <Font Family="Arial" Size="{font_size}" Bold="{'True' if is_bold else 'False'}" Italic="False" Underline="False" Strikeout="False" />
                        <ForeColor Alpha="255" Red="0" Green="0" Blue="0" HueScale="100" />
                    </Attributes>
                </Element>
            </StyledText>
        </TextObject>
        <Bounds X="58" Y="86" Width="3125" Height="765" />
    </ObjectInfo>
    <ObjectInfo>
        <BarcodeObject>
            <Name>labelbox</Name>
            <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
            <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
            <LinkedObjectName />
            <Rotation>Rotation0</Rotation>
            <IsMirrored>False</IsMirrored>
            <IsVariable>True</IsVariable>
            <GroupID>-1</GroupID>
            <IsOutlined>False</IsOutlined>
            <Text>{barcode}</Text>
            <Type>Code128Auto</Type>
            <Size>Small</Size>
            <TextPosition>None</TextPosition>
            <TextFont Family="Arial" Size="8" Bold="False" Italic="False" Underline="False" Strikeout="False" />
            <CheckSumFont Family="Arial" Size="8" Bold="False" Italic="False" Underline="False" Strikeout="False" />
            <TextEmbedding>None</TextEmbedding>
            <ECLevel>0</ECLevel>
            <HorizontalAlignment>Center</HorizontalAlignment>
            <QuietZonesPadding Left="0" Top="0" Right="0" Bottom="0" />
        </BarcodeObject>
        <Bounds X="58" Y="948.5" Width="3125" Height="607" />
    </ObjectInfo>
</DieCutLabel>'''
        
        return template
    
    def _print_windows(self, label_content: str) -> bool:
        """Print label on Windows using DYMO Connect Framework for background printing"""
        try:
            import tempfile
            import subprocess
            import time
            
            logger.info("Starting background DYMO printing process")
            
            # Method 1: Use DYMO Connect Framework via HTML/JavaScript (background mode)
            # This is the most reliable method for automated printing
            
            # Create HTML file that uses DYMO Connect Framework for automatic printing
            html_content = f'''
<!DOCTYPE html>
<html>
<head>
    <title>DYMO Background Print</title>
    <script src="https://labelwriter.com/software/dls/sdk/js/DYMO.Label.Framework.latest.js"></script>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; background: #f0f0f0; }}
        .status {{ padding: 10px; margin: 10px 0; border-radius: 5px; }}
        .success {{ background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }}
        .error {{ background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }}
        .info {{ background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; }}
    </style>
</head>
<body>
    <h2>DYMO Background Printing Service</h2>
    <div id="status" class="status info">Initializing DYMO framework...</div>
    
    <script>
    function updateStatus(message, type = 'info') {{
        const statusDiv = document.getElementById('status');
        statusDiv.textContent = message;
        statusDiv.className = 'status ' + type;
        console.log('[DYMO Print] ' + message);
    }}
    
    function closeWindow() {{
        setTimeout(function() {{
            try {{
                window.close();
            }} catch(e) {{
                console.log('Cannot close window automatically');
            }}
        }}, 3000);
    }}
    
    // Auto-start printing when page loads
    window.onload = function() {{
        try {{
            updateStatus('Checking DYMO Connect service...', 'info');
            
            // Check if DYMO Connect is running
            dymo.label.framework.checkEnvironment().then(function(result) {{
                if (result.isFrameworkInstalled && result.isWebServicePresent) {{
                    updateStatus('DYMO Connect service detected. Getting printers...', 'info');
                    
                    // Get available printers
                    dymo.label.framework.getPrintersAsync().then(function(printers) {{
                        if (printers && printers.length > 0) {{
                            // Find target printer or use first available
                            let targetPrinter = printers.find(p => p.name.includes("{self.printer_name}")) || 
                                              printers.find(p => p.name.toLowerCase().includes("dymo")) ||
                                              printers[0];
                            
                            updateStatus('Found printer: ' + targetPrinter.name + '. Preparing label...', 'info');
                            
                            try {{
                                // Create label XML content
                                var labelXml = `{label_content.replace('`', '\\`')}`;
                                
                                // Load label
                                var label = dymo.label.framework.openLabelXml(labelXml);
                                
                                if (label) {{
                                    updateStatus('Label loaded. Sending to printer...', 'info');
                                    
                                    // Print the label
                                    label.print(targetPrinter.name);
                                    
                                    updateStatus('Print command sent successfully to ' + targetPrinter.name + '!', 'success');
                                    closeWindow();
                                }} else {{
                                    updateStatus('Failed to load label XML', 'error');
                                    closeWindow();
                                }}
                            }} catch (printError) {{
                                updateStatus('Print error: ' + printError.message, 'error');
                                closeWindow();
                            }}
                        }} else {{
                            updateStatus('No DYMO printers found', 'error');
                            closeWindow();
                        }}
                    }}).catch(function(error) {{
                        updateStatus('Failed to get printers: ' + error.message, 'error');
                        closeWindow();
                    }});
                }} else {{
                    let issues = [];
                    if (!result.isFrameworkInstalled) issues.push('DYMO Label Framework not installed');
                    if (!result.isWebServicePresent) issues.push('DYMO Connect service not running');
                    updateStatus('DYMO environment issues: ' + issues.join(', '), 'error');
                    closeWindow();
                }}
            }}).catch(function(error) {{
                updateStatus('Failed to check DYMO environment: ' + error.message, 'error');
                closeWindow();
            }});
            
        }} catch (e) {{
            updateStatus('JavaScript error: ' + e.message, 'error');
            closeWindow();
        }}
    }};
    </script>
</body>
</html>
            '''
            
            # Save HTML to temporary file
            with tempfile.NamedTemporaryFile(mode='w', suffix='.html', delete=False, encoding='utf-8') as f:
                f.write(html_content)
                html_file = f.name
            
            try:
                logger.info(f"Created print HTML file: {html_file}")
                
                # Open HTML file in default browser (headless mode preferred)
                # Try different methods to open browser in background
                
                # Method 1: Try Chrome in headless mode first
                chrome_paths = [
                    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
                    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
                    r"C:\Users\{os.environ.get('USERNAME', 'Default')}\AppData\Local\Google\Chrome\Application\chrome.exe"
                ]
                
                chrome_found = False
                for chrome_path in chrome_paths:
                    if os.path.exists(chrome_path):
                        try:
                            logger.info(f"Attempting to use Chrome: {chrome_path}")
                            result = subprocess.run([
                                chrome_path,
                                '--headless',
                                '--disable-gpu',
                                '--no-sandbox',
                                '--disable-dev-shm-usage',
                                '--run-all-compositor-stages-before-draw',
                                '--virtual-time-budget=10000',  # Run for 10 seconds
                                html_file
                            ], capture_output=True, text=True, timeout=15)
                            
                            logger.info(f"Chrome headless execution completed with return code: {result.returncode}")
                            if result.stdout:
                                logger.info(f"Chrome stdout: {result.stdout}")
                            if result.stderr:
                                logger.warning(f"Chrome stderr: {result.stderr}")
                            
                            chrome_found = True
                            break
                            
                        except Exception as e:
                            logger.warning(f"Chrome method failed: {e}")
                            continue
                
                # Method 2: Fallback to default browser if Chrome not found
                if not chrome_found:
                    logger.info("Chrome not found, using default browser")
                    result = subprocess.run([
                        'cmd', '/c', 'start', '/min', '""', f'"{html_file}"'
                    ], capture_output=True, text=True, timeout=10)
                    
                    if result.returncode == 0:
                        logger.info("Successfully opened HTML file in default browser")
                        # Give browser time to load and execute
                        time.sleep(8)
                    else:
                        logger.error(f"Failed to open browser: {result.stderr}")
                        return False
                
                # Clean up temp file after delay
                time.sleep(2)
                try:
                    os.unlink(html_file)
                    logger.info("Cleaned up temporary HTML file")
                except:
                    logger.warning("Could not clean up temporary HTML file")
                
                logger.info("Background printing process completed successfully")
                return True
                
            except Exception as e:
                logger.error(f"Browser-based printing failed: {e}")
                # Clean up on error
                try:
                    os.unlink(html_file)
                except:
                    pass
                return False
                
        except Exception as e:
            logger.error(f"Windows background print failed: {e}")
            return False
    
    def _print_linux(self, label_content: str) -> bool:
        """Print label on Linux using lpr"""
        try:
            import subprocess
            import tempfile
            
            # Save label to temporary file
            with tempfile.NamedTemporaryFile(mode='w', suffix='.label', delete=False) as f:
                f.write(label_content)
                label_file = f.name
            
            # Use lpr to print
            cmd = ['lpr', '-P', self.printer_name, label_file]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
            # Clean up temporary file
            os.unlink(label_file)
            
            if result.returncode == 0:
                logger.info(f"Successfully printed label to {self.printer_name}")
                return True
            else:
                logger.error(f"Print command failed: {result.stderr}")
                return False
                
        except Exception as e:
            logger.error(f"Linux print failed: {e}")
            return False


class PrintServer:
    """Main print server class"""
    
    def __init__(self, config: PrintServerConfig):
        self.config = config
        self.session = requests.Session()
        self.dymo = DymoConnector(config)
        self.last_heartbeat = datetime.now()
        self.jobs_completed_today = 0
        self.total_jobs_processed = 0
        
        # Set up authentication
        if config.get('api_token'):
            self.session.headers.update({
                'Authorization': f'Token {config.get("api_token")}'
            })
    
    def register_server(self) -> bool:
        """Register this server with the backend"""
        try:
            printer_status = self.dymo.get_printer_status()
            
            data = {
                'server_id': self.config.get('server_id'),
                'name': self.config.get('server_name'),
                'location': self.config.get('server_location'),
                'is_active': True,
                'printer_name': self.dymo.printer_name or '',
                'printer_status': printer_status.get('status', 'unknown')
            }
            
            # Try to update existing server or create new one
            url = f"{self.config.get('backend_url')}/api/printing/api/servers/"
            
            # First, try to find existing server
            response = self.session.get(url, params={'server_id': data['server_id']})
            
            if response.status_code == 200:
                servers_data = response.json()
                # Handle both paginated and direct list responses
                if isinstance(servers_data, dict) and 'results' in servers_data:
                    servers = servers_data['results']
                else:
                    servers = servers_data if isinstance(servers_data, list) else []
                    
                if servers:
                    # Update existing server
                    server_id = servers[0]['id']
                    response = self.session.patch(f"{url}{server_id}/", json=data)
                else:
                    # Create new server
                    response = self.session.post(url, json=data)
            else:
                # Create new server
                response = self.session.post(url, json=data)
            
            if response.status_code in [200, 201]:
                logger.info("Successfully registered with backend")
                return True
            else:
                logger.error(f"Failed to register server: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"Server registration failed: {e}")
            return False
    
    def send_heartbeat(self):
        """Send heartbeat to backend"""
        try:
            printer_status = self.dymo.get_printer_status()
            
            data = {
                'printer_name': self.dymo.printer_name or '',
                'printer_status': printer_status.get('status', 'unknown'),
                'jobs_completed_today': self.jobs_completed_today
            }
            
            # Find server ID
            url = f"{self.config.get('backend_url')}/api/printing/api/servers/"
            response = self.session.get(url, params={'server_id': self.config.get('server_id')})
            
            if response.status_code == 200:
                servers_data = response.json()
                # Handle both paginated and direct list responses
                if isinstance(servers_data, dict) and 'results' in servers_data:
                    servers = servers_data['results']
                else:
                    servers = servers_data if isinstance(servers_data, list) else []
                    
                if servers:
                    server_id = servers[0]['id']
                    heartbeat_url = f"{url}{server_id}/heartbeat/"
                    response = self.session.post(heartbeat_url, json=data)
                    
                    if response.status_code == 200:
                        self.last_heartbeat = datetime.now()
                        logger.debug("Heartbeat sent successfully")
                    else:
                        logger.warning(f"Heartbeat failed: {response.status_code}")
            
        except Exception as e:
            logger.warning(f"Heartbeat failed: {e}")
    
    def fetch_pending_job(self) -> Optional[Dict[str, Any]]:
        """Fetch the next pending print job"""
        try:
            url = f"{self.config.get('backend_url')}/api/printing/api/fetch-pending-job/"
            params = {'server_id': self.config.get('server_id')}
            
            response = self.session.get(url, params=params, timeout=10)
            
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 204:
                return None  # No pending jobs
            else:
                logger.warning(f"Failed to fetch job: {response.status_code}")
                return None
                
        except Exception as e:
            logger.error(f"Failed to fetch pending job: {e}")
            return None
    
    def update_job_status(self, job_id: int, status: str, error_message: Optional[str] = None) -> bool:
        """Update job status in backend"""
        try:
            url = f"{self.config.get('backend_url')}/api/printing/api/jobs/{job_id}/update_status/"
            
            data = {
                'status': status,
                'print_server_id': self.config.get('server_id')
            }
            
            if error_message:
                data['error_message'] = error_message
            
            response = self.session.post(url, json=data, timeout=10)
            
            if response.status_code == 200:
                logger.info(f"Updated job {job_id} status to {status}")
                return True
            else:
                logger.error(f"Failed to update job status: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"Failed to update job status: {e}")
            return False
    
    def process_job(self, job: Dict[str, Any]) -> bool:
        """Process a single print job"""
        job_id = job['id']
        label_data = job['label_data']
        
        logger.info(f"Processing job {job_id}: {label_data.get('itemName', 'Unknown')}")
        
        try:
            # Print the label
            success = self.dymo.print_label(label_data)
            
            if success:
                self.jobs_completed_today += 1
                self.total_jobs_processed += 1
                self.update_job_status(job_id, 'completed')
                logger.info(f"Successfully completed job {job_id}")
                return True
            else:
                self.update_job_status(job_id, 'failed', 'Print operation failed')
                logger.error(f"Failed to print job {job_id}")
                return False
                
        except Exception as e:
            error_msg = str(e)
            self.update_job_status(job_id, 'failed', error_msg)
            logger.error(f"Job {job_id} failed with error: {error_msg}")
            return False
    
    def run(self):
        """Main server loop"""
        logger.info(f"Starting print server {self.config.get('server_id')}")
        logger.info(f"Backend URL: {self.config.get('backend_url')}")
        logger.info(f"Poll interval: {self.config.get('poll_interval')} seconds")
        
        # Register with backend
        if not self.register_server():
            logger.error("Failed to register with backend. Exiting.")
            return
        
        # Main loop
        try:
            while True:
                try:
                    # Send heartbeat periodically
                    if (datetime.now() - self.last_heartbeat).seconds >= self.config.get('heartbeat_interval', 60):
                        self.send_heartbeat()
                    
                    # Fetch and process jobs
                    job = self.fetch_pending_job()
                    if job:
                        self.process_job(job)
                    else:
                        logger.debug("No pending jobs")
                    
                    # Wait before next poll
                    time.sleep(self.config.get('poll_interval', 5))
                    
                except KeyboardInterrupt:
                    logger.info("Received interrupt signal. Shutting down...")
                    break
                except Exception as e:
                    logger.error(f"Error in main loop: {e}")
                    time.sleep(self.config.get('retry_delay', 10))
        
        finally:
            logger.info("Print server shutting down")


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='Centralized Print Server for Bio-Inventory System')
    parser.add_argument('--config', '-c', help='Configuration file path')
    parser.add_argument('--debug', '-d', action='store_true', help='Enable debug logging')
    
    args = parser.parse_args()
    
    # Set up logging level
    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Load configuration
    config = PrintServerConfig(args.config)
    
    # Validate configuration
    if not config.validate():
        logger.error("Invalid configuration. Exiting.")
        sys.exit(1)
    
    # Create and run server
    server = PrintServer(config)
    server.run()


if __name__ == '__main__':
    main()