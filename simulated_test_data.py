"""
High-Quality Simulated Test Data for Bio-Inventory Database
Generated data complies with field types, maintains realistic formats, and ensures diversity.
All data is directly usable in the test environment.
"""

from datetime import date, datetime, timedelta
from decimal import Decimal
import json

# =============================================================================
# VENDOR MODEL DATA
# =============================================================================

VENDOR_DATA = [
    {
        "name": "Thermo Fisher Scientific",
        "website": "https://www.thermofisher.com",
        "created_at": datetime(2023, 1, 15, 9, 30, 0)
    },
    {
        "name": "Sigma-Aldrich",
        "website": "https://www.sigmaaldrich.com",
        "created_at": datetime(2023, 2, 8, 14, 45, 0)
    },
    {
        "name": "New England Biolabs",
        "website": "https://www.neb.com",
        "created_at": datetime(2023, 3, 22, 11, 20, 0)
    },
    {
        "name": "Bio-Rad Laboratories",
        "website": "https://www.bio-rad.com",
        "created_at": datetime(2023, 4, 5, 16, 10, 0)
    },
    {
        "name": "Promega Corporation",
        "website": "https://www.promega.com",
        "created_at": datetime(2023, 5, 18, 8, 55, 0)
    }
]

# =============================================================================
# LOCATION MODEL DATA
# =============================================================================

LOCATION_DATA = [
    {
        "name": "-80°C Freezer A",
        "parent": None,
        "description": "Ultra-low temperature freezer for long-term storage of biological samples and reagents"
    },
    {
        "name": "Shelf 1",
        "parent": 1,  # References -80°C Freezer A
        "description": "Top shelf designated for plasmids and DNA constructs"
    },
    {
        "name": "4°C Cold Room",
        "parent": None,
        "description": "Temperature-controlled room for storing antibodies and enzymes"
    },
    {
        "name": "Chemical Storage Cabinet",
        "parent": None,
        "description": "Ventilated cabinet for storing chemicals and solvents at room temperature"
    },
    {
        "name": "Bench Storage Drawer B3",
        "parent": None,
        "description": "Room temperature storage for frequently used consumables and small equipment"
    }
]

# =============================================================================
# ITEM TYPE MODEL DATA
# =============================================================================

ITEM_TYPE_DATA = [
    {
        "name": "Antibody",
        "custom_fields_schema": {
            "Host Species": "text",
            "Clonality": "text",
            "Conjugate": "text",
            "Dilution": "text",
            "Application": "text"
        }
    },
    {
        "name": "Plasmid",
        "custom_fields_schema": {
            "Backbone": "text",
            "Insert Size": "text",
            "Resistance Marker": "text",
            "Copy Number": "text",
            "Promoter": "text"
        }
    },
    {
        "name": "Chemical",
        "custom_fields_schema": {
            "Molecular Weight": "text",
            "CAS Number": "text",
            "Purity": "text",
            "Hazard Class": "text",
            "Solubility": "text"
        }
    },
    {
        "name": "Enzyme",
        "custom_fields_schema": {
            "Activity": "text",
            "Buffer": "text",
            "Temperature Optimum": "text",
            "Substrate": "text",
            "Inhibitors": "text"
        }
    },
    {
        "name": "Cell Line",
        "custom_fields_schema": {
            "Species": "text",
            "Tissue Type": "text",
            "Growth Medium": "text",
            "Passage Number": "text",
            "Morphology": "text"
        }
    }
]

# =============================================================================
# ITEM MODEL DATA
# =============================================================================

