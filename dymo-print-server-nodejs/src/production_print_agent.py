#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DYMO Production Browser Print Agent
A stable centralized printing solution based on an HTML template.

Deployment Instructions:
1. Copy this entire folder to the print station PC.
2. Ensure DYMO Label Framework is installed and available.
3. Edit print_agent_config.json to set the backend API endpoint.
4. Run: python production_print_agent.py
"""

import time
import json
import requests
import webbrowser
import os
import sys
import urllib.parse
import tempfile
import threading
from pathlib import Path
from datetime import datetime
import logging
from label_template_parser import LabelTemplateParser

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('print_agent.log', encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class ProductionPrintAgent:
    def __init__(self, config_file='print_agent_config.json'):
        """Initialize the production print agent."""
        # Ensure config file path is relative to script directory
        if not os.path.isabs(config_file):
            script_dir = os.path.dirname(os.path.abspath(__file__))
            config_file = os.path.join(script_dir, config_file)
        
        logger.info(f"Loading configuration from: {config_file}")
        self.config = self.load_config(config_file)
        self.backend_url = self.config.get('backend_url', 'http://localhost:8000')
        self.api_token = self.config.get('api_token', '')
        self.poll_interval = self.config.get('poll_interval', 5)
        self.max_retry_count = self.config.get('max_retry_count', 3)
        self.browser_timeout = self.config.get('browser_timeout', 30)
        
        # Determine script directory
        script_dir = os.path.dirname(os.path.abspath(__file__))
        template_file = self.config.get('template_path', 'auto_print_template.html')
        # Resolve template path relative to script directory
        if not os.path.isabs(template_file):
            self.template_path = os.path.join(script_dir, template_file)
        else:
            self.template_path = template_file

        # Check template file existence
        if not os.path.exists(self.template_path):
            logger.error(f"Template file not found: {self.template_path}")
            sys.exit(1)

        # Initialize label template parser for dynamic templates
        self.label_parser = LabelTemplateParser()
        
        # Get label file from config
        label_file = self.config.get('label_file', 'sample.label')
        
        # Resolve label file path relative to script directory
        if not os.path.isabs(label_file):
            self.label_file_path = os.path.join(script_dir, label_file)
        else:
            self.label_file_path = label_file
        
        # Check if label file exists
        self.use_dynamic_templates = os.path.exists(self.label_file_path)
        if self.use_dynamic_templates:
            logger.info(f"Using dynamic label template: {self.label_file_path}")
        else:
            logger.warning(f"Label file not found: {self.label_file_path}")
            logger.info("Will use hardcoded template as fallback")

        # Initialize printer selection configuration
        self.printer_config = self.config.get('printer_selection', {})
        self.printer_mode = self.printer_config.get('mode', 'auto')
        self.preferred_printer = self.printer_config.get('preferred_printer', '')
        logger.info(f"Printer selection mode: {self.printer_mode}")
        if self.preferred_printer:
            logger.info(f"Preferred printer: {self.preferred_printer}")

        logger.info("Production DYMO Print Agent initialized")
        logger.info(f"Backend URL: {self.backend_url}")
        logger.info(f"Polling interval: {self.poll_interval} seconds")
        logger.info(f"Template path: {self.template_path}")
        logger.info(f"Auto close browser: {self.config.get('auto_close_browser', True)}")
        logger.info(f"Debug mode: {self.config.get('debug_mode', False)}")
        if not self.api_token:
            logger.warning("WARNING: No API token configured in print_agent_config.json")

    def load_config(self, config_file):
        """Load configuration from JSON file or create default."""
        try:
            if os.path.exists(config_file):
                with open(config_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            else:
                default = {
                    "backend_url": "http://localhost:8000",
                    "api_token": "",
                    "api_endpoints": {
                        "get_jobs": "/api/printing/api/jobs/",
                        "update_status": "/api/printing/api/jobs/{job_id}/update-status/"
                    },
                    "poll_interval": 5,
                    "template_path": "auto_print_template.html",
                    "label_file": "sample.label",
                    "printer_selection": {
                        "mode": "auto",
                        "preferred_printer": "",
                        "label_printer_keywords": ["Label", "LabelWriter"],
                        "tape_printer_keywords": ["Tape", "LabelManager"]
                    },
                    "max_retry_count": 3,
                    "browser_timeout": 30,
                    "auto_close_browser": True,
                    "concurrent_jobs": 1,
                    "debug_mode": False
                }
                with open(config_file, 'w', encoding='utf-8') as f:
                    json.dump(default, f, indent=2)
                logger.info(f"Created default config file: {config_file}")
                return default
        except Exception as e:
            logger.error(f"Failed to load config: {e}")
            return {}

    def get_auth_headers(self):
        """Return HTTP headers for authenticated requests."""
        headers = {'Content-Type': 'application/json'}
        if self.api_token:
            headers['Authorization'] = f'Token {self.api_token}'
        return headers

    def get_pending_jobs(self):
        """Fetch pending print jobs from the backend."""
        try:
            endpoint = self.config.get('api_endpoints', {}).get('get_jobs', '/api/printing/api/jobs/')
            url = urllib.parse.urljoin(self.backend_url, endpoint)
            params = {'status': 'pending', 'limit': self.config.get('concurrent_jobs', 1)}
            resp = requests.get(url, params=params, headers=self.get_auth_headers(), timeout=10)
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, dict) and 'results' in data:
                return data['results']
            if isinstance(data, list):
                return data
            return []
        except Exception as e:
            logger.error(f"Failed to fetch jobs: {e}")
            return []

    def update_job_status(self, job_id, status, error_message=None):
        """Update job status on the backend."""
        try:
            template = self.config.get('api_endpoints', {}).get('update_status', '/api/printing/api/jobs/{job_id}/update-status/')
            endpoint = template.format(job_id=job_id)
            url = urllib.parse.urljoin(self.backend_url, endpoint)
            payload = {'status': status, 'updated_at': datetime.now().isoformat()}
            if error_message:
                payload['error_message'] = error_message
            resp = requests.post(url, json=payload, headers=self.get_auth_headers(), timeout=10)
            resp.raise_for_status()
            logger.info(f"Job #{job_id} status updated to {status}")
            return True
        except Exception as e:
            logger.error(f"Failed to update job status: {e}")
            return False

    def extract_print_data(self, job):
        """Extract print data from job payload."""
        try:
            job_id = job.get('id')
            label_data = job.get('label_data', {}) or {}
            data = {
                'job_id': str(job_id),
                'item_name': str(label_data.get('itemName', 'Unknown Item')),
                'barcode': str(label_data.get('barcode', 'NO_BARCODE')),
                'custom_text': str(label_data.get('customText', '')),
                'font_size': str(label_data.get('fontSize', '8')),
                'is_bold': 'true' if label_data.get('isBold') else 'false',
                'timestamp': str(int(time.time())),
                'template_file': str(label_data.get('templateFile', ''))
            }
            logger.info(f"Extracted print data: {data}")
            return data
        except Exception as e:
            logger.error(f"Error extracting print data: {e}")
            # Return minimal fallback data
            return {
                'job_id': str(job.get('id', '0')),
                'item_name': 'Error Item',
                'barcode': 'ERROR',
                'custom_text': '',
                'font_size': '8',
                'is_bold': 'false',
                'timestamp': str(int(time.time())),
                'template_file': ''
            }

    def generate_dynamic_label_xml(self, data):
        """Generate label XML using the configured label file."""
        try:
            logger.info(f"Using label template: {self.label_file_path}")
            
            # Parse template and generate XML
            template_info = self.label_parser.parse_label_file(self.label_file_path)
            
            # Prepare data for template generation
            # textbox gets custom_text or item_name, labelbox gets barcode
            template_data = {
                'item_name': data.get('item_name', ''),
                'barcode': data.get('barcode', ''),
                'custom_text': data.get('custom_text', '') or data.get('item_name', '')
            }
            
            xml_content = self.label_parser.generate_dynamic_xml(template_info, template_data)
            logger.info(f"Generated dynamic XML for job #{data['job_id']}")
            
            return xml_content
            
        except Exception as e:
            logger.error(f"Failed to generate dynamic label XML: {e}")
            # Fallback to hardcoded template
            return self.generate_fallback_label_xml(data)
    
    def generate_fallback_label_xml(self, data):
        """Generate fallback label XML when dynamic template fails."""
        displayText = data.get('custom_text') or data.get('item_name', 'Unknown Item')
        barcode = data.get('barcode', 'NO_BARCODE')
        font_size = data.get('font_size', '8')
        is_bold = data.get('is_bold', 'false') == 'true'
        
        return f"""<?xml version="1.0" encoding="utf-8"?>
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
                    <String xml:space="preserve">{displayText}</String>
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
</DieCutLabel>"""

    def build_print_url(self, data):
        """Build file:// URL with query parameters for printing."""
        try:
            params = {
                'jobId': data['job_id'],
                'itemName': data['item_name'],
                'barcode': data['barcode'],
                'autoPrint': 'true',
                '_t': data['timestamp']
            }
            if data['custom_text']:
                params['customText'] = data['custom_text']
            if data['font_size'] != '8':
                params['fontSize'] = data['font_size']
            if data['is_bold'] == 'true':
                params['isBold'] = 'true'
            file_url = f"file:///{self.template_path.replace(os.sep, '/')}"
            query = urllib.parse.urlencode(params, quote_via=urllib.parse.quote)
            full_url = f"{file_url}?{query}"
            logger.info(f"Built print URL: {full_url}")
            return full_url
        except Exception as e:
            logger.error(f"Error building print URL: {e}")
            return f"file:///{self.template_path.replace(os.sep, '/')}"

    def create_print_html_with_embedded_data(self, data):
        """Generate a temporary HTML file with embedded print data."""
        try:
            with open(self.template_path, 'r', encoding='utf-8') as f:
                html = f.read()
            
            # Fix dymo.connect.framework.js path to absolute path
            script_dir = os.path.dirname(os.path.abspath(__file__))
            framework_path = os.path.join(script_dir, "dymo.connect.framework.js")
            framework_file_url = f"file:///{framework_path.replace(os.sep, '/')}"
            
            # Replace relative path with absolute path
            html = html.replace('src="dymo.connect.framework.js"', f'src="{framework_file_url}"')
            
            # Generate dynamic label XML if templates are enabled
            dynamic_xml = None
            if self.use_dynamic_templates:
                try:
                    dynamic_xml = self.generate_dynamic_label_xml(data)
                    logger.info("Generated dynamic label XML for embedding")
                except Exception as e:
                    logger.warning(f"Failed to generate dynamic XML, using fallback: {e}")
            
            # Prepare embedded data
            embedded_data = data.copy()
            if dynamic_xml:
                embedded_data['dynamic_label_xml'] = dynamic_xml
                embedded_data['use_dynamic_template'] = True
            else:
                embedded_data['use_dynamic_template'] = False
            
            # Add printer configuration
            embedded_data['printer_config'] = {
                'mode': self.printer_mode,
                'preferred_printer': self.preferred_printer,
                'label_keywords': self.printer_config.get('label_printer_keywords', ['Label', 'LabelWriter']),
                'tape_keywords': self.printer_config.get('tape_printer_keywords', ['Tape', 'LabelManager'])
            }
            
            # Add browser behavior configuration
            embedded_data['auto_close_browser'] = self.config.get('auto_close_browser', True)
            
            script = (
                "<script>\n"
                f"window.EMBEDDED_PRINT_DATA = {json.dumps(embedded_data, ensure_ascii=False, indent=2)};\n"
                "console.log('Embedded print data loaded');\n"
                "</script>\n"
            )
            modified = html.replace('</head>', script + '</head>')
            fd, temp_path = tempfile.mkstemp(suffix='.html', prefix='dymo_print_embedded_')
            with os.fdopen(fd, 'w', encoding='utf-8') as tmp:
                tmp.write(modified)
            logger.info(f"Created embedded HTML: {temp_path}")
            return temp_path
        except Exception as e:
            logger.error(f"Failed to create embedded HTML: {e}")
            return None

    def execute_browser_print(self, data):
        """Open the embedded HTML in the browser for printing."""
        try:
            temp_html = self.create_print_html_with_embedded_data(data)
            if not temp_html:
                return False
            url = f"file:///{temp_html.replace(os.sep, '/')}"
            success = webbrowser.open(url, new=1)
            if success:
                logger.info("Opened embedded HTML in browser")
            else:
                logger.warning("webbrowser.open returned False")
            # Clean up after delay
            def cleanup():
                time.sleep(self.browser_timeout)
                try:
                    os.unlink(temp_html)
                    logger.info(f"Deleted temp file: {temp_html}")
                except Exception:
                    pass
            threading.Thread(target=cleanup, daemon=True).start()
            return True
        except Exception as e:
            logger.error(f"Browser print failed: {e}")
            return False

    def execute_print_job(self, job):
        """Process a single print job."""
        job_id = job.get('id')
        logger.info(f"Processing job #{job_id}")
        self.update_job_status(job_id, 'processing')
        data = self.extract_print_data(job)
        url = self.build_print_url(data)
        success = self.execute_browser_print(data)
        if success:
            logger.info(f"Job #{job_id} print command sent")
            # Wait for print to complete, then mark as completed
            def mark_completed():
                time.sleep(10)  # Wait 10 seconds for printing to complete
                self.update_job_status(job_id, 'completed')
                logger.info(f"Job #{job_id} marked as completed")
            threading.Thread(target=mark_completed, daemon=True).start()
        else:
            self.update_job_status(job_id, 'failed', 'Browser print failed')

    def health_check(self):
        """Perform a health check on backend, template, and dymo framework."""
        # Backend API
        try:
            resp = requests.get(f"{self.backend_url}/health/", timeout=5)
            backend_ok = resp.status_code == 200
        except:
            backend_ok = False
        # Template file
        template_ok = os.path.exists(self.template_path)
        # DYMO framework file
        script_dir = os.path.dirname(os.path.abspath(__file__))
        framework_file = os.path.join(script_dir, "dymo.connect.framework.js")
        framework_ok = os.path.exists(framework_file)
        status = {
            'backend_api': backend_ok,
            'template_file': template_ok,
            'dymo_framework': framework_ok,
            'timestamp': datetime.now().isoformat()
        }
        if all(status.values()):
            logger.info("Health check passed")
        else:
            logger.warning(f"Health check failed: {status}")
        return status

    def run(self):
        """Main loop to poll for and execute print jobs."""
        logger.info("Starting DYMO print agent service (Press Ctrl+C to stop)")
        self.health_check()
        try:
            while True:
                jobs = self.get_pending_jobs()
                if jobs:
                    for job in jobs:
                        self.execute_print_job(job)
                        time.sleep(1)
                time.sleep(self.poll_interval)
        except KeyboardInterrupt:
            logger.info("Shutting down print agent")
        except Exception as e:
            logger.error(f"Agent runtime error: {e}")

def main():
    agent = ProductionPrintAgent()
    agent.run()

if __name__ == "__main__":
    main()