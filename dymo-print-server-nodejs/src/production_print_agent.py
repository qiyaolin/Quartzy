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

import json
import logging
import os
import sys
import tempfile
import threading
import time
import urllib.parse
import webbrowser
from datetime import datetime

import requests

from label_template_parser import LabelTemplateParser

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('print_agent.log', encoding='utf-8'),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger(__name__)

PRINT_MODE_TAPE = "tape"
PRINT_MODE_LABEL = "label"
SUPPORTED_PRINT_MODES = {PRINT_MODE_TAPE, PRINT_MODE_LABEL}


class ProductionPrintAgent:
    def __init__(self, config_file='print_agent_config.json'):
        """Initialize the production print agent."""
        if not os.path.isabs(config_file):
            self.script_dir = os.path.dirname(os.path.abspath(__file__))
            config_file = os.path.join(self.script_dir, config_file)
        else:
            self.script_dir = os.path.dirname(config_file)

        logger.info(f"Loading configuration from: {config_file}")
        self.config = self.load_config(config_file)
        self.backend_url = self.config.get('backend_url', 'http://localhost:8000')
        self.api_token = self.config.get('api_token', '')
        self.poll_interval = self.config.get('poll_interval', 5)
        self.max_retry_count = self.config.get('max_retry_count', 3)
        self.browser_timeout = self.config.get('browser_timeout', 30)
        machine_name = os.environ.get('COMPUTERNAME') or os.environ.get('HOSTNAME') or 'print-agent'
        configured_server_id = str(self.config.get('server_id', '')).strip()
        self.server_id = configured_server_id or machine_name

        template_file = self.config.get('template_path', 'auto_print_template.html')
        self.template_path = self._resolve_path(template_file)
        if not os.path.exists(self.template_path):
            logger.error(f"Template file not found: {self.template_path}")
            sys.exit(1)

        self.label_parser = LabelTemplateParser()

        self.default_print_mode = self._normalize_print_mode(
            self.config.get('default_print_mode', PRINT_MODE_TAPE),
            PRINT_MODE_TAPE,
        )
        self.legacy_label_file = str(self.config.get('label_file', 'sample.label')).strip()
        self.mode_template_map = self._build_mode_template_map()

        self.global_printer_config = self.config.get('printer_selection', {}) or {}
        self.mode_printer_map = self._build_mode_printer_map()

        logger.info("Production DYMO Print Agent initialized")
        logger.info(f"Backend URL: {self.backend_url}")
        logger.info(f"Server ID: {self.server_id}")
        logger.info(f"Polling interval: {self.poll_interval} seconds")
        logger.info(f"Template path: {self.template_path}")
        logger.info(f"Default print mode: {self.default_print_mode}")
        logger.info(f"Template map: {self.mode_template_map}")
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

            default = {
                "backend_url": "http://localhost:8000",
                "api_token": "",
                "api_endpoints": {
                    "fetch_job": "/api/printing/api/fetch-pending-job/",
                    "get_jobs": "/api/printing/api/jobs/",
                    "update_status": "/api/printing/api/jobs/{job_id}/update_status/",
                },
                "poll_interval": 5,
                "server_id": "",
                "template_path": "auto_print_template.html",
                "label_file": "sample.label",
                "default_print_mode": "tape",
                "mode_template_map": {
                    "tape": "sample.label",
                    "label": "QRcode.label",
                },
                "printer_selection": {
                    "mode": "auto",
                    "preferred_printer": "",
                    "label_printer_keywords": ["Label", "LabelWriter"],
                    "tape_printer_keywords": ["Tape", "LabelManager"],
                },
                "mode_printer_map": {
                    "tape": {"mode": "tape"},
                    "label": {"mode": "label"},
                },
                "max_retry_count": 3,
                "browser_timeout": 30,
                "auto_close_browser": True,
                "concurrent_jobs": 1,
                "debug_mode": False,
            }
            with open(config_file, 'w', encoding='utf-8') as f:
                json.dump(default, f, indent=2)
            logger.info(f"Created default config file: {config_file}")
            return default
        except Exception as e:
            logger.error(f"Failed to load config: {e}")
            return {}

    def _resolve_path(self, path_value):
        if not path_value:
            return ""
        if os.path.isabs(path_value):
            return path_value
        return os.path.join(self.script_dir, path_value)

    def _normalize_print_mode(self, value, default):
        if not value:
            return default
        normalized = str(value).strip().lower()
        if normalized in SUPPORTED_PRINT_MODES:
            return normalized
        logger.warning(f"Unsupported print mode '{value}', using default '{default}'")
        return default

    def _normalize_label_type(self, label_type):
        if not label_type:
            return ""
        return str(label_type).split('}')[-1]

    def _build_mode_template_map(self):
        mode_template_map = {
            PRINT_MODE_TAPE: "sample.label",
            PRINT_MODE_LABEL: "QRcode.label",
        }

        configured_map = self.config.get('mode_template_map', {})
        configured_map_keys = set()
        if isinstance(configured_map, dict):
            for mode, template_name in configured_map.items():
                mode_key = self._normalize_print_mode(mode, "")
                if mode_key:
                    configured_map_keys.add(mode_key)
                if mode_key and template_name:
                    mode_template_map[mode_key] = str(template_name).strip()

        if self.legacy_label_file and self.default_print_mode not in configured_map_keys:
            mode_template_map[self.default_print_mode] = self.legacy_label_file

        return mode_template_map

    def _build_mode_printer_map(self):
        mode_printer_map = {
            PRINT_MODE_TAPE: {"mode": PRINT_MODE_TAPE},
            PRINT_MODE_LABEL: {"mode": PRINT_MODE_LABEL},
        }
        configured_map = self.config.get('mode_printer_map', {})
        if not isinstance(configured_map, dict):
            return mode_printer_map

        for mode, cfg in configured_map.items():
            mode_key = self._normalize_print_mode(mode, "")
            if not mode_key:
                continue
            if isinstance(cfg, dict):
                mode_printer_map[mode_key] = cfg
        return mode_printer_map

    def _resolve_job_printer_config(self, print_mode):
        printer_config = dict(self.global_printer_config) if isinstance(self.global_printer_config, dict) else {}
        mode_override = self.mode_printer_map.get(print_mode, {})
        if isinstance(mode_override, dict):
            printer_config.update(mode_override)

        printer_config['mode'] = print_mode

        if 'label_printer_keywords' not in printer_config:
            printer_config['label_printer_keywords'] = ["Label", "LabelWriter"]
        if 'tape_printer_keywords' not in printer_config:
            printer_config['tape_printer_keywords'] = ["Tape", "LabelManager"]

        return printer_config

    def _resolve_label_file_path(self, print_mode, template_override):
        if template_override:
            return self._resolve_path(template_override), f"job override: {template_override}"

        mapped_template = self.mode_template_map.get(print_mode)
        if mapped_template:
            return self._resolve_path(mapped_template), f"mode map: {mapped_template}"

        # Last fallback for very old configs.
        if self.legacy_label_file:
            return self._resolve_path(self.legacy_label_file), f"legacy label_file: {self.legacy_label_file}"

        return "", "no template configured"

    def _validate_template_compatibility(self, print_mode, label_type):
        normalized_label_type = self._normalize_label_type(label_type)
        if print_mode == PRINT_MODE_TAPE and normalized_label_type != "ContinuousLabel":
            raise ValueError(
                f"Template type '{normalized_label_type}' is incompatible with tape mode. "
                "Tape mode requires ContinuousLabel."
            )
        if print_mode == PRINT_MODE_LABEL and normalized_label_type != "DieCutLabel":
            raise ValueError(
                f"Template type '{normalized_label_type}' is incompatible with label mode. "
                "Label mode requires DieCutLabel."
            )

    def get_auth_headers(self):
        """Return HTTP headers for authenticated requests."""
        headers = {'Content-Type': 'application/json'}
        if self.api_token:
            headers['Authorization'] = f'Token {self.api_token}'
        return headers

    def _fetch_pending_job_legacy(self):
        """Fallback for old backend configs that do not expose fetch-pending-job."""
        try:
            endpoint = self.config.get('api_endpoints', {}).get('get_jobs', '/api/printing/api/jobs/')
            url = urllib.parse.urljoin(self.backend_url, endpoint)
            params = {'status': 'pending', 'limit': 1}
            resp = requests.get(url, params=params, headers=self.get_auth_headers(), timeout=10)
            resp.raise_for_status()
            data = resp.json()

            if isinstance(data, dict) and 'results' in data:
                jobs = data['results']
            elif isinstance(data, list):
                jobs = data
            else:
                jobs = []

            if not jobs:
                return None

            job = jobs[0]
            job_id = job.get('id')
            if not job_id:
                return None

            claimed = self.update_job_status(
                job_id,
                'processing',
                print_server_id=self.server_id,
            )
            if not claimed:
                logger.info(f"Skipped legacy pending job #{job_id}; likely claimed by another agent.")
                return None

            logger.info(
                f"Claimed job #{job_id} via legacy fallback at {datetime.now().isoformat()} "
                f"(server_id={self.server_id})"
            )
            job['status'] = 'processing'
            job['print_server_id'] = self.server_id
            return job
        except Exception as e:
            logger.error(f"Failed to fetch legacy pending job: {e}")
            return None

    def fetch_pending_job(self):
        """Atomically claim the next pending print job from backend."""
        try:
            endpoint = self.config.get('api_endpoints', {}).get(
                'fetch_job',
                '/api/printing/api/fetch-pending-job/',
            )
            url = urllib.parse.urljoin(self.backend_url, endpoint)
            params = {'server_id': self.server_id}
            resp = requests.get(url, params=params, headers=self.get_auth_headers(), timeout=10)

            if resp.status_code == 204:
                return None

            if resp.status_code == 404:
                logger.warning("fetch-pending-job endpoint not found; using legacy pending list fallback.")
                return self._fetch_pending_job_legacy()

            resp.raise_for_status()
            job = resp.json()
            if isinstance(job, dict) and job.get('id'):
                logger.info(
                    f"Claimed job #{job.get('id')} at {datetime.now().isoformat()} "
                    f"(server_id={self.server_id})"
                )
                return job
            return None
        except Exception as e:
            logger.error(f"Failed to fetch pending job: {e}")
            return None

    def update_job_status(self, job_id, status, error_message=None, print_server_id=None):
        """Update job status on the backend."""
        try:
            template = self.config.get('api_endpoints', {}).get(
                'update_status',
                '/api/printing/api/jobs/{job_id}/update_status/',
            )
            endpoint = template.format(job_id=job_id)
            url = urllib.parse.urljoin(self.backend_url, endpoint)
            payload = {'status': status, 'updated_at': datetime.now().isoformat()}
            if error_message:
                payload['error_message'] = error_message
            if print_server_id:
                payload['print_server_id'] = print_server_id
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
                'template_file': str(label_data.get('templateFile', '')).strip(),
                'print_mode': self._normalize_print_mode(
                    label_data.get('printMode', self.default_print_mode),
                    self.default_print_mode,
                ),
            }
            logger.info(f"Extracted print data: {data}")
            return data
        except Exception as e:
            logger.error(f"Error extracting print data: {e}")
            return {
                'job_id': str(job.get('id', '0')),
                'item_name': 'Error Item',
                'barcode': 'ERROR',
                'custom_text': '',
                'font_size': '8',
                'is_bold': 'false',
                'timestamp': str(int(time.time())),
                'template_file': '',
                'print_mode': self.default_print_mode,
            }

    def build_job_runtime_context(self, data):
        """Resolve template and printer config for a job."""
        print_mode = data.get('print_mode', self.default_print_mode)
        template_override = data.get('template_file', '')
        label_file_path, template_source = self._resolve_label_file_path(print_mode, template_override)
        template_exists = bool(label_file_path and os.path.exists(label_file_path))

        if template_override and not template_exists:
            raise ValueError(f"Requested templateFile not found: {template_override}")

        template_info = None
        if template_exists:
            template_info = self.label_parser.parse_label_file(label_file_path)
            label_type = self._normalize_label_type(template_info.get('label_type'))
            self._validate_template_compatibility(print_mode, label_type)
            logger.info(
                f"Job #{data['job_id']} template resolved: {label_file_path} "
                f"(source: {template_source}, type: {label_type})"
            )
        else:
            logger.warning(
                f"Job #{data['job_id']} template not found for mode '{print_mode}'. "
                "Using generated fallback XML."
            )

        printer_config = self._resolve_job_printer_config(print_mode)
        logger.info(f"Job #{data['job_id']} printer mode: {printer_config.get('mode')}")

        return {
            'print_mode': print_mode,
            'label_file_path': label_file_path,
            'template_info': template_info,
            'printer_config': printer_config,
        }

    def generate_dynamic_label_xml(self, data, template_info):
        """Generate label XML using a parsed template."""
        try:
            template_data = {
                'item_name': data.get('item_name', ''),
                'barcode': data.get('barcode', ''),
                'custom_text': data.get('custom_text', '') or data.get('item_name', ''),
            }
            xml_content = self.label_parser.generate_dynamic_xml(template_info, template_data)
            logger.info(f"Generated dynamic XML for job #{data['job_id']}")
            return xml_content
        except Exception as e:
            logger.error(f"Failed to generate dynamic label XML: {e}")
            return self.generate_fallback_label_xml(data, data.get('print_mode', self.default_print_mode))

    def generate_fallback_label_xml(self, data, print_mode):
        """Generate fallback label XML when dynamic template is not available."""
        display_text = data.get('custom_text') or data.get('item_name', 'Unknown Item')
        barcode = data.get('barcode', 'NO_BARCODE')
        font_size = data.get('font_size', '8')
        is_bold = data.get('is_bold', 'false') == 'true'

        if print_mode == PRINT_MODE_TAPE:
            return f"""<?xml version="1.0" encoding="utf-8"?>
<ContinuousLabel Version="8.0" Units="twips">
    <PaperOrientation>Landscape</PaperOrientation>
    <Id>Tape12mm</Id>
    <PaperName>12mm</PaperName>
    <LengthMode>Auto</LengthMode>
    <LabelLength>0</LabelLength>
    <RootCell>
        <Length>0</Length>
        <LengthMode>Auto</LengthMode>
        <BorderWidth>0</BorderWidth>
        <BorderStyle>Solid</BorderStyle>
        <BorderColor Alpha="255" Red="0" Green="0" Blue="0" />
        <SubcellsOrientation>Horizontal</SubcellsOrientation>
        <Subcells>
            <Cell>
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
                    <Type>Code39</Type>
                    <Size>Small</Size>
                    <TextPosition>Bottom</TextPosition>
                    <TextFont Family="Arial" Size="8" Bold="False" Italic="False" Underline="False" Strikeout="False" />
                    <CheckSumFont Family="Arial" Size="8" Bold="False" Italic="False" Underline="False" Strikeout="False" />
                    <TextEmbedding>None</TextEmbedding>
                    <ECLevel>0</ECLevel>
                    <HorizontalAlignment>Center</HorizontalAlignment>
                    <QuietZonesPadding Left="0" Top="0" Right="0" Bottom="0" />
                </BarcodeObject>
                <ObjectMargin Left="0" Top="0" Right="150" Bottom="0" />
                <Length>2460</Length>
                <LengthMode>Auto</LengthMode>
                <BorderWidth>0</BorderWidth>
                <BorderStyle>Solid</BorderStyle>
                <BorderColor Alpha="255" Red="0" Green="0" Blue="0" />
            </Cell>
            <Cell>
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
                    <HorizontalAlignment>Left</HorizontalAlignment>
                    <VerticalAlignment>Middle</VerticalAlignment>
                    <TextFitMode>ShrinkToFit</TextFitMode>
                    <UseFullFontHeight>True</UseFullFontHeight>
                    <Verticalized>False</Verticalized>
                    <StyledText>
                        <Element>
                            <String xml:space="preserve">{display_text}</String>
                            <Attributes>
                                <Font Family="Arial" Size="{font_size}" Bold="{'True' if is_bold else 'False'}" Italic="False" Underline="False" Strikeout="False" />
                                <ForeColor Alpha="255" Red="0" Green="0" Blue="0" HueScale="100" />
                            </Attributes>
                        </Element>
                    </StyledText>
                </TextObject>
                <ObjectMargin Left="150" Top="0" Right="150" Bottom="0" />
                <Length>2880</Length>
                <LengthMode>Auto</LengthMode>
                <BorderWidth>0</BorderWidth>
                <BorderStyle>Solid</BorderStyle>
                <BorderColor Alpha="255" Red="0" Green="0" Blue="0" />
            </Cell>
        </Subcells>
    </RootCell>
</ContinuousLabel>"""

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
                    <String xml:space="preserve">{display_text}</String>
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

    def create_print_html_with_embedded_data(self, data, runtime_context):
        """Generate a temporary HTML file with embedded print data."""
        try:
            with open(self.template_path, 'r', encoding='utf-8') as f:
                html = f.read()

            framework_path = os.path.join(self.script_dir, "dymo.connect.framework.js")
            framework_file_url = f"file:///{framework_path.replace(os.sep, '/')}"
            html = html.replace('src="dymo.connect.framework.js"', f'src="{framework_file_url}"')

            dynamic_xml = None
            template_info = runtime_context.get('template_info')
            if template_info:
                dynamic_xml = self.generate_dynamic_label_xml(data, template_info)
            if not dynamic_xml:
                dynamic_xml = self.generate_fallback_label_xml(
                    data,
                    runtime_context.get('print_mode', self.default_print_mode),
                )

            embedded_data = data.copy()
            embedded_data['dynamic_label_xml'] = dynamic_xml
            embedded_data['use_dynamic_template'] = True

            printer_config = runtime_context.get('printer_config', {})
            embedded_data['printer_config'] = {
                'mode': printer_config.get('mode', self.default_print_mode),
                'preferred_printer': printer_config.get('preferred_printer', ''),
                'label_keywords': printer_config.get(
                    'label_keywords',
                    printer_config.get('label_printer_keywords', ['Label', 'LabelWriter']),
                ),
                'tape_keywords': printer_config.get(
                    'tape_keywords',
                    printer_config.get('tape_printer_keywords', ['Tape', 'LabelManager']),
                ),
            }

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

    def execute_browser_print(self, data, runtime_context):
        """Open the embedded HTML in the browser for printing."""
        try:
            temp_html = self.create_print_html_with_embedded_data(data, runtime_context)
            if not temp_html:
                return False
            url = f"file:///{temp_html.replace(os.sep, '/')}"
            success = webbrowser.open(url, new=1)
            if success:
                logger.info("Opened embedded HTML in browser")
            else:
                logger.warning("webbrowser.open returned False")

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
        data = self.extract_print_data(job)

        try:
            runtime_context = self.build_job_runtime_context(data)
        except Exception as e:
            error_message = f"Print job configuration failed: {e}"
            logger.error(error_message)
            self.update_job_status(job_id, 'failed', error_message)
            return

        success = self.execute_browser_print(data, runtime_context)
        if success:
            logger.info(f"Job #{job_id} print command sent")

            def mark_completed():
                time.sleep(10)  # Wait for printing to complete.
                self.update_job_status(job_id, 'completed')
                logger.info(f"Job #{job_id} marked as completed")

            threading.Thread(target=mark_completed, daemon=True).start()
        else:
            self.update_job_status(job_id, 'failed', 'Browser print failed')

    def health_check(self):
        """Perform a health check on backend, template, and dymo framework."""
        try:
            resp = requests.get(f"{self.backend_url}/health/", timeout=5)
            backend_ok = resp.status_code == 200
        except Exception:
            backend_ok = False

        template_ok = os.path.exists(self.template_path)
        framework_file = os.path.join(self.script_dir, "dymo.connect.framework.js")
        framework_ok = os.path.exists(framework_file)
        status = {
            'backend_api': backend_ok,
            'template_file': template_ok,
            'dymo_framework': framework_ok,
            'timestamp': datetime.now().isoformat(),
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
                try:
                    max_jobs = max(1, int(self.config.get('concurrent_jobs', 1)))
                except (TypeError, ValueError):
                    max_jobs = 1

                claimed_jobs = 0
                while claimed_jobs < max_jobs:
                    job = self.fetch_pending_job()
                    if not job:
                        break
                    self.execute_print_job(job)
                    claimed_jobs += 1
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