ITEM_DATA = [
    {
        "serial_number": "ITM-a1b2c3d4",
        "name": "Anti-β-Actin Antibody",
        "item_type": 1,  # Antibody
        "vendor": 1,  # Thermo Fisher Scientific
        "catalog_number": "MA5-15739",
        "quantity": Decimal("0.5"),
        "unit": "mL",
        "location": 3,  # 4°C Cold Room
        "price": Decimal("285.00"),
        "owner": 1,  # User ID
        "fund_id": 1,
        "expiration_date": date(2025, 6, 15),
        "lot_number": "TF2024-AB-001",
        "received_date": date(2024, 1, 10),
        "expiration_alert_days": 30,
        "storage_temperature": "4°C",
        "storage_conditions": "Store in dark, avoid freeze-thaw cycles",
        "last_used_date": date(2024, 11, 20),
        "url": "https://www.thermofisher.com/antibody/product/MA5-15739",
        "low_stock_threshold": 1,
        "is_archived": False,
        "created_at": datetime(2024, 1, 10, 10, 30, 0),
        "updated_at": datetime(2024, 11, 20, 15, 45, 0),
        "properties": {
            "Host Species": "Mouse",
            "Clonality": "Monoclonal",
            "Conjugate": "Unconjugated",
            "Dilution": "1:1000-1:5000",
            "Application": "Western Blot, Immunofluorescence"
        }
    },
    {
        "serial_number": "ITM-e5f6g7h8",
        "name": "pUC19 Cloning Vector",
        "item_type": 2,  # Plasmid
        "vendor": 2,  # Sigma-Aldrich
        "catalog_number": "3219-1VL",
        "quantity": Decimal("10.0"),
        "unit": "μg",
        "location": 2,  # Shelf 1 in -80°C Freezer A
        "price": Decimal("125.50"),
        "owner": 2,  # User ID
        "fund_id": 2,
        "expiration_date": date(2026, 12, 31),
        "lot_number": "SA2024-PL-045",
        "received_date": date(2024, 3, 5),
        "expiration_alert_days": 60,
        "storage_temperature": "-80°C",
        "storage_conditions": "Store in single-use aliquots to avoid repeated freeze-thaw",
        "last_used_date": date(2024, 10, 8),
        "url": "https://www.sigmaaldrich.com/catalog/product/sigma/3219",
        "low_stock_threshold": 5,
        "is_archived": False,
        "created_at": datetime(2024, 3, 5, 14, 20, 0),
        "updated_at": datetime(2024, 10, 8, 9, 15, 0),
        "properties": {
            "Backbone": "pUC19",
            "Insert Size": "2686 bp",
            "Resistance Marker": "Ampicillin",
            "Copy Number": "High",
            "Promoter": "lac"
        }
    },
    {
        "serial_number": "ITM-i9j0k1l2",
        "name": "Tris-HCl Buffer",
        "item_type": 3,  # Chemical
        "vendor": 3,  # New England Biolabs
        "catalog_number": "B7024S",
        "quantity": Decimal("500.0"),
        "unit": "mL",
        "location": 4,  # Chemical Storage Cabinet
        "price": Decimal("45.75"),
        "owner": 3,  # User ID
        "fund_id": 1,
        "expiration_date": date(2025, 8, 20),
        "lot_number": "NEB2024-CH-089",
        "received_date": date(2024, 2, 14),
        "expiration_alert_days": 45,
        "storage_temperature": "Room Temperature",
        "storage_conditions": "Keep tightly closed, protect from light",
        "last_used_date": date(2024, 12, 1),
        "url": "https://www.neb.com/products/b7024-tris-hcl",
        "low_stock_threshold": 100,
        "is_archived": False,
        "created_at": datetime(2024, 2, 14, 11, 45, 0),
        "updated_at": datetime(2024, 12, 1, 16, 30, 0),
        "properties": {
            "Molecular Weight": "157.6 g/mol",
            "CAS Number": "1185-53-1",
            "Purity": "≥99.9%",
            "Hazard Class": "Non-hazardous",
            "Solubility": "Highly soluble in water"
        }
    },
    {
        "serial_number": "ITM-m3n4o5p6",
        "name": "EcoRI Restriction Enzyme",
        "item_type": 4,  # Enzyme
        "vendor": 4,  # Bio-Rad Laboratories
        "catalog_number": "1660515",
        "quantity": Decimal("2500.0"),
        "unit": "units",
        "location": 1,  # -80°C Freezer A
        "price": Decimal("195.00"),
        "owner": 1,  # User ID
        "fund_id": 3,
        "expiration_date": date(2025, 11, 30),
        "lot_number": "BR2024-EN-156",
        "received_date": date(2024, 4, 18),
        "expiration_alert_days": 30,
        "storage_temperature": "-20°C",
        "storage_conditions": "Store in glycerol solution, avoid repeated freeze-thaw cycles",
        "last_used_date": date(2024, 11, 15),
        "url": "https://www.bio-rad.com/product/1660515",
        "low_stock_threshold": 500,
        "is_archived": False,
        "created_at": datetime(2024, 4, 18, 13, 10, 0),
        "updated_at": datetime(2024, 11, 15, 10, 25, 0),
        "properties": {
            "Activity": "20,000 units/mL",
            "Buffer": "NEBuffer 3.1",
            "Temperature Optimum": "37°C",
            "Substrate": "5'-GAATTC-3'",
            "Inhibitors": "EDTA, high salt concentration"
        }
    },
    {
        "serial_number": "ITM-q7r8s9t0",
        "name": "HEK293T Cell Line",
        "item_type": 5,  # Cell Line
        "vendor": 5,  # Promega Corporation
        "catalog_number": "E4720",
        "quantity": Decimal("1.0"),
        "unit": "vial",
        "location": 1,  # -80°C Freezer A
        "price": Decimal("320.00"),
        "owner": 2,  # User ID
        "fund_id": 2,
        "expiration_date": date(2027, 3, 15),
        "lot_number": "PR2024-CL-078",
        "received_date": date(2024, 5, 22),
        "expiration_alert_days": 90,
        "storage_temperature": "-80°C",
        "storage_conditions": "Store in liquid nitrogen vapor phase for long-term storage",
        "last_used_date": date(2024, 9, 30),
        "url": "https://www.promega.com/products/cell-biology/cell-lines/e4720",
        "low_stock_threshold": 1,
        "is_archived": False,
        "created_at": datetime(2024, 5, 22, 9, 40, 0),
        "updated_at": datetime(2024, 9, 30, 14, 55, 0),
        "properties": {
            "Species": "Human",
            "Tissue Type": "Embryonic Kidney",
            "Growth Medium": "DMEM + 10% FBS + 1% Pen/Strep",
            "Passage Number": "P15",
            "Morphology": "Epithelial-like, adherent"
        }
    }
]

