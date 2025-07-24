from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Sum, Q, Count, Avg
from django.utils import timezone
from datetime import datetime, timedelta
from decimal import Decimal

from .models import Fund, Transaction, BudgetAllocation, FundingReport
from .serializers import (
    FundSerializer, TransactionSerializer, BudgetAllocationSerializer,
    FundingReportSerializer, BudgetSummarySerializer
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
        
        # Generate summary data
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
        
        summary_data = {
            'total_budget': float(total_budget),
            'total_spent': float(total_spent),
            'period_spending': float(period_spending),
            'fund_count': funds.count(),
            'transaction_count': transactions_in_period.count(),
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