from rest_framework import viewsets, status, filters
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Sum, Q, Count, Avg
from django.utils import timezone
from datetime import datetime, timedelta
from decimal import Decimal

from .models import Fund, Transaction, BudgetAllocation, FundingReport, FundCarryOver
from .serializers import (
    FundSerializer, TransactionSerializer, BudgetAllocationSerializer,
    FundingReportSerializer, BudgetSummarySerializer, FundCarryOverSerializer
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

    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

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
    
    @action(detail=True, methods=['get'])
    def fiscal_year_summary(self, request, pk=None):
        """Get fiscal year summary for a specific fund"""
        fund = self.get_object()
        fiscal_year = request.query_params.get('fiscal_year', fund.get_current_fiscal_year())
        fiscal_year = int(fiscal_year)
        
        annual_budget = fund.get_annual_budget(fiscal_year)
        year_spending = fund.get_spending_by_fiscal_year(fiscal_year)
        unspent_amount = fund.get_unspent_amount_for_carryover(fiscal_year)
        
        # Get transactions for this fiscal year with cost type breakdown
        from datetime import date
        start_date = date(fiscal_year, 4, 1)
        end_date = date(fiscal_year + 1, 3, 31)
        
        transactions = fund.transactions.filter(
            transaction_date__date__range=[start_date, end_date]
        )
        
        direct_costs = transactions.filter(cost_type='direct').aggregate(
            total=Sum('amount'))['total'] or Decimal('0.00')
        indirect_costs = transactions.filter(cost_type='indirect').aggregate(
            total=Sum('amount'))['total'] or Decimal('0.00')
        
        # Category breakdown
        category_breakdown = transactions.values('expense_category').annotate(
            total=Sum('amount')
        ).order_by('-total')
        
        return Response({
            'fiscal_year': fiscal_year,
            'annual_budget': annual_budget,
            'year_spending': year_spending,
            'unspent_amount': unspent_amount,
            'direct_costs': direct_costs,
            'indirect_costs': indirect_costs,
            'category_breakdown': list(category_breakdown),
            'utilization_percentage': (year_spending / annual_budget * 100) if annual_budget > 0 else 0
        })
    
    @action(detail=True, methods=['post'])
    def create_carryover(self, request, pk=None):
        """Create a carry-over request for unspent funds"""
        fund = self.get_object()
        from_fiscal_year = int(request.data.get('from_fiscal_year', fund.get_current_fiscal_year()))
        to_fiscal_year = from_fiscal_year + 1
        
        # Calculate available amount for carry-over
        original_budget = fund.get_annual_budget(from_fiscal_year)
        spent_amount = fund.get_spending_by_fiscal_year(from_fiscal_year)
        carryover_amount = original_budget - spent_amount
        
        if carryover_amount <= 0:
            return Response(
                {'error': 'No unspent funds available for carry-over'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if carry-over already exists
        existing_carryover = FundCarryOver.objects.filter(
            fund=fund,
            from_fiscal_year=from_fiscal_year,
            to_fiscal_year=to_fiscal_year
        ).first()
        
        if existing_carryover:
            return Response(
                {'error': 'Carry-over request already exists for this period'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        carryover = FundCarryOver.objects.create(
            fund=fund,
            from_fiscal_year=from_fiscal_year,
            to_fiscal_year=to_fiscal_year,
            carryover_amount=carryover_amount,
            original_budget=original_budget,
            spent_amount=spent_amount,
            notes=request.data.get('notes', ''),
            created_by=request.user
        )
        
        serializer = FundCarryOverSerializer(carryover)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


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
    
    @action(detail=False, methods=['post'])
    def generate_form300(self, request):
        """Generate Form 300 report for Tri-Agency compliance"""
        fund_ids = request.data.get('fund_ids', [])
        fiscal_year = request.data.get('fiscal_year')
        
        if not fiscal_year:
            return Response(
                {'error': 'Fiscal year is required for Form 300 generation'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        fiscal_year = int(fiscal_year)
        from datetime import date
        start_date = date(fiscal_year, 4, 1)
        end_date = date(fiscal_year + 1, 3, 31)
        
        # Create Form 300 report
        report = FundingReport.objects.create(
            title=f'Form 300 - Grants in Aid of Research Statement (FY{fiscal_year})',
            report_type='form300',
            start_date=start_date,
            end_date=end_date,
            generated_by=request.user
        )
        
        if fund_ids:
            report.funds.set(fund_ids)
        else:
            # Include all Tri-Agency funds if none specified
            tri_agency_funds = Fund.objects.filter(
                funding_agency__in=['cihr', 'nserc', 'sshrc'],
                is_archived=False
            )
            report.funds.set(tri_agency_funds)
        
        # Generate Form 300 data
        form300_data = report.generate_form300_data()
        report.summary_data = form300_data
        report.save()
        
        serializer = FundingReportSerializer(report)
        return Response({
            'report': serializer.data,
            'form300_data': form300_data
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def generate_multiyear_summary(self, request):
        """Generate multi-year fiscal summary report"""
        start_fiscal_year = request.data.get('start_fiscal_year')
        end_fiscal_year = request.data.get('end_fiscal_year')
        fund_ids = request.data.get('fund_ids', [])
        
        if not start_fiscal_year or not end_fiscal_year:
            return Response(
                {'error': 'Both start_fiscal_year and end_fiscal_year are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        start_year = int(start_fiscal_year)
        end_year = int(end_fiscal_year)
        
        if start_year > end_year:
            return Response(
                {'error': 'start_fiscal_year cannot be greater than end_fiscal_year'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Filter funds - either specified funds or multi-year funds
        if fund_ids:
            funds = Fund.objects.filter(id__in=fund_ids, is_archived=False)
        else:
            funds = Fund.objects.filter(grant_duration_years__gt=1, is_archived=False)
        
        if not funds.exists():
            return Response(
                {'error': 'No eligible multi-year funds found'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Generate multi-year data
        multiyear_data = {
            'report_period': f'FY{start_year} to FY{end_year}',
            'generated_date': timezone.now().isoformat(),
            'funds_analyzed': funds.count(),
            'fiscal_years': []
        }
        
        # Process each fiscal year
        for fiscal_year in range(start_year, end_year + 1):
            year_data = {
                'fiscal_year': fiscal_year,
                'funds': []
            }
            
            year_totals = {
                'total_budget': Decimal('0.00'),
                'total_spent': Decimal('0.00'),
                'total_carryover': Decimal('0.00'),
                'direct_costs': Decimal('0.00'),
                'indirect_costs': Decimal('0.00')
            }
            
            for fund in funds:
                # Get fund data for this fiscal year
                annual_budget = fund.get_annual_budget(fiscal_year)
                year_spending = fund.get_spending_by_fiscal_year(fiscal_year)
                unspent_amount = fund.get_unspent_amount_for_carryover(fiscal_year)
                
                # Calculate direct/indirect costs for this year
                from datetime import date
                start_date = date(fiscal_year, 4, 1)
                end_date = date(fiscal_year + 1, 3, 31)
                
                transactions = fund.transactions.filter(
                    transaction_date__date__range=[start_date, end_date]
                )
                
                direct_costs = transactions.filter(cost_type='direct').aggregate(
                    total=Sum('amount'))['total'] or Decimal('0.00')
                indirect_costs = transactions.filter(cost_type='indirect').aggregate(
                    total=Sum('amount'))['total'] or Decimal('0.00')
                
                fund_year_data = {
                    'fund_id': fund.id,
                    'fund_name': fund.name,
                    'funding_agency': fund.funding_agency,
                    'current_year': fund.current_year,
                    'total_years': fund.grant_duration_years,
                    'annual_budget': float(annual_budget),
                    'year_spending': float(year_spending),
                    'unspent_amount': float(unspent_amount),
                    'utilization_percentage': float((year_spending / annual_budget * 100) if annual_budget > 0 else 0),
                    'direct_costs': float(direct_costs),
                    'indirect_costs': float(indirect_costs),
                    'carry_over_requests': FundCarryOver.objects.filter(
                        fund=fund, 
                        from_fiscal_year=fiscal_year
                    ).count()
                }
                
                year_data['funds'].append(fund_year_data)
                
                # Add to year totals
                year_totals['total_budget'] += annual_budget
                year_totals['total_spent'] += year_spending
                year_totals['total_carryover'] += unspent_amount
                year_totals['direct_costs'] += direct_costs
                year_totals['indirect_costs'] += indirect_costs
            
            # Convert totals to float for JSON serialization
            year_data['totals'] = {
                'total_budget': float(year_totals['total_budget']),
                'total_spent': float(year_totals['total_spent']),
                'total_remaining': float(year_totals['total_budget'] - year_totals['total_spent']),
                'total_carryover': float(year_totals['total_carryover']),
                'direct_costs': float(year_totals['direct_costs']),
                'indirect_costs': float(year_totals['indirect_costs']),
                'overall_utilization': float((year_totals['total_spent'] / year_totals['total_budget'] * 100) if year_totals['total_budget'] > 0 else 0)
            }
            
            multiyear_data['fiscal_years'].append(year_data)
        
        # Create the report record
        report = FundingReport.objects.create(
            title=f'Multi-Year Summary Report (FY{start_year} - FY{end_year})',
            report_type='multiyear_summary',
            start_date=date(start_year, 4, 1),
            end_date=date(end_year + 1, 3, 31),
            summary_data=multiyear_data,
            generated_by=request.user
        )
        
        if fund_ids:
            report.funds.set(fund_ids)
        else:
            report.funds.set(funds)
        
        serializer = FundingReportSerializer(report)
        return Response({
            'report': serializer.data,
            'multiyear_data': multiyear_data
        }, status=status.HTTP_201_CREATED)

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
        
        # Add Tri-Agency specific metrics
        tri_agency_funds = funds.filter(funding_agency__in=['cihr', 'nserc', 'sshrc'])
        
        # Calculate direct vs indirect costs across all funds
        all_transactions = Transaction.objects.filter(fund__in=funds)
        direct_costs = all_transactions.filter(cost_type='direct').aggregate(
            total=Sum('amount'))['total'] or Decimal('0.00')
        indirect_costs = all_transactions.filter(cost_type='indirect').aggregate(
            total=Sum('amount'))['total'] or Decimal('0.00')
        
        # Count pending carry-overs
        pending_carryovers = FundCarryOver.objects.filter(
            fund__in=funds,
            is_approved=False
        ).count()

        summary = {
            'total_budget': total_budget,
            'total_spent': total_spent,
            'total_remaining': total_remaining,
            'fund_count': aggregates['fund_count'],
            'active_fund_count': aggregates['fund_count'],
            'average_utilization': round(avg_utilization, 2),
            'funds_near_limit': funds_near_limit,
            'funds_over_budget': funds_over_budget,
            'total_direct_costs': direct_costs,
            'total_indirect_costs': indirect_costs,
            'tri_agency_funds_count': tri_agency_funds.count(),
            'pending_carryovers': pending_carryovers
        }
        
        serializer = BudgetSummarySerializer(summary)
        return Response(serializer.data)


class FundCarryOverViewSet(viewsets.ModelViewSet):
    queryset = FundCarryOver.objects.all()
    serializer_class = FundCarryOverSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['fund', 'from_fiscal_year', 'to_fiscal_year', 'is_approved', 'is_processed']
    ordering = ['-from_fiscal_year', '-created_at']
    
    def get_queryset(self):
        if self.request.user.is_staff:
            return FundCarryOver.objects.all()
        return FundCarryOver.objects.filter(fund__is_archived=False)
    
    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a carry-over request (admin only)"""
        if not request.user.is_staff:
            return Response(
                {'error': 'Only administrators can approve carry-overs'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        carryover = self.get_object()
        
        if carryover.is_approved:
            return Response(
                {'error': 'Carry-over is already approved'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        carryover.is_approved = True
        carryover.approved_by = request.user
        carryover.approved_at = timezone.now()
        carryover.save()
        
        return Response({
            'message': 'Carry-over approved successfully',
            'carryover_id': carryover.id
        })
    
    @action(detail=True, methods=['post'])
    def process(self, request, pk=None):
        """Process an approved carry-over (creates the transaction)"""
        if not request.user.is_staff:
            return Response(
                {'error': 'Only administrators can process carry-overs'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        carryover = self.get_object()
        
        try:
            transaction = carryover.process_carryover(request.user)
            return Response({
                'message': 'Carry-over processed successfully',
                'transaction_id': transaction.id if transaction else None,
                'carryover_id': carryover.id
            })
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=False, methods=['get'])
    def pending_approvals(self, request):
        """Get all carry-overs pending approval"""
        pending = self.get_queryset().filter(is_approved=False)
        serializer = self.get_serializer(pending, many=True)
        return Response(serializer.data)