# =============================================================================
# REQUEST MODEL DATA
# =============================================================================

REQUEST_DATA = [
    {
        "item_name": "Anti-GFP Antibody",
        "item_type": 1,  # Antibody
        "requested_by": 1,  # User ID
        "status": "NEW",
        "vendor": 1,  # Thermo Fisher Scientific
        "catalog_number": "A11122",
        "url": "https://www.thermofisher.com/antibody/product/A11122",
        "quantity": 1,
        "unit_size": "200 μL",
        "unit_price": Decimal("245.00"),
        "fund_id": 1,
        "notes": "Needed for immunofluorescence experiments on transfected cells",
        "created_at": datetime(2024, 12, 1, 10, 15, 0),
        "updated_at": datetime(2024, 12, 1, 10, 15, 0)
    },
    {
        "item_name": "PCR Master Mix",
        "item_type": 4,  # Enzyme (closest match)
        "requested_by": 2,  # User ID
        "status": "APPROVED",
        "vendor": 3,  # New England Biolabs
        "catalog_number": "M0482L",
        "url": "https://www.neb.com/products/m0482-q5-hot-start-high-fidelity-2x-master-mix",
        "quantity": 2,
        "unit_size": "1.25 mL",
        "unit_price": Decimal("89.50"),
        "fund_id": 2,
        "notes": "High-fidelity master mix for cloning applications",
        "created_at": datetime(2024, 11, 28, 14, 30, 0),
        "updated_at": datetime(2024, 11, 29, 9, 45, 0)
    },
    {
        "item_name": "DMSO Solvent",
        "item_type": 3,  # Chemical
        "requested_by": 3,  # User ID
        "status": "ORDERED",
        "vendor": 2,  # Sigma-Aldrich
        "catalog_number": "D2650-100ML",
        "url": "https://www.sigmaaldrich.com/catalog/product/sigma/d2650",
        "quantity": 3,
        "unit_size": "100 mL",
        "unit_price": Decimal("28.75"),
        "fund_id": 3,
        "notes": "Cell culture grade DMSO for cryopreservation",
        "created_at": datetime(2024, 11, 25, 16, 20, 0),
        "updated_at": datetime(2024, 11, 27, 11, 10, 0)
    },
    {
        "item_name": "Protein Ladder",
        "item_type": 4,  # Enzyme (protein-related)
        "requested_by": 1,  # User ID
        "status": "RECEIVED",
        "vendor": 4,  # Bio-Rad Laboratories
        "catalog_number": "1610374",
        "url": "https://www.bio-rad.com/product/1610374",
        "quantity": 1,
        "unit_size": "250 μL",
        "unit_price": Decimal("125.00"),
        "fund_id": 1,
        "notes": "Precision Plus Protein Standards for Western blot analysis",
        "created_at": datetime(2024, 11, 20, 8, 45, 0),
        "updated_at": datetime(2024, 11, 26, 15, 30, 0)
    },
    {
        "item_name": "Cell Culture Flask T75",
        "item_type": None,  # Consumable (no specific type)
        "requested_by": 2,  # User ID
        "status": "REJECTED",
        "vendor": 5,  # Promega Corporation
        "catalog_number": "CC7682",
        "url": "https://www.promega.com/products/cell-culture/cc7682",
        "quantity": 50,
        "unit_size": "1 flask",
        "unit_price": Decimal("3.25"),
        "fund_id": 2,
        "notes": "Request rejected due to budget constraints. Consider bulk purchase next quarter.",
        "created_at": datetime(2024, 11, 15, 13, 25, 0),
        "updated_at": datetime(2024, 11, 18, 10, 40, 0)
    }
]

