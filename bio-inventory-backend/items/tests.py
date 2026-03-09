from decimal import Decimal

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Item, ItemLocationAllocation, ItemType, Location


class InventoryLocationAllocationApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='tester', password='secret')
        self.item_type = ItemType.objects.create(name='Consumable')

        self.main_lab = Location.objects.create(
            name='Main lab',
            location_type=Location.TYPE_AREA,
            is_leaf=False,
        )
        self.bench_shelf = Location.objects.create(
            name='Bench shelf',
            parent=self.main_lab,
            location_type=Location.TYPE_CONTAINER,
            is_leaf=False,
        )
        self.shelf_a1 = Location.objects.create(
            name='Shelf A-1',
            parent=self.bench_shelf,
            location_type=Location.TYPE_SLOT,
            is_leaf=True,
        )
        self.shelf_a2 = Location.objects.create(
            name='Shelf A-2',
            parent=self.bench_shelf,
            location_type=Location.TYPE_SLOT,
            is_leaf=True,
        )

    def test_create_item_with_multiple_allocations(self):
        response = self.client.post(
            reverse('item-list'),
            data={
                'name': 'FBS',
                'item_type_id': self.item_type.id,
                'owner_id': self.user.id,
                'quantity': '10.00',
                'unit': 'bottle',
                'location_allocations': [
                    {'location_id': self.shelf_a1.id, 'quantity': '4.00', 'note': 'left'},
                    {'location_id': self.shelf_a2.id, 'quantity': '6.00', 'note': 'right'},
                ],
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        item = Item.objects.get(name='FBS')
        self.assertEqual(item.location_id, self.shelf_a1.id)
        self.assertEqual(item.location_allocations.count(), 2)
        self.assertEqual(
            item.location_allocations.order_by('sort_order', 'id').first().location_id,
            self.shelf_a1.id,
        )

    def test_reject_mismatched_allocation_total(self):
        response = self.client.post(
            reverse('item-list'),
            data={
                'name': 'PBS',
                'item_type_id': self.item_type.id,
                'owner_id': self.user.id,
                'quantity': '10.00',
                'unit': 'bottle',
                'location_allocations': [
                    {'location_id': self.shelf_a1.id, 'quantity': '4.00'},
                    {'location_id': self.shelf_a2.id, 'quantity': '5.00'},
                ],
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('location_allocations', response.data)

    def test_filtering_by_parent_location_includes_descendants(self):
        item = Item.objects.create(
            name='DMEM',
            item_type=self.item_type,
            owner=self.user,
            quantity=Decimal('3.00'),
            unit='bottle',
            location=self.shelf_a1,
        )
        ItemLocationAllocation.objects.create(item=item, location=self.shelf_a1, quantity=Decimal('3.00'))

        response = self.client.get(reverse('item-list'), data={'location': self.main_lab.id})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['id'], item.id)

    def test_location_tree_endpoint_returns_nested_children(self):
        response = self.client.get(reverse('location-list'), data={'tree': 'true'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data[0]['name'], 'Main lab')
        self.assertEqual(response.data[0]['children'][0]['name'], 'Bench shelf')
        self.assertEqual(response.data[0]['children'][0]['children'][0]['name'], 'Shelf A-1')

    def test_merge_group_consolidates_multiple_items(self):
        item_one = Item.objects.create(
            name='Test',
            item_type=self.item_type,
            owner=self.user,
            quantity=Decimal('2.00'),
            unit='tube',
            location=self.shelf_a1,
        )
        item_two = Item.objects.create(
            name='Test',
            item_type=self.item_type,
            owner=self.user,
            quantity=Decimal('3.00'),
            unit='tube',
            location=self.shelf_a2,
        )
        ItemLocationAllocation.objects.create(item=item_one, location=self.shelf_a1, quantity=Decimal('2.00'))
        ItemLocationAllocation.objects.create(item=item_two, location=self.shelf_a2, quantity=Decimal('3.00'))

        response = self.client.post(
            reverse('item-merge-group'),
            data={
                'item_ids': [item_one.id, item_two.id],
                'name': 'Test',
                'item_type_id': self.item_type.id,
                'owner_id': self.user.id,
                'quantity': '5.00',
                'unit': 'tube',
                'location_allocations': [
                    {'location_id': self.shelf_a1.id, 'quantity': '2.00'},
                    {'location_id': self.shelf_a2.id, 'quantity': '3.00'},
                ],
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(Item.objects.filter(name='Test').count(), 1)
        merged_item = Item.objects.get(name='Test')
        self.assertEqual(merged_item.quantity, Decimal('5.00'))
        self.assertEqual(merged_item.location_allocations.count(), 2)
