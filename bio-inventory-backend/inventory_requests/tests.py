from decimal import Decimal
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from items.models import Item, ItemLocationAllocation, ItemType, Location, Vendor
from .models import Request


class MarkReceivedAPITest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='receiver',
            email='receiver@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)

        self.item_type = ItemType.objects.create(id=1, name='General Supply')
        self.pack_item_type = ItemType.objects.create(
            name='Pack Supply',
            tracking_mode=ItemType.TrackingMode.PACK_MANAGED,
            label_mode=ItemType.LabelMode.NONE,
        )
        self.vendor = Vendor.objects.create(name='Test Vendor')
        self.location = Location.objects.create(name='Shelf A')

        self.request_obj = Request.objects.create(
            item_name='Test Reagent',
            requested_by=self.user,
            status='ORDERED',
            vendor=self.vendor,
            catalog_number='CAT-123',
            quantity=3,
            remaining_quantity=3,
            unit_size='EA',
            unit_price=Decimal('12.50'),
            barcode='REQ-DUPLICATE01'
        )

    def test_mark_received_invalid_location_returns_400(self):
        response = self.client.post(
            f'/api/requests/{self.request_obj.id}/mark_received/',
            {'receipts': [{'location_id': 999999}]},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error'], 'Selected location does not exist.')
        self.request_obj.refresh_from_db()
        self.assertEqual(self.request_obj.status, 'ORDERED')
        self.assertEqual(self.request_obj.remaining_quantity, 3)

    def test_mark_received_creates_one_item_per_receipt_and_updates_remaining(self):
        location_b = Location.objects.create(name='Shelf B')

        response = self.client.post(
            f'/api/requests/{self.request_obj.id}/mark_received/',
            {
                'receipts': [
                    {'location_id': self.location.id, 'quantity': 1},
                    {'location_id': location_b.id, 'quantity': 1, 'note': 'Put into backup shelf'},
                ],
                'receive_metadata': {
                    'lot_number': 'LOT-42',
                    'received_date': '2026-03-09',
                    'expiration_date': '2026-12-31',
                    'storage_temperature': '4C',
                    'storage_conditions': 'Keep dry',
                },
            },
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['created_items']), 2)
        self.assertEqual(response.data['remaining_quantity'], 1)
        self.assertEqual(response.data['request_status'], 'ORDERED')

        created_ids = [entry['id'] for entry in response.data['created_items']]
        created_items = list(Item.objects.filter(id__in=created_ids).order_by('id'))
        self.assertEqual(len(created_items), 2)
        self.assertTrue(all(item.quantity == 1 for item in created_items))
        self.assertEqual(len({item.barcode for item in created_items}), 2)
        self.assertTrue(all(item.lot_number == 'LOT-42' for item in created_items))
        self.assertTrue(all(str(item.received_date) == '2026-03-09' for item in created_items))
        self.assertTrue(all(str(item.expiration_date) == '2026-12-31' for item in created_items))
        self.assertEqual(ItemLocationAllocation.objects.filter(item_id=created_items[1].id).first().note, 'Put into backup shelf')

        self.request_obj.refresh_from_db()
        self.assertEqual(self.request_obj.status, 'ORDERED')
        self.assertEqual(self.request_obj.remaining_quantity, 1)
        self.assertEqual(Request.objects.count(), 1)

    def test_mark_received_completes_request_without_backorder(self):
        response = self.client.post(
            f'/api/requests/{self.request_obj.id}/mark_received/',
            {'location_id': self.location.id, 'quantity_received': 3},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.request_obj.refresh_from_db()
        self.assertEqual(self.request_obj.status, 'RECEIVED')
        self.assertEqual(self.request_obj.remaining_quantity, 0)
        self.assertEqual(Request.objects.count(), 1)
        self.assertEqual(Item.objects.filter(owner=self.user).count(), 3)

    def test_mark_received_rejects_over_receive(self):
        response = self.client.post(
            f'/api/requests/{self.request_obj.id}/mark_received/',
            {'location_id': self.location.id, 'quantity_received': 4},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error'], 'Received quantity cannot exceed remaining ordered quantity.')

    def test_mark_received_pack_managed_creates_quantity_inventory_with_allocations(self):
        pack_request = Request.objects.create(
            item_name='Boxed Tips',
            item_type=self.pack_item_type,
            requested_by=self.user,
            status='ORDERED',
            vendor=self.vendor,
            catalog_number='PACK-1',
            quantity=6,
            remaining_quantity=6,
            unit_size='box',
            unit_price=Decimal('4.25'),
        )
        location_b = Location.objects.create(name='Shelf C')

        response = self.client.post(
            f'/api/requests/{pack_request.id}/mark_received/',
            {
                'receipts': [
                    {'location_id': self.location.id, 'quantity': 4, 'note': 'Primary stock'},
                    {'location_id': location_b.id, 'quantity': 2, 'note': 'Overflow'},
                ],
                'receive_metadata': {
                    'open_unit_count': 1,
                    'received_date': '2026-03-09',
                },
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['created_items']), 2)

        created_items = list(Item.objects.filter(catalog_number='PACK-1').order_by('id'))
        self.assertEqual([item.quantity for item in created_items], [Decimal('4'), Decimal('2')])
        self.assertTrue(all(item.tracking_mode == ItemType.TrackingMode.PACK_MANAGED for item in created_items))
        self.assertTrue(all(item.properties.get('open_unit_count') == 1 for item in created_items))
        self.assertEqual(
            list(ItemLocationAllocation.objects.filter(item__in=created_items).order_by('item_id').values_list('quantity', flat=True)),
            [Decimal('4'), Decimal('2')],
        )

        pack_request.refresh_from_db()
        self.assertEqual(pack_request.status, 'RECEIVED')
        self.assertEqual(pack_request.remaining_quantity, 0)

    def test_batch_mark_received_handles_mixed_tracking_modes(self):
        pack_request = Request.objects.create(
            item_name='Cryo Boxes',
            item_type=self.pack_item_type,
            requested_by=self.user,
            status='ORDERED',
            vendor=self.vendor,
            catalog_number='CRYO-BOX',
            quantity=3,
            remaining_quantity=3,
            unit_size='box',
            unit_price=Decimal('8.50'),
        )
        location_b = Location.objects.create(name='Shelf D')

        response = self.client.post(
            '/api/requests/batch_mark_received/',
            {
                'receipts_by_request': [
                    {
                        'request_id': self.request_obj.id,
                        'receipts': [{'location_id': self.location.id, 'quantity': 2}],
                        'receive_metadata': {'lot_number': 'INST-LOT'},
                    },
                    {
                        'request_id': pack_request.id,
                        'receipts': [{'location_id': location_b.id, 'quantity': 3, 'note': 'Bulk row'}],
                        'receive_metadata': {'open_unit_count': 2},
                    },
                ]
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['success_count'], 2)
        self.assertEqual(response.data['failure_count'], 0)

        self.request_obj.refresh_from_db()
        pack_request.refresh_from_db()
        self.assertEqual(self.request_obj.remaining_quantity, 1)
        self.assertEqual(pack_request.remaining_quantity, 0)
        self.assertEqual(Item.objects.filter(catalog_number='CAT-123').count(), 2)
        self.assertEqual(Item.objects.filter(catalog_number='CRYO-BOX').count(), 1)

    def test_reorder_copies_item_type_fund_and_notes(self):
        original_request = Request.objects.create(
            item_name='Original Buffer',
            item_type=self.pack_item_type,
            requested_by=self.user,
            status='RECEIVED',
            vendor=self.vendor,
            catalog_number='BUF-99',
            quantity=2,
            remaining_quantity=0,
            unit_size='bottle',
            unit_price=Decimal('14.00'),
            fund_id=123,
            url='https://example.com/buffer',
            notes='Reorder this exact SKU',
        )

        response = self.client.post(
            f'/api/requests/{original_request.id}/reorder/',
            {},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        new_request = Request.objects.exclude(id=original_request.id).get(item_name='Original Buffer')
        self.assertEqual(new_request.item_type_id, self.pack_item_type.id)
        self.assertEqual(new_request.fund_id, 123)
        self.assertEqual(new_request.notes, 'Reorder this exact SKU')
        self.assertEqual(new_request.catalog_number, 'BUF-99')