# =============================================================================
# REQUEST HISTORY MODEL DATA
# =============================================================================

REQUEST_HISTORY_DATA = [
    {
        "request": 2,  # PCR Master Mix request
        "user": 1,  # User who approved
        "old_status": "NEW",
        "new_status": "APPROVED",
        "timestamp": datetime(2024, 11, 29, 9, 45, 0),
        "notes": "Approved by lab manager. Funding confirmed from Grant A."
    },
    {
        "request": 3,  # DMSO Solvent request
        "user": 2,  # User who updated
        "old_status": "APPROVED",
        "new_status": "ORDERED",
        "timestamp": datetime(2024, 11, 27, 11, 10, 0),
        "notes": "Purchase order #PO-2024-1156 submitted to vendor."
    },
    {
        "request": 4,  # Protein Ladder request
        "user": 3,  # User who received
        "old_status": "ORDERED",
        "new_status": "RECEIVED",
        "timestamp": datetime(2024, 11, 26, 15, 30, 0),
        "notes": "Item received and added to inventory. Quality check passed."
    },
    {
        "request": 5,  # Cell Culture Flask request
        "user": 1,  # User who rejected
        "old_status": "NEW",
        "new_status": "REJECTED",
        "timestamp": datetime(2024, 11, 18, 10, 40, 0),
        "notes": "Insufficient budget remaining in Fund B. Recommend resubmitting next quarter."
    },
    {
        "request": 1,  # Anti-GFP Antibody request (initial creation)
        "user": 1,  # User who created
        "old_status": "",
        "new_status": "NEW",
        "timestamp": datetime(2024, 12, 1, 10, 15, 0),
        "notes": "Initial request submission for ongoing fluorescence microscopy project."
    }
]

# =============================================================================
# FUND MODEL DATA
# =============================================================================

