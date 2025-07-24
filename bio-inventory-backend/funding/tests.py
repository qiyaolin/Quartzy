from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APITestCase
from rest_framework import status
from decimal import Decimal
from .models import Fund, Transaction, BudgetAllocation


class FundModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        
        self.fund = Fund.objects.create(
            name='Test Fund',
            description='A test funding source',
            total_budget=Decimal('10000.00'),
            funding_source='Test Agency',
            created_by=self.user
        )

    def test_fund_creation(self):
        self.assertEqual(self.fund.name, 'Test Fund')
        self.assertEqual(self.fund.total_budget, Decimal('10000.00'))
        self.assertEqual(self.fund.spent_amount, Decimal('0.00'))
        self.assertEqual(self.fund.remaining_budget, Decimal('10000.00'))
        self.assertEqual(self.fund.utilization_percentage, 0)

    def test_fund_utilization_calculation(self):
        # Add some spending
        self.fund.spent_amount = Decimal('2500.00')
        self.fund.save()
        
        self.assertEqual(self.fund.remaining_budget, Decimal('7500.00'))
        self.assertEqual(self.fund.utilization_percentage, 25.0)

    def test_can_afford_method(self):
        self.assertTrue(self.fund.can_afford(Decimal('5000.00')))
        self.assertFalse(self.fund.can_afford(Decimal('15000.00')))


class TransactionModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        
        self.fund = Fund.objects.create(
            name='Test Fund',
            total_budget=Decimal('10000.00'),
            created_by=self.user
        )

    def test_transaction_creation(self):
        transaction = Transaction.objects.create(
            fund=self.fund,
            amount=Decimal('500.00'),
            transaction_type='purchase',
            item_name='Test Item',
            description='Test purchase',
            created_by=self.user
        )
        
        self.assertEqual(transaction.fund, self.fund)
        self.assertEqual(transaction.amount, Decimal('500.00'))
        self.assertEqual(transaction.transaction_type, 'purchase')


class FundAPITest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
            is_staff=True
        )
        
        self.fund_data = {
            'name': 'Test API Fund',
            'description': 'Test fund via API',
            'total_budget': '15000.00',
            'funding_source': 'API Test Agency'
        }

    def test_create_fund_authenticated(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post('/api/funds/', self.fund_data)
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Fund.objects.count(), 1)
        
        fund = Fund.objects.first()
        self.assertEqual(fund.name, 'Test API Fund')
        self.assertEqual(fund.created_by, self.user)

    def test_create_fund_unauthenticated(self):
        response = self.client.post('/api/funds/', self.fund_data)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_funds(self):
        Fund.objects.create(
            name='Test Fund 1',
            total_budget=Decimal('10000.00'),
            created_by=self.user
        )
        Fund.objects.create(
            name='Test Fund 2',
            total_budget=Decimal('20000.00'),
            created_by=self.user
        )
        
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/funds/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 2)

    def test_archive_fund(self):
        fund = Fund.objects.create(
            name='Test Fund',
            total_budget=Decimal('10000.00'),
            created_by=self.user
        )
        
        self.client.force_authenticate(user=self.user)
        response = self.client.post(f'/api/funds/{fund.id}/archive/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        fund.refresh_from_db()
        self.assertTrue(fund.is_archived)


class TransactionAPITest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
            is_staff=True
        )
        
        self.fund = Fund.objects.create(
            name='Test Fund',
            total_budget=Decimal('10000.00'),
            created_by=self.user
        )
        
        self.transaction_data = {
            'fund_id': self.fund.id,
            'amount': '750.00',
            'transaction_type': 'purchase',
            'item_name': 'Test Equipment',
            'description': 'Equipment purchase for lab'
        }

    def test_create_transaction(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post('/api/transactions/', self.transaction_data)
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Transaction.objects.count(), 1)
        
        transaction = Transaction.objects.first()
        self.assertEqual(transaction.amount, Decimal('750.00'))
        self.assertEqual(transaction.created_by, self.user)

    def test_transaction_updates_fund_spending(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post('/api/transactions/', self.transaction_data)
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        self.fund.refresh_from_db()
        self.assertEqual(self.fund.spent_amount, Decimal('750.00'))


class BudgetAllocationTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        
        self.fund = Fund.objects.create(
            name='Test Fund',
            total_budget=Decimal('10000.00'),
            created_by=self.user
        )

    def test_budget_allocation_creation(self):
        allocation = BudgetAllocation.objects.create(
            fund=self.fund,
            category='Equipment',
            allocated_amount=Decimal('5000.00'),
            description='Equipment budget allocation'
        )
        
        self.assertEqual(allocation.category, 'Equipment')
        self.assertEqual(allocation.allocated_amount, Decimal('5000.00'))
        self.assertEqual(allocation.spent_amount, Decimal('0.00'))
        self.assertEqual(allocation.remaining_amount, Decimal('5000.00'))
        self.assertEqual(allocation.utilization_percentage, 0)

    def test_allocation_utilization_calculation(self):
        allocation = BudgetAllocation.objects.create(
            fund=self.fund,
            category='Supplies',
            allocated_amount=Decimal('2000.00')
        )
        
        # Simulate spending
        allocation.spent_amount = Decimal('800.00')
        allocation.save()
        
        self.assertEqual(allocation.remaining_amount, Decimal('1200.00'))
        self.assertEqual(allocation.utilization_percentage, 40.0)