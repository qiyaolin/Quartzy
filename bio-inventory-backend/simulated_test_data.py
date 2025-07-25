"""
Simulated test data for bio-inventory system
This file contains sample data for testing all modules
"""

from datetime import date, datetime, timedelta
from decimal import Decimal

# Test users data
USER_DATA = [
    {
        'username': 'sarah.johnson',
        'email': 'sarah.johnson@lab.com',
        'first_name': 'Sarah',
        'last_name': 'Johnson',
        'is_staff': True,
        'is_active': True,
        'is_superuser': True,
        'date_joined': datetime(2023, 1, 15),
        'last_login': datetime(2024, 7, 20)
    },
    {
        'username': 'michael.chen',
        'email': 'michael.chen@lab.com',
        'first_name': 'Michael',
        'last_name': 'Chen',
        'is_staff': True,
        'is_active': True,
        'is_superuser': False,
        'date_joined': datetime(2023, 3, 10),
        'last_login': datetime(2024, 7, 24)
    },
    {
        'username': 'emily.rodriguez',
        'email': 'emily.rodriguez@lab.com',
        'first_name': 'Emily',
        'last_name': 'Rodriguez',
        'is_staff': False,
        'is_active': True,
        'is_superuser': False,
        'date_joined': datetime(2023, 6, 1),
        'last_login': datetime(2024, 7, 23)
    },
    {
        'username': 'alex.thompson',
        'email': 'alex.thompson@lab.com',
        'first_name': 'Alex',
        'last_name': 'Thompson',
        'is_staff': False,
        'is_active': True,
        'is_superuser': False,
        'date_joined': datetime(2023, 9, 15),
        'last_login': datetime(2024, 7, 22)
    },
    {
        'username': 'lab.manager',
        'email': 'lab.manager@lab.com',
        'first_name': 'Lab',
        'last_name': 'Manager',
        'is_staff': True,
        'is_active': True,
        'is_superuser': False,
        'date_joined': datetime(2023, 1, 1),
        'last_login': datetime(2024, 7, 25)
    }
]

# Vendor data
VENDOR_DATA = [
    {
        'name': 'Sigma-Aldrich',
        'website': 'https://www.sigmaaldrich.com'
    },
    {
        'name': 'Thermo Fisher Scientific',
        'website': 'https://www.thermofisher.com'
    },
    {
        'name': 'New England Biolabs',
        'website': 'https://www.neb.com'
    },
    {
        'name': 'Invitrogen',
        'website': 'https://www.invitrogen.com'
    },
    {
        'name': 'Bio-Rad Laboratories',
        'website': 'https://www.bio-rad.com'
    }
]

# Location data with hierarchical structure
LOCATION_DATA = [
    {
        'name': 'Main Laboratory',
        'description': 'Primary research laboratory',
        'parent': None
    },
    {
        'name': '-80°C Freezer A',
        'description': 'Ultra-low temperature freezer for long-term storage',
        'parent': 1
    },
    {
        'name': '-80°C Freezer B',
        'description': 'Backup ultra-low temperature freezer',
        'parent': 1
    },
    {
        'name': '-20°C Freezer',
        'description': 'Standard freezer for enzymes and reagents',
        'parent': 1
    },
    {
        'name': '4°C Refrigerator',
        'description': 'Cold room refrigerator',
        'parent': 1
    },
    {
        'name': 'Room Temperature Cabinet',
        'description': 'Ambient temperature storage',
        'parent': 1
    },
    {
        'name': 'Chemical Storage Cabinet',
        'description': 'Ventilated cabinet for chemicals',
        'parent': 1
    },
    {
        'name': 'Flammable Storage',
        'description': 'Fire-safe cabinet for flammable reagents',
        'parent': 1
    }
]