FUND_DATA = [
    {
        "name": "NIH Grant R01-GM123456",
        "description": "Research grant for studying protein-protein interactions in cancer cell signaling pathways",
        "total_budget": Decimal("250000.00"),
        "spent_amount": Decimal("87500.50"),
        "funding_source": "National Institutes of Health",
        "grant_number": "R01-GM123456",
        "principal_investigator": "Dr. Sarah Johnson",
        "start_date": date(2023, 9, 1),
        "end_date": date(2026, 8, 31),
        "notes": "Primary funding for lab operations and equipment purchases",
        "is_archived": False,
        "created_at": datetime(2023, 8, 15, 9, 0, 0),
        "updated_at": datetime(2024, 11, 30, 17, 45, 0),
        "created_by": 1  # User ID
    },
    {
        "name": "NSF Career Award",
        "description": "Early career development award for innovative biotechnology research",
        "total_budget": Decimal("500000.00"),
        "spent_amount": Decimal("125000.75"),
        "funding_source": "National Science Foundation",
        "grant_number": "CAREER-2045789",
        "principal_investigator": "Dr. Michael Chen",
        "start_date": date(2024, 1, 1),
        "end_date": date(2028, 12, 31),
        "notes": "Focus on developing novel biosensors and analytical methods",
        "is_archived": False,
        "created_at": datetime(2023, 12, 10, 14, 30, 0),
        "updated_at": datetime(2024, 12, 1, 8, 20, 0),
        "created_by": 2  # User ID
    },
    {
        "name": "Industry Collaboration Fund",
        "description": "Joint research project with pharmaceutical company for drug discovery",
        "total_budget": Decimal("150000.00"),
        "spent_amount": Decimal("45000.25"),
        "funding_source": "PharmaCorp Industries",
        "grant_number": "IND-2024-007",
        "principal_investigator": "Dr. Emily Rodriguez",
        "start_date": date(2024, 3, 15),
        "end_date": date(2025, 3, 14),
        "notes": "Confidential research agreement - restricted purchasing guidelines apply",
        "is_archived": False,
        "created_at": datetime(2024, 2, 28, 11, 15, 0),
        "updated_at": datetime(2024, 11, 28, 16, 10, 0),
        "created_by": 3  # User ID
    },
    {
        "name": "Department Startup Fund",
        "description": "Initial funding for new faculty member laboratory setup",
        "total_budget": Decimal("75000.00"),
        "spent_amount": Decimal("72500.00"),
        "funding_source": "University Department of Biology",
        "grant_number": "STARTUP-2023-15",
        "principal_investigator": "Dr. Alex Thompson",
        "start_date": date(2023, 7, 1),
        "end_date": date(2024, 6, 30),
        "notes": "Nearly depleted - final purchases pending approval",
        "is_archived": True,
        "created_at": datetime(2023, 6, 20, 10, 45, 0),
        "updated_at": datetime(2024, 6, 25, 14, 55, 0),
        "created_by": 1  # User ID
    },
    {
        "name": "Equipment Maintenance Fund",
        "description": "Annual budget for laboratory equipment maintenance and repairs",
        "total_budget": Decimal("25000.00"),
        "spent_amount": Decimal("8750.30"),
        "funding_source": "University Facilities Management",
        "grant_number": "MAINT-2024",
        "principal_investigator": "Dr. Sarah Johnson",
        "start_date": date(2024, 1, 1),
        "end_date": date(2024, 12, 31),
        "notes": "Covers service contracts and emergency repairs for major equipment",
        "is_archived": False,
        "created_at": datetime(2023, 12, 15, 13, 20, 0),
        "updated_at": datetime(2024, 11, 20, 9, 35, 0),
        "created_by": 2  # User ID
    }
]

# =============================================================================
# TRANSACTION MODEL DATA
# =============================================================================

