from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Sum, Q, Count, Avg
from django.utils import timezone
from datetime import datetime, timedelta
from decimal import Decimal

from .models import Fund, Transaction, BudgetAllocation, FundingReport, PersonnelExpense
from .serializers import (
    FundSerializer, TransactionSerializer, BudgetAllocationSerializer,
    FundingReportSerializer, BudgetSummarySerializer, PersonnelExpenseSerializer
)
from .filters import FundFilter, TransactionFilter
from .utils import (
    calculate_budget_health_score, get_spending_predictions, 
    generate_fund_recommendations, get_cross_fund_analysis
)


class FundViewSet(viewsets.ModelViewSet):
    queryset = Fund.objects.all()
    serializer_class = FundSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = FundFilter
    search_fields = ['name', 'description', 'funding_source', 'principal_investigator']
    ordering_fields = ['name', 'total_budget', 'spent_amount', 'created_at']
    ordering = ['-created_at']

    def get_queryset(self):
        # Only staff can see all funds, regular users see only active funds
        if self.request.user.is_staff:
            return Fund.objects.all()
        return Fund.objects.filter(is_archived=False)

    @action(detail=True, methods=['post'])
    def archive(self, request, pk=None):
        fund = self.get_object()
        fund.is_archived = True
        fund.save()
        
        return Response({
            'message': f'Fund "{fund.name}" has been archived successfully.',
            'fund_id': fund.id
        })

    @action(detail=True, methods=['post'])
    def restore(self, request, pk=None):
        fund = self.get_object()
        fund.is_archived = False
        fund.save()
        
        return Response({
            'message': f'Fund "{fund.name}" has been restored successfully.',
            'fund_id': fund.id
        })

    @action(detail=True, methods=['get'])
    def transactions(self, request, pk=None):
        fund = self.get_object()
        transactions = Transaction.objects.filter(fund=fund)
        
        # Apply date filtering if provided
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        if start_date:
            transactions = transactions.filter(transaction_date__gte=start_date)
        if end_date:
            transactions = transactions.filter(transaction_date__lte=end_date)
        
        serializer = TransactionSerializer(transactions, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def budget_analysis(self, request, pk=None):
        fund = self.get_object()
        
        # Calculate monthly spending trend
        six_months_ago = timezone.now() - timedelta(days=180)
        monthly_spending = Transaction.objects.filter(
            fund=fund,
            transaction_date__gte=six_months_ago
        ).extra(
            select={'month': "TO_CHAR(transaction_date, 'YYYY-MM')"}
        ).values('month').annotate(
            total=Sum('amount')
        ).order_by('month')
        
        # Calculate category breakdown
        category_spending = BudgetAllocation.objects.filter(fund=fund).values(
            'category'
        ).annotate(
            allocated=Sum('allocated_amount'),
            spent=Sum('spent_amount')
        )
        
        # Enhanced analytics
        health_score = calculate_budget_health_score(fund)
        predictions = get_spending_predictions(fund)
        recommendations = generate_fund_recommendations(fund)
        
        return Response({
            'fund': FundSerializer(fund).data,
            'monthly_spending': list(monthly_spending),
            'category_breakdown': list(category_spending),
            'utilization_percentage': fund.utilization_percentage,
            'remaining_budget': fund.remaining_budget,
            'health_score': health_score,
            'predictions': predictions,
            'recommendations': recommendations
        })

    @action(detail=True, methods=['get'])
    def recommendations(self, request, pk=None):
        fund = self.get_object()
        recommendations = generate_fund_recommendations(fund)
        health_score = calculate_budget_health_score(fund)
        
        return Response({
            'health_score': health_score,
            'recommendations': recommendations,
            'fund_name': fund.name
        })

    @action(detail=False, methods=['get'])
    def analytics_dashboard(self, request):
        """Get comprehensive analytics across all funds"""
        analysis = get_cross_fund_analysis()
        return Response(analysis)


class TransactionViewSet(viewsets.ModelViewSet):
    queryset = Transaction.objects.all()
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = TransactionFilter
    search_fields = ['item_name', 'description', 'reference_number']
    ordering_fields = ['amount', 'transaction_date', 'transaction_type']
    ordering = ['-transaction_date']

    def get_queryset(self):
        # Filter by fund access permissions
        if self.request.user.is_staff:
            return Transaction.objects.all()
        return Transaction.objects.filter(fund__is_archived=False)

    def perform_create(self, serializer):
        # Transaction signals will automatically update fund spent amount
        transaction = serializer.save()

    @action(detail=False, methods=['get'])
    def summary(self, request):
        # Get date range from query params
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        fund_id = request.query_params.get('fund_id')
        
        transactions = self.get_queryset()
        
        if start_date:
            transactions = transactions.filter(transaction_date__gte=start_date)
        if end_date:
            transactions = transactions.filter(transaction_date__lte=end_date)
        if fund_id:
            transactions = transactions.filter(fund_id=fund_id)
        
        summary = transactions.aggregate(
            total_amount=Sum('amount'),
            transaction_count=Count('id'),
            avg_amount=Avg('amount')
        )
        
        # Add transaction type breakdown
        type_breakdown = transactions.values('transaction_type').annotate(
            count=Count('id'),
            total=Sum('amount')
        )
        
        return Response({
            'summary': summary,
            'type_breakdown': list(type_breakdown),
            'date_range': {
                'start_date': start_date,
                'end_date': end_date
            }
        })


class BudgetAllocationViewSet(viewsets.ModelViewSet):
    queryset = BudgetAllocation.objects.all()
    serializer_class = BudgetAllocationSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['fund', 'category']
    ordering_fields = ['category', 'allocated_amount', 'spent_amount']
    ordering = ['category']

    def get_queryset(self):
        if self.request.user.is_staff:
            return BudgetAllocation.objects.all()
        return BudgetAllocation.objects.filter(fund__is_archived=False)


class FundingReportViewSet(viewsets.ModelViewSet):
    queryset = FundingReport.objects.all()
    serializer_class = FundingReportSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['report_type']
    ordering = ['-generated_at']

    def perform_create(self, serializer):
        report = serializer.save()
        
        # Generate enhanced summary data
        funds = report.funds.all()
        if not funds.exists():
            funds = Fund.objects.filter(is_archived=False)
        
        # Calculate summary statistics
        total_budget = funds.aggregate(total=Sum('total_budget'))['total'] or Decimal('0.00')
        total_spent = funds.aggregate(total=Sum('spent_amount'))['total'] or Decimal('0.00')
        
        # Calculate transactions in date range
        transactions_in_period = Transaction.objects.filter(
            fund__in=funds,
            transaction_date__gte=report.start_date,
            transaction_date__lte=report.end_date
        )
        
        period_spending = transactions_in_period.aggregate(
            total=Sum('amount')
        )['total'] or Decimal('0.00')
        
        # Personnel expenses in period  
        personnel_expenses = PersonnelExpense.objects.filter(
            fund__in=funds,
            expense_date__gte=report.start_date,
            expense_date__lte=report.end_date,
            is_approved=True
        )
        
        personnel_total = personnel_expenses.aggregate(
            total=Sum('amount')
        )['total'] or Decimal('0.00')
        
        personnel_breakdown = personnel_expenses.values('expense_type').annotate(
            count=Count('id'),
            total=Sum('amount')
        )
        
        # Equipment/Supplies breakdown from items
        from items.models import Item
        
        # Get items purchased with these funds (approximate based on fund_id)
        equipment_items = Item.objects.filter(
            fund_id__in=funds.values_list('id', flat=True),
            financial_type='Equipment'
        )
        supplies_items = Item.objects.filter(
            fund_id__in=funds.values_list('id', flat=True),
            financial_type='Supplies'
        )
        
        equipment_total = equipment_items.aggregate(
            total=Sum('price')
        )['total'] or Decimal('0.00')
        
        supplies_total = supplies_items.aggregate(
            total=Sum('price')
        )['total'] or Decimal('0.00')
        
        summary_data = {
            'total_budget': float(total_budget),
            'total_spent': float(total_spent),
            'period_spending': float(period_spending),
            'fund_count': funds.count(),
            'transaction_count': transactions_in_period.count(),
            'personnel_expenses': {
                'total': float(personnel_total),
                'count': personnel_expenses.count(),
                'breakdown': list(personnel_breakdown)
            },
            'equipment_supplies': {
                'equipment_total': float(equipment_total),
                'equipment_count': equipment_items.count(),
                'supplies_total': float(supplies_total),
                'supplies_count': supplies_items.count()
            },
            'generated_date': timezone.now().isoformat()
        }
        
        report.summary_data = summary_data
        report.save()

    @action(detail=False, methods=['get'])
    def budget_summary(self, request):
        """Get overall budget summary across all funds"""
        funds = Fund.objects.filter(is_archived=False)
        
        if not funds.exists():
            return Response({
                'total_budget': 0,
                'total_spent': 0,
                'total_remaining': 0,
                'fund_count': 0,
                'active_fund_count': 0,
                'average_utilization': 0,
                'funds_near_limit': 0,
                'funds_over_budget': 0
            })
        
        # Calculate aggregates
        aggregates = funds.aggregate(
            total_budget=Sum('total_budget'),
            total_spent=Sum('spent_amount'),
            fund_count=Count('id')
        )
        
        total_budget = aggregates['total_budget'] or Decimal('0.00')
        total_spent = aggregates['total_spent'] or Decimal('0.00')
        total_remaining = total_budget - total_spent
        
        # Calculate utilization statistics
        fund_utilizations = []
        funds_near_limit = 0
        funds_over_budget = 0
        
        for fund in funds:
            utilization = fund.utilization_percentage
            fund_utilizations.append(utilization)
            
            if utilization >= 90:
                funds_near_limit += 1
            if fund.remaining_budget < 0:
                funds_over_budget += 1
        
        avg_utilization = sum(fund_utilizations) / len(fund_utilizations) if fund_utilizations else 0
        
        summary = {
            'total_budget': total_budget,
            'total_spent': total_spent,
            'total_remaining': total_remaining,
            'fund_count': aggregates['fund_count'],
            'active_fund_count': aggregates['fund_count'],
            'average_utilization': round(avg_utilization, 2),
            'funds_near_limit': funds_near_limit,
            'funds_over_budget': funds_over_budget
        }
        
        serializer = BudgetSummarySerializer(summary)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def grant_report_data(self, request):
        """Get comprehensive grant report data including Equipment/Supplies and Personnel expenses"""
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        fund_ids = request.query_params.getlist('fund_ids')
        
        # Filter funds
        funds = Fund.objects.filter(is_archived=False)
        if fund_ids:
            funds = funds.filter(id__in=fund_ids)
        
        # Default date range if not provided
        if not start_date or not end_date:
            end_date = timezone.now().date()
            start_date = end_date - timedelta(days=365)  # Last year
        
        # Personnel expenses
        personnel_expenses = PersonnelExpense.objects.filter(
            fund__in=funds,
            expense_date__gte=start_date,
            expense_date__lte=end_date,
            is_approved=True
        )
        
        personnel_summary = personnel_expenses.aggregate(
            total=Sum('amount'),
            count=Count('id')
        )
        
        personnel_by_type = personnel_expenses.values('expense_type').annotate(
            count=Count('id'),
            total=Sum('amount')
        ).order_by('-total')
        
        personnel_by_fund = personnel_expenses.values('fund__name').annotate(
            count=Count('id'),
            total=Sum('amount')
        ).order_by('-total')
        
        # Equipment and Supplies from items
        from items.models import Item
        
        items = Item.objects.filter(
            fund_id__in=funds.values_list('id', flat=True)
        ).exclude(price__isnull=True)
        
        equipment_items = items.filter(financial_type='Equipment')
        supplies_items = items.filter(financial_type='Supplies')
        
        equipment_summary = equipment_items.aggregate(
            total=Sum('price'),
            count=Count('id')
        )
        
        supplies_summary = supplies_items.aggregate(
            total=Sum('price'),
            count=Count('id')
        )
        
        # Fund utilization summary
        fund_summaries = []
        for fund in funds:
            personnel_for_fund = personnel_expenses.filter(fund=fund).aggregate(
                personnel_total=Sum('amount')
            )['personnel_total'] or Decimal('0.00')
            
            equipment_for_fund = equipment_items.filter(fund_id=fund.id).aggregate(
                equipment_total=Sum('price')
            )['equipment_total'] or Decimal('0.00')
            
            supplies_for_fund = supplies_items.filter(fund_id=fund.id).aggregate(
                supplies_total=Sum('price')
            )['supplies_total'] or Decimal('0.00')
            
            fund_summaries.append({
                'fund_name': fund.name,
                'fund_id': fund.id,
                'total_budget': fund.total_budget,
                'personnel_expenses': float(personnel_for_fund),
                'equipment_expenses': float(equipment_for_fund),
                'supplies_expenses': float(supplies_for_fund),
                'total_expenses': float(personnel_for_fund + equipment_for_fund + supplies_for_fund),
                'remaining_budget': float(fund.remaining_budget)
            })
        
        return Response({
            'report_period': {
                'start_date': start_date,
                'end_date': end_date
            },
            'personnel_expenses': {
                'summary': {
                    'total': float(personnel_summary['total'] or 0),
                    'count': personnel_summary['count']
                },
                'by_type': list(personnel_by_type),
                'by_fund': list(personnel_by_fund)
            },
            'equipment_supplies': {
                'equipment': {
                    'total': float(equipment_summary['total'] or 0),
                    'count': equipment_summary['count']
                },
                'supplies': {
                    'total': float(supplies_summary['total'] or 0),
                    'count': supplies_summary['count']
                }
            },
            'fund_breakdown': fund_summaries,
            'generated_at': timezone.now().isoformat()
        })


class PersonnelExpenseViewSet(viewsets.ModelViewSet):
    queryset = PersonnelExpense.objects.all()
    serializer_class = PersonnelExpenseSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['fund', 'employee', 'expense_type', 'is_approved']
    search_fields = ['employee_name', 'description', 'reference_number']
    ordering_fields = ['expense_date', 'amount', 'employee_name']
    ordering = ['-expense_date']

    def get_queryset(self):
        if self.request.user.is_staff:
            return PersonnelExpense.objects.all()
        return PersonnelExpense.objects.filter(fund__is_archived=False)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        expense = self.get_object()
        if not expense.is_approved:
            expense.is_approved = True
            expense.approved_by = request.user
            expense.approved_at = timezone.now()
            expense.save()
            
            return Response({
                'message': f'Personnel expense for {expense.employee_name} has been approved.',
                'expense_id': expense.id
            })
        else:
            return Response({
                'message': 'Expense is already approved.'
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        # Get date range from query params
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        fund_id = request.query_params.get('fund_id')
        
        expenses = self.get_queryset()
        
        if start_date:
            expenses = expenses.filter(expense_date__gte=start_date)
        if end_date:
            expenses = expenses.filter(expense_date__lte=end_date)
        if fund_id:
            expenses = expenses.filter(fund_id=fund_id)
        
        summary = expenses.aggregate(
            total_amount=Sum('amount'),
            expense_count=Count('id'),
            avg_amount=Avg('amount'),
            approved_count=Count('id', filter=Q(is_approved=True)),
            pending_count=Count('id', filter=Q(is_approved=False))
        )
        
        # Add expense type breakdown
        type_breakdown = expenses.values('expense_type').annotate(
            count=Count('id'),
            total=Sum('amount')
        )
        
        return Response({
            'summary': summary,
            'type_breakdown': list(type_breakdown),
            'date_range': {
                'start_date': start_date,
                'end_date': end_date
            }
        })