# Item type data
ITEM_TYPE_DATA = [
    {
        'name': 'Antibody',
        'custom_fields_schema': {
            'clonality': 'text',
            'host_species': 'text',
            'isotype': 'text',
            'conjugate': 'text',
            'reactivity': 'text'
        }
    },
    {
        'name': 'Enzyme',
        'custom_fields_schema': {
            'activity': 'text',
            'buffer': 'text',
            'temperature': 'text',
            'units': 'text'
        }
    },
    {
        'name': 'Chemical',
        'custom_fields_schema': {
            'purity': 'text',
            'formula': 'text',
            'molecular_weight': 'text',
            'cas_number': 'text'
        }
    },
    {
        'name': 'Buffer',
        'custom_fields_schema': {
            'ph': 'text',
            'concentration': 'text',
            'components': 'text'
        }
    },
    {
        'name': 'Media',
        'custom_fields_schema': {
            'type': 'text',
            'supplements': 'text',
            'osmolality': 'text'
        }
    },
    {
        'name': 'Primer',
        'custom_fields_schema': {
            'sequence': 'text',
            'tm': 'text',
            'length': 'text',
            'modification': 'text'
        }
    },
    {
        'name': 'Plasmid',
        'custom_fields_schema': {
            'backbone': 'text',
            'resistance': 'text',
            'size': 'text',
            'insert': 'text'
        }
    },
    {
        'name': 'Kit',
        'custom_fields_schema': {
            'components': 'text',
            'protocol': 'text',
            'applications': 'text'
        }
    }
]

# Sample items with various conditions
today = date.today()
ITEM_DATA = [
    {
        'name': 'Anti-β-Actin Antibody',
        'serial_number': 'AB001',
        'item_type': 1,  # Antibody
        'vendor': 1,     # Sigma-Aldrich
        'catalog_number': 'A5441',
        'quantity': Decimal('0.5'),
        'unit': 'mL',
        'location': 4,   # -20°C Freezer
        'price': Decimal('150.00'),
        'owner': 2,      # michael.chen
        'expiration_date': today - timedelta(days=30),  # Expired
        'lot_number': 'LOT123456',
        'received_date': today - timedelta(days=400),
        'storage_temperature': '-20°C',
        'storage_conditions': 'Store in glycerol buffer, avoid freeze-thaw cycles',
        'low_stock_threshold': 1,
        'expiration_alert_days': 30
    },
    {
        'name': 'Taq DNA Polymerase',
        'serial_number': 'ENZ001',
        'item_type': 2,  # Enzyme
        'vendor': 3,     # NEB
        'catalog_number': 'M0267S',
        'quantity': Decimal('500'),
        'unit': 'units',
        'location': 4,   # -20°C Freezer
        'price': Decimal('89.00'),
        'owner': 3,      # emily.rodriguez
        'expiration_date': today + timedelta(days=25),  # Expiring soon
        'lot_number': 'LOT789012',
        'received_date': today - timedelta(days=200),
        'storage_temperature': '-20°C',
        'storage_conditions': 'Store in 50% glycerol',
        'low_stock_threshold': 100,
        'expiration_alert_days': 30
    },
    {
        'name': 'DMEM Media',
        'serial_number': 'MED001',
        'item_type': 5,  # Media
        'vendor': 2,     # Thermo Fisher
        'catalog_number': '11965092',
        'quantity': Decimal('12'),
        'unit': 'bottles',
        'location': 5,   # 4°C Refrigerator
        'price': Decimal('25.00'),
        'owner': 4,      # alex.thompson
        'expiration_date': today + timedelta(days=180),
        'lot_number': 'LOT567890',
        'received_date': today - timedelta(days=30),
        'storage_temperature': '4°C',
        'storage_conditions': 'Sterile, single use',
        'low_stock_threshold': 5,
        'expiration_alert_days': 30
    },
    {
        'name': 'Agarose Powder',
        'serial_number': 'CHM001',
        'item_type': 3,  # Chemical
        'vendor': 5,     # Bio-Rad
        'catalog_number': '1613101',
        'quantity': Decimal('15'),  # Low stock
        'unit': 'g',
        'location': 6,   # RT Cabinet
        'price': Decimal('120.00'),
        'owner': 5,      # lab.manager
        'expiration_date': today + timedelta(days=730),
        'lot_number': 'LOT789012',
        'received_date': today - timedelta(days=60),
        'storage_temperature': 'RT',
        'storage_conditions': 'Keep in original container, moisture sensitive',
        'low_stock_threshold': 50,  # Higher than current quantity
        'expiration_alert_days': 30
    },
    {
        'name': 'pUC19 Plasmid Vector',
        'serial_number': 'PLA001',
        'item_type': 7,  # Plasmid
        'vendor': 3,     # NEB
        'catalog_number': 'N3041S',
        'quantity': Decimal('20'),
        'unit': 'μg',
        'location': 2,   # -80°C Freezer A
        'price': Decimal('75.00'),
        'owner': 1,      # sarah.johnson
        'expiration_date': today + timedelta(days=450),
        'lot_number': 'LOT901234',
        'received_date': today - timedelta(days=5),
        'storage_temperature': '-80°C',
        'storage_conditions': 'Suspended in TE buffer pH 8.0',
        'low_stock_threshold': 10,
        'expiration_alert_days': 30
    }
]