TRANSACTION_DATA = [
    {
        "fund": 1,  # NIH Grant R01-GM123456
        "amount": Decimal("285.00"),
        "transaction_type": "purchase",
        "item_name": "Anti-β-Actin Antibody",
        "description": "Primary antibody for Western blot analysis - essential for protein expression studies",
        "request_id": None,
        "reference_number": "PO-2024-0892",
        "transaction_date": datetime(2024, 1, 10, 15, 30, 0),
        "created_by": 1  # User ID
    },
    {
        "fund": 2,  # NSF Career Award
        "amount": Decimal("125.50"),
        "transaction_type": "purchase",
        "item_name": "pUC19 Cloning Vector",
        "description": "High-quality cloning vector for molecular biology experiments",
        "request_id": None,
        "reference_number": "PO-2024-0945",
        "transaction_date": datetime(2024, 3, 5, 11, 45, 0),
        "created_by": 2  # User ID
    },
    {
        "fund": 1,  # NIH Grant R01-GM123456
        "amount": Decimal("45.75"),
        "transaction_type": "purchase",
        "item_name": "Tris-HCl Buffer",
        "description": "Buffer solution for protein purification and biochemical assays",
        "request_id": None,
        "reference_number": "PO-2024-0723",
        "transaction_date": datetime(2024, 2, 14, 14, 20, 0),
        "created_by": 3  # User ID
    },
    {
        "fund": 3,  # Industry Collaboration Fund
        "amount": Decimal("195.00"),
        "transaction_type": "purchase",
        "item_name": "EcoRI Restriction Enzyme",
        "description": "Restriction enzyme for DNA cloning and analysis - industry project requirement",
        "request_id": None,
        "reference_number": "PO-2024-1078",
        "transaction_date": datetime(2024, 4, 18, 16, 10, 0),
        "created_by": 1  # User ID
    },
    {
        "fund": 2,  # NSF Career Award
        "amount": Decimal("1500.00"),
        "transaction_type": "adjustment",
        "item_name": None,
        "description": "Budget reallocation from personnel to supplies category",
        "request_id": None,
        "reference_number": "ADJ-2024-003",
        "transaction_date": datetime(2024, 6, 15, 10, 0, 0),
        "created_by": 2  # User ID
    }
]

# =============================================================================
# BUDGET ALLOCATION MODEL DATA
# =============================================================================

BUDGET_ALLOCATION_DATA = [
    {
        "fund": 1,  # NIH Grant R01-GM123456
        "category": "Supplies",
        "allocated_amount": Decimal("100000.00"),
        "spent_amount": Decimal("35000.25"),
        "description": "Laboratory consumables, reagents, and small equipment",
        "created_at": datetime(2023, 9, 1, 9, 0, 0),
        "updated_at": datetime(2024, 11, 30, 17, 45, 0)
    },
    {
        "fund": 1,  # NIH Grant R01-GM123456
        "category": "Equipment",
        "allocated_amount": Decimal("75000.00"),
        "spent_amount": Decimal("52500.25"),
        "description": "Major laboratory equipment and instrumentation",
        "created_at": datetime(2023, 9, 1, 9, 0, 0),
        "updated_at": datetime(2024, 10, 15, 14, 30, 0)
    },
    {
        "fund": 2,  # NSF Career Award
        "category": "Personnel",
        "allocated_amount": Decimal("200000.00"),
        "spent_amount": Decimal("75000.50"),
        "description": "Graduate student stipends and postdoc salaries",
        "created_at": datetime(2024, 1, 1, 8, 0, 0),
        "updated_at": datetime(2024, 11, 30, 16, 20, 0)
    },
    {
        "fund": 3,  # Industry Collaboration Fund
        "category": "Travel",
        "allocated_amount": Decimal("15000.00"),
        "spent_amount": Decimal("8500.00"),
        "description": "Conference attendance and collaboration meetings",
        "created_at": datetime(2024, 3, 15, 10, 30, 0),
        "updated_at": datetime(2024, 9, 22, 13, 45, 0)
    },
    {
        "fund": 5,  # Equipment Maintenance Fund
        "category": "Maintenance",
        "allocated_amount": Decimal("25000.00"),
        "spent_amount": Decimal("8750.30"),
        "description": "Equipment service contracts and repair costs",
        "created_at": datetime(2024, 1, 1, 9, 0, 0),
        "updated_at": datetime(2024, 11, 20, 9, 35, 0)
    }
]

# =============================================================================
# FUNDING REPORT MODEL DATA
# =============================================================================

