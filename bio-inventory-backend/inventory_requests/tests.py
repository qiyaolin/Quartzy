from decimal import Decimal
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from items.models import Item, ItemType, Location, Vendor
from .models import Request


class MarkReceivedAPITest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='receiver',
            email='receiver@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)

        # mark_received currently hardcodes item_type_id=1
        self.item_type = ItemType.objects.create(id=1, name='General Supply')
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
                    {'location_id': self.location.id},
                    {'location_id': location_b.id},
                ]
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