# Fund data
FUND_DATA = [
    {
        'name': 'NIH Grant R01-2024',
        'description': 'Research grant for molecular biology studies',
        'grant_number': 'R01GM123456',
        'total_budget': Decimal('500000.00'),
        'spent_amount': Decimal('25000.00'),
        'start_date': date(2024, 1, 1),
        'end_date': date(2026, 12, 31),
        'created_by': 1  # sarah.johnson
    },
    {
        'name': 'NSF Equipment Grant',
        'description': 'Equipment purchase fund',
        'grant_number': 'NSF-EQP-2024',
        'total_budget': Decimal('100000.00'),
        'spent_amount': Decimal('15000.00'),
        'start_date': date(2024, 3, 1),
        'end_date': date(2025, 2, 28),
        'created_by': 5  # lab.manager
    },
    {
        'name': 'Department Startup Fund',
        'description': 'New faculty startup funding',
        'grant_number': 'DEPT-START-2023',
        'total_budget': Decimal('75000.00'),
        'spent_amount': Decimal('30000.00'),
        'start_date': date(2023, 8, 1),
        'end_date': date(2025, 7, 31),
        'created_by': 2  # michael.chen
    }
]

# Request data
REQUEST_DATA = [
    {
        'item_name': 'Anti-Mouse IgG Secondary Antibody',
        'item_type': 1,      # Antibody
        'quantity': 1,
        'unit_size': '1 mL',
        'vendor': 1,         # Sigma-Aldrich
        'catalog_number': 'A9044',
        'unit_price': Decimal('180.00'),
        'requested_by': 3,   # emily.rodriguez
        'status': 'NEW',
        'fund_id': 1,        # NIH Grant
        'notes': 'Required for ongoing protein expression studies'
    },
    {
        'item_name': 'PCR Master Mix Kit',
        'item_type': 8,      # Kit
        'quantity': 1,
        'unit_size': '1 kit',
        'vendor': 2,         # Thermo Fisher
        'catalog_number': 'F592L',
        'unit_price': Decimal('95.00'),
        'requested_by': 4,   # alex.thompson
        'status': 'APPROVED',
        'fund_id': 2,        # NSF Equipment Grant
        'notes': 'Critical for cloning project deadline'
    },
    {
        'item_name': 'Cell Culture Plates',
        'item_type': None,   # No specific type
        'quantity': 10,
        'unit_size': '96-well plates',
        'vendor': 4,         # Invitrogen
        'catalog_number': '167008',
        'unit_price': Decimal('15.00'),
        'requested_by': 2,   # michael.chen
        'status': 'ORDERED',
        'fund_id': 3,        # Department Startup
        'notes': 'Stock replenishment for cell culture work'
    }
]

