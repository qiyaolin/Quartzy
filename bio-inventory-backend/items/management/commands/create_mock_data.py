from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from items.models import Vendor, Location, ItemType, Item
from datetime import date, timedelta
import random

class Command(BaseCommand):
    help = 'Create mock data for testing the laboratory inventory system'

    def handle(self, *args, **options):
        self.stdout.write('Creating mock data for laboratory inventory...')
        
        # Create test user if not exists
        user, created = User.objects.get_or_create(
            username='testuser',
            defaults={
                'email': 'test@lab.com',
                'first_name': 'Lab',
                'last_name': 'User'
            }
        )
        
        # Create vendors
        vendors_data = [
            {'name': 'Sigma-Aldrich', 'website': 'https://www.sigmaaldrich.com'},
            {'name': 'Thermo Fisher Scientific', 'website': 'https://www.thermofisher.com'},
            {'name': 'New England Biolabs', 'website': 'https://www.neb.com'},
            {'name': 'Invitrogen', 'website': 'https://www.invitrogen.com'},
            {'name': 'Bio-Rad', 'website': 'https://www.bio-rad.com'},
        ]
        
        vendors = []
        for vendor_data in vendors_data:
            vendor, created = Vendor.objects.get_or_create(
                name=vendor_data['name'],
                defaults={'website': vendor_data['website']}
            )
            vendors.append(vendor)
            if created:
                self.stdout.write(f'Created vendor: {vendor.name}')

        # Create locations
        locations_data = [
            {'name': '-80°C Freezer A', 'description': 'Ultra-low temperature freezer for long-term storage'},
            {'name': '-80°C Freezer B', 'description': 'Backup ultra-low temperature freezer'},
            {'name': '-20°C Freezer', 'description': 'Standard freezer for enzymes and reagents'},
            {'name': '4°C Refrigerator', 'description': 'Cold room refrigerator'},
            {'name': 'Room Temperature Cabinet', 'description': 'Ambient temperature storage'},
            {'name': 'Chemical Storage Cabinet', 'description': 'Ventilated cabinet for chemicals'},
            {'name': 'Flammable Storage', 'description': 'Fire-safe cabinet for flammable reagents'},
        ]
        
        locations = []
        for loc_data in locations_data:
            location, created = Location.objects.get_or_create(
                name=loc_data['name'],
                defaults={'description': loc_data['description']}
            )
            locations.append(location)
            if created:
                self.stdout.write(f'Created location: {location.name}')

        # Create item types
        item_types_data = [
            {'name': 'Antibody', 'custom_fields_schema': {'Clonality': 'text', 'Host Species': 'text', 'Isotype': 'text'}},
            {'name': 'Enzyme', 'custom_fields_schema': {'Activity': 'text', 'Buffer': 'text', 'Temperature': 'text'}},
            {'name': 'Chemical', 'custom_fields_schema': {'Purity': 'text', 'Formula': 'text', 'MW': 'text'}},
            {'name': 'Buffer', 'custom_fields_schema': {'pH': 'text', 'Concentration': 'text'}},
            {'name': 'Media', 'custom_fields_schema': {'Type': 'text', 'Supplements': 'text'}},
            {'name': 'Primer', 'custom_fields_schema': {'Sequence': 'text', 'Tm': 'text', 'Length': 'text'}},
            {'name': 'Plasmid', 'custom_fields_schema': {'Backbone': 'text', 'Resistance': 'text', 'Size': 'text'}},
        ]
        
        item_types = []
        for type_data in item_types_data:
            item_type, created = ItemType.objects.get_or_create(
                name=type_data['name'],
                defaults={'custom_fields_schema': type_data['custom_fields_schema']}
            )
            item_types.append(item_type)
            if created:
                self.stdout.write(f'Created item type: {item_type.name}')

        # Create sample items with various expiration statuses
        today = date.today()
        
        sample_items = [
            # Expired items
            {
                'name': 'Anti-β-Actin Antibody',
                'item_type': item_types[0],  # Antibody
                'vendor': vendors[0],  # Sigma-Aldrich
                'catalog_number': 'A5441',
                'quantity': 0.5,
                'unit': 'mL',
                'location': locations[2],  # -20°C Freezer
                'price': 150.00,
                'expiration_date': today - timedelta(days=30),
                'lot_number': 'LOT123456',
                'received_date': today - timedelta(days=400),
                'storage_temperature': '-20°C',
                'storage_conditions': 'Store in glycerol buffer, avoid freeze-thaw cycles'
            },
            {
                'name': 'Taq DNA Polymerase',
                'item_type': item_types[1],  # Enzyme
                'vendor': vendors[2],  # NEB
                'catalog_number': 'M0267S',
                'quantity': 500,
                'unit': 'units',
                'location': locations[2],
                'price': 89.00,
                'expiration_date': today - timedelta(days=15),
                'lot_number': 'LOT789012',
                'received_date': today - timedelta(days=365),
                'storage_temperature': '-20°C',
                'storage_conditions': 'Store in 50% glycerol'
            },
            
            # Expiring soon items
            {
                'name': 'Ampicillin Sodium Salt',
                'item_type': item_types[2],  # Chemical
                'vendor': vendors[0],
                'catalog_number': 'A9518',
                'quantity': 5.0,
                'unit': 'g',
                'location': locations[4],  # RT Cabinet
                'price': 45.50,
                'expiration_date': today + timedelta(days=20),
                'lot_number': 'LOT345678',
                'received_date': today - timedelta(days=300),
                'storage_temperature': 'RT',
                'storage_conditions': 'Keep dry, protect from light'
            },
            {
                'name': 'Restriction Enzyme BamHI',
                'item_type': item_types[1],
                'vendor': vendors[2],
                'catalog_number': 'R0136S',
                'quantity': 2000,
                'unit': 'units',
                'location': locations[2],
                'price': 65.00,
                'expiration_date': today + timedelta(days=25),
                'lot_number': 'LOT456789',
                'received_date': today - timedelta(days=200),
                'storage_temperature': '-20°C',
                'storage_conditions': 'Store in NEBuffer 3.1'
            },
            
            # Good items
            {
                'name': 'DMEM Media',
                'item_type': item_types[4],  # Media
                'vendor': vendors[1],  # Thermo Fisher
                'catalog_number': '11965092',
                'quantity': 12,
                'unit': 'bottles',
                'location': locations[3],  # 4°C
                'price': 25.00,
                'expiration_date': today + timedelta(days=180),
                'lot_number': 'LOT567890',
                'received_date': today - timedelta(days=30),
                'storage_temperature': '4°C',
                'storage_conditions': 'Sterile, single use'
            },
            {
                'name': 'Forward Primer Set',
                'item_type': item_types[5],  # Primer
                'vendor': vendors[3],  # Invitrogen
                'catalog_number': 'P1001',
                'quantity': 100,
                'unit': 'nmol',
                'location': locations[1],  # -80°C Freezer B
                'price': 15.00,
                'expiration_date': today + timedelta(days=365),
                'lot_number': 'LOT678901',
                'received_date': today - timedelta(days=10),
                'storage_temperature': '-80°C',
                'storage_conditions': 'Lyophilized, reconstitute with TE buffer'
            },
            
            # Low stock items
            {
                'name': 'Agarose Powder',
                'item_type': item_types[2],
                'vendor': vendors[4],  # Bio-Rad
                'catalog_number': '1613101',
                'quantity': 15,  # Low quantity
                'unit': 'g',
                'location': locations[4],
                'price': 120.00,
                'expiration_date': today + timedelta(days=730),
                'lot_number': 'LOT789012',
                'received_date': today - timedelta(days=60),
                'low_stock_threshold': 50,  # Set threshold higher than current quantity
                'storage_temperature': 'RT',
                'storage_conditions': 'Keep in original container, moisture sensitive'
            },
            {
                'name': 'PBS Buffer 10X',
                'item_type': item_types[3],  # Buffer
                'vendor': vendors[1],
                'catalog_number': 'P5493',
                'quantity': 2,  # Low quantity
                'unit': 'L',
                'location': locations[3],
                'price': 35.00,
                'expiration_date': today + timedelta(days=90),
                'lot_number': 'LOT890123',
                'received_date': today - timedelta(days=15),
                'low_stock_threshold': 5,
                'storage_temperature': '4°C',
                'storage_conditions': 'Sterile, ready to use'
            },
            
            # Additional test items
            {
                'name': 'pUC19 Plasmid Vector',
                'item_type': item_types[6],  # Plasmid
                'vendor': vendors[2],
                'catalog_number': 'N3041S',
                'quantity': 20,
                'unit': 'μg',
                'location': locations[1],
                'price': 75.00,
                'expiration_date': today + timedelta(days=450),
                'lot_number': 'LOT901234',
                'received_date': today - timedelta(days=5),
                'storage_temperature': '-80°C',
                'storage_conditions': 'Suspended in TE buffer pH 8.0'
            },
            {
                'name': 'Ethanol 200 Proof',
                'item_type': item_types[2],
                'vendor': vendors[0],
                'catalog_number': 'E7023',
                'quantity': 1,
                'unit': 'L',
                'location': locations[6],  # Flammable storage
                'price': 65.00,
                'expiration_date': None,  # No expiration
                'lot_number': 'LOT012345',
                'received_date': today - timedelta(days=90),
                'storage_temperature': 'RT',
                'storage_conditions': 'Flammable liquid, keep away from heat sources'
            },
        ]
        
        created_count = 0
        for item_data in sample_items:
            # Check if item already exists
            existing_item = Item.objects.filter(
                name=item_data['name'],
                catalog_number=item_data.get('catalog_number', '')
            ).first()
            
            if not existing_item:
                Item.objects.create(
                    name=item_data['name'],
                    item_type=item_data['item_type'],
                    vendor=item_data['vendor'],
                    catalog_number=item_data.get('catalog_number', ''),
                    quantity=item_data['quantity'],
                    unit=item_data['unit'],
                    location=item_data['location'],
                    price=item_data.get('price'),
                    owner=user,
                    expiration_date=item_data.get('expiration_date'),
                    lot_number=item_data.get('lot_number', ''),
                    received_date=item_data.get('received_date'),
                    expiration_alert_days=item_data.get('expiration_alert_days', 30),
                    storage_temperature=item_data.get('storage_temperature', ''),
                    storage_conditions=item_data.get('storage_conditions', ''),
                    low_stock_threshold=item_data.get('low_stock_threshold', 10)
                )
                created_count += 1
                self.stdout.write(f'Created item: {item_data["name"]}')
            else:
                # Update existing item with expiration data
                for field, value in item_data.items():
                    if field not in ['name', 'item_type', 'vendor'] and hasattr(existing_item, field):
                        setattr(existing_item, field, value)
                existing_item.save()
                self.stdout.write(f'Updated item: {item_data["name"]}')

        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully created {created_count} new items with mock data!\n'
                f'Summary:\n'
                f'- 2 expired items\n'
                f'- 2 items expiring soon (within 30 days)\n'
                f'- 2 items with low stock\n'
                f'- 4 good items for testing\n'
                f'- Various storage conditions and locations'
            )
        )