FUNDING_REPORT_DATA = [
    {
        "title": "Q3 2024 Financial Summary",
        "report_type": "quarterly",
        "start_date": date(2024, 7, 1),
        "end_date": date(2024, 9, 30),
        "funds": [1, 2, 3],  # Multiple fund IDs
        "summary_data": {
            "total_allocated": 900000.00,
            "total_spent": 258001.50,
            "utilization_rate": 28.67,
            "top_categories": ["Supplies", "Equipment", "Personnel"],
            "alerts": ["Fund 4 approaching depletion", "Equipment budget 70% utilized"]
        },
        "generated_at": datetime(2024, 10, 5, 9, 30, 0),
        "generated_by": 1  # User ID
    },
    {
        "title": "Annual Equipment Report 2024",
        "report_type": "annual",
        "start_date": date(2024, 1, 1),
        "end_date": date(2024, 12, 31),
        "funds": [1, 2, 5],  # Equipment-related funds
        "summary_data": {
            "total_equipment_budget": 125000.00,
            "equipment_purchases": 87500.55,
            "maintenance_costs": 8750.30,
            "major_purchases": ["Microscope", "Centrifuge", "PCR Machine"],
            "upcoming_maintenance": ["Autoclave service due Q1 2025"]
        },
        "generated_at": datetime(2024, 12, 1, 14, 15, 0),
        "generated_by": 2  # User ID
    },
    {
        "title": "Monthly Spending Report - November 2024",
        "report_type": "monthly",
        "start_date": date(2024, 11, 1),
        "end_date": date(2024, 11, 30),
        "funds": [1],  # Single fund
        "summary_data": {
            "monthly_spending": 15750.25,
            "budget_remaining": 162499.50,
            "largest_expense": "Protein purification kit - $2,500",
            "category_breakdown": {"Supplies": 12000.25, "Equipment": 3750.00},
            "variance_from_budget": -5.2
        },
        "generated_at": datetime(2024, 12, 1, 8, 45, 0),
        "generated_by": 3  # User ID
    },
    {
        "title": "Grant Utilization Analysis",
        "report_type": "custom",
        "start_date": date(2023, 9, 1),
        "end_date": date(2024, 11, 30),
        "funds": [1, 2, 3, 4],  # Multiple grants
        "summary_data": {
            "total_awards": 975000.00,
            "total_expenditures": 338751.80,
            "utilization_percentage": 34.7,
            "funds_at_risk": ["Fund 4 - 96.7% utilized"],
            "projected_completion": "2025-Q2",
            "efficiency_rating": "Good"
        },
        "generated_at": datetime(2024, 11, 15, 16, 30, 0),
        "generated_by": 1  # User ID
    },
    {
        "title": "Industry Collaboration Financial Review",
        "report_type": "custom",
        "start_date": date(2024, 3, 15),
        "end_date": date(2024, 11, 30),
        "funds": [3],  # Industry fund only
        "summary_data": {
            "contract_value": 150000.00,
            "spent_to_date": 45000.25,
            "milestone_payments": {"M1": 50000.00, "M2": 50000.00, "M3": 50000.00},
            "deliverables_status": "On track",
            "remaining_budget": 104999.75,
            "burn_rate": "Within projections"
        },
        "generated_at": datetime(2024, 11, 28, 13, 20, 0),
        "generated_by": 3  # User ID
    }
]

# =============================================================================
# USER MODEL DATA (Django's built-in User model)
# =============================================================================

USER_DATA = [
    {
        "username": "sarah.johnson",
        "email": "sarah.johnson@university.edu",
        "first_name": "Sarah",
        "last_name": "Johnson",
        "is_staff": True,
        "is_active": True,
        "is_superuser": True,
        "date_joined": datetime(2023, 8, 1, 9, 0, 0),
        "last_login": datetime(2024, 12, 1, 8, 30, 0)
    },
    {
        "username": "michael.chen",
        "email": "michael.chen@university.edu",
        "first_name": "Michael",
        "last_name": "Chen",
        "is_staff": True,
        "is_active": True,
        "is_superuser": False,
        "date_joined": datetime(2023, 12, 1, 10, 15, 0),
        "last_login": datetime(2024, 11, 30, 16, 45, 0)
    },
    {
        "username": "emily.rodriguez",
        "email": "emily.rodriguez@university.edu",
        "first_name": "Emily",
        "last_name": "Rodriguez",
        "is_staff": False,
        "is_active": True,
        "is_superuser": False,
        "date_joined": datetime(2024, 2, 15, 14, 20, 0),
        "last_login": datetime(2024, 11, 29, 11, 20, 0)
    },
    {
        "username": "alex.thompson",
        "email": "alex.thompson@university.edu",
        "first_name": "Alex",
        "last_name": "Thompson",
        "is_staff": False,
        "is_active": True,
        "is_superuser": False,
        "date_joined": datetime(2023, 6, 15, 9, 30, 0),
        "last_login": datetime(2024, 11, 28, 14, 10, 0)
    },
    {
        "username": "lab.manager",
        "email": "lab.manager@university.edu",
        "first_name": "Lab",
        "last_name": "Manager",
        "is_staff": True,
        "is_active": True,
        "is_superuser": False,
        "date_joined": datetime(2023, 7, 1, 8, 0, 0),
        "last_login": datetime(2024, 12, 1, 7, 45, 0)
    }
]