# Request history data
REQUEST_HISTORY_DATA = [
    {
        'request': 1,
        'old_status': 'NEW',
        'new_status': 'NEW',
        'notes': 'Request submitted for review',
        'user': 3  # emily.rodriguez
    },
    {
        'request': 2,
        'old_status': 'NEW',
        'new_status': 'NEW',
        'notes': 'Request submitted',
        'user': 4  # alex.thompson
    },
    {
        'request': 2,
        'old_status': 'NEW',
        'new_status': 'APPROVED',
        'notes': 'Approved by lab manager - urgent need confirmed',
        'user': 5  # lab.manager
    },
    {
        'request': 3,
        'old_status': 'NEW',
        'new_status': 'NEW',
        'notes': 'Request submitted',
        'user': 2  # michael.chen
    },
    {
        'request': 3,
        'old_status': 'NEW',
        'new_status': 'APPROVED',
        'notes': 'Approved for standard restocking',
        'user': 1  # sarah.johnson
    },
    {
        'request': 3,
        'old_status': 'APPROVED',
        'new_status': 'ORDERED',
        'notes': 'Order placed with vendor, tracking #TF123456',
        'user': 5  # lab.manager
    }
]

# Transaction data
TRANSACTION_DATA = [
    {
        'fund': 1,
        'amount': Decimal('150.00'),
        'transaction_type': 'purchase',
        'item_name': 'Anti-β-Actin Antibody',
        'description': 'Anti-β-Actin Antibody purchase',
        'reference_number': 'PO-2024-001',
        'created_by': 2
    },
    {
        'fund': 1,
        'amount': Decimal('89.00'),
        'transaction_type': 'purchase',
        'item_name': 'Taq DNA Polymerase',
        'description': 'Taq DNA Polymerase',
        'reference_number': 'PO-2024-002',
        'created_by': 3
    },
    {
        'fund': 2,
        'amount': Decimal('120.00'),
        'transaction_type': 'purchase',
        'item_name': 'Agarose Powder',
        'description': 'Agarose Powder',
        'reference_number': 'PO-2024-003',
        'created_by': 5
    },
    {
        'fund': 3,
        'amount': Decimal('25.00'),
        'transaction_type': 'purchase',
        'item_name': 'DMEM Media',
        'description': 'DMEM Media',
        'reference_number': 'PO-2024-004',
        'created_by': 4
    }
]

# Budget allocation data
BUDGET_ALLOCATION_DATA = [
    {
        'fund': 1,
        'category': 'Reagents',
        'allocated_amount': Decimal('200000.00'),
        'spent_amount': Decimal('25000.00')
    },
    {
        'fund': 1,
        'category': 'Equipment',
        'allocated_amount': Decimal('150000.00'),
        'spent_amount': Decimal('0.00')
    },
    {
        'fund': 2,
        'category': 'Equipment',
        'allocated_amount': Decimal('100000.00'),
        'spent_amount': Decimal('15000.00')
    },
    {
        'fund': 3,
        'category': 'Supplies',
        'allocated_amount': Decimal('30000.00'),
        'spent_amount': Decimal('30000.00')
    }
]

# Funding report data
FUNDING_REPORT_DATA = [
    {
        'title': 'Q1 2024 Spending Report',
        'report_type': 'quarterly',
        'start_date': date(2024, 1, 1),
        'end_date': date(2024, 3, 31),
        'generated_by': 1,  # sarah.johnson
        'funds': [1, 2, 3]  # All funds
    },
    {
        'title': 'NIH Grant Mid-Year Report',
        'report_type': 'custom',
        'start_date': date(2024, 1, 1),
        'end_date': date(2024, 6, 30),
        'generated_by': 1,  # sarah.johnson
        'funds': [1]  # NIH Grant only
    }
]