# =============================================================================
# DATA SUMMARY AND USAGE INSTRUCTIONS
# =============================================================================

"""
SIMULATED DATA SUMMARY:
=======================

This file contains high-quality simulated test data for all models in the bio-inventory database:

1. VENDOR_DATA (5 entries): Major life science suppliers with realistic websites and creation dates
2. LOCATION_DATA (5 entries): Laboratory storage locations with hierarchical relationships
3. ITEM_TYPE_DATA (5 entries): Different categories of lab items with custom field schemas
4. ITEM_DATA (5 entries): Diverse inventory items with complete metadata and properties
5. REQUEST_DATA (5 entries): Purchase requests in various status states
6. REQUEST_HISTORY_DATA (5 entries): Status change history for requests
7. FUND_DATA (5 entries): Research grants and funding sources with realistic budgets
8. TRANSACTION_DATA (5 entries): Financial transactions linked to purchases
9. BUDGET_ALLOCATION_DATA (5 entries): Budget categories with spending tracking
10. FUNDING_REPORT_DATA (5 entries): Financial reports with summary analytics
11. USER_DATA (5 entries): System users with appropriate permissions

DATA CHARACTERISTICS:
====================

✓ Field Type Compliance: All data matches Django model field types exactly
✓ Realistic Formats: Proper formatting for dates, decimals, URLs, emails
✓ Appropriate Ranges: Quantities, prices, and dates within reasonable bounds
✓ Diversity: Varied data across all entries to simulate real-world scenarios
✓ Authenticity: Based on actual laboratory suppliers, equipment, and workflows
✓ Referential Integrity: Foreign key relationships properly maintained
✓ Test-Ready: All data can be directly inserted into the database

USAGE INSTRUCTIONS:
==================

1. Import this file into your Django management command or test script
2. Use Django ORM to create model instances from the data dictionaries
3. Handle foreign key relationships by creating referenced objects first
4. Consider using Django fixtures format for easier database loading
5. Validate data integrity after insertion using Django's built-in validators

EXAMPLE USAGE:
=============

from items.models import Vendor, Location, ItemType, Item
from django.contrib.auth.models import User

# Create vendors first
for vendor_data in VENDOR_DATA:
    Vendor.objects.create(**vendor_data)

# Create users
for user_data in USER_DATA:
    User.objects.create_user(**user_data)

# Continue with other models following dependency order...

"""

if __name__ == "__main__":
    print("Bio-Inventory Simulated Test Data")
    print("=================================")
    print(f"Vendors: {len(VENDOR_DATA)} entries")
    print(f"Locations: {len(LOCATION_DATA)} entries")
    print(f"Item Types: {len(ITEM_TYPE_DATA)} entries")
    print(f"Items: {len(ITEM_DATA)} entries")
    print(f"Requests: {len(REQUEST_DATA)} entries")
    print(f"Request History: {len(REQUEST_HISTORY_DATA)} entries")
    print(f"Funds: {len(FUND_DATA)} entries")
    print(f"Transactions: {len(TRANSACTION_DATA)} entries")
    print(f"Budget Allocations: {len(BUDGET_ALLOCATION_DATA)} entries")
    print(f"Funding Reports: {len(FUNDING_REPORT_DATA)} entries")
    print(f"Users: {len(USER_DATA)} entries")
    print("\nAll data is ready for database insertion!")
