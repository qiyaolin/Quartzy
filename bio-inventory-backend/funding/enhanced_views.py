from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Sum, Q, F, Count, Prefetch, Avg
from django.utils import timezone
from datetime import timedelta, datetime
from decimal import Decimal
from django_filters.rest_framework import DjangoFilterBackend
from django.core.cache import cache
from django.db import connection
import json
import hashlib
import time
import logging
from functools import wraps

logger = logging.getLogger(__name__)

def monitor_performance(func):
    """Decorator to monitor query performance and execution time"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.time()
        initial_queries = len(connection.queries)
        
        result = func(*args, **kwargs)
        
        end_time = time.time()
        final_queries = len(connection.queries)
        execution_time = end_time - start_time
        query_count = final_queries - initial_queries
        
        logger.info(f"{func.__name__}: {execution_time:.2f}s, {query_count} queries")
        
        # Add performance metrics to response if it's a Response object
        if hasattr(result, 'data') and isinstance(result.data, dict):
            result.data['_performance'] = {
                'execution_time': round(execution_time, 2),
                'query_count': query_count,
                'cached': 'cache_hit' in kwargs
            }
        
        return result
    return wrapper

from .models import (
    EnhancedFund, BudgetCategory, EnhancedBudgetAllocation, 
    FinancialTransaction, BudgetForecast, FinancialAlert,
    Currency, FundingAgency, CostCenter
)
from .enhanced_serializers import (
    EnhancedFundSerializer, BudgetCategorySerializer,
    EnhancedBudgetAllocationSerializer, FinancialTransactionSerializer,
    BudgetForecastSerializer, FinancialAlertSerializer
)

class EnhancedFundViewSet(viewsets.ModelViewSet):
    """增强的资金管理视图集"""
    queryset = EnhancedFund.objects.all()
    serializer_class = EnhancedFundSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'fund_id', 'grant_number']
    ordering_fields = ['created_at', 'end_date', 'total_budget']
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # 根据用户权限过滤
        user = self.request.user
        if not user.is_superuser:
            queryset = queryset.filter(
                Q(principal_investigator=user) | 
                Q(co_investigators=user) |
                Q(created_by=user)
            ).distinct()
        
        return queryset
    
    @action(detail=False, methods=['get'])
    def dashboard_stats(self, request):
        """Financial dashboard statistics for McGill Biology Lab"""
        queryset = self.get_queryset().filter(status='active')
        
        # Basic statistics
        total_funds = queryset.count()
        total_budget = queryset.aggregate(total=Sum('total_budget'))['total'] or 0
        total_spent = queryset.aggregate(total=Sum('spent_amount'))['total'] or 0
        total_committed = queryset.aggregate(total=Sum('committed_amount'))['total'] or 0
        
        # Biology lab specific: Expiring funds (within 90 days for better grant planning)
        ninety_days_later = timezone.now().date() + timedelta(days=90)
        expiring_funds = queryset.filter(end_date__lte=ninety_days_later).count()
        
        # 预算使用率分布
        utilization_ranges = {
            'under_50': queryset.filter(spent_amount__lt=F('total_budget') * 0.5).count(),
            '50_to_80': queryset.filter(
                spent_amount__gte=F('total_budget') * 0.5,
                spent_amount__lt=F('total_budget') * 0.8
            ).count(),
            '80_to_95': queryset.filter(
                spent_amount__gte=F('total_budget') * 0.8,
                spent_amount__lt=F('total_budget') * 0.95
            ).count(),
            'over_95': queryset.filter(spent_amount__gte=F('total_budget') * 0.95).count(),
        }
        
        # 按资助机构统计
        agency_stats = queryset.values('funding_agency__name').annotate(
            count=Count('id'),
            total_budget=Sum('total_budget'),
            total_spent=Sum('spent_amount')
        ).order_by('-total_budget')[:10]
        
        # Monthly spending trend (last 12 months) - biology lab analysis
        monthly_spending = self._get_monthly_spending_trend(queryset)
        
        return Response({
            'summary': {
                'total_funds': total_funds,
                'total_budget': float(total_budget),
                'total_spent': float(total_spent),
                'total_committed': float(total_committed),
                'available_budget': float(total_budget - total_spent - total_committed),
                'overall_utilization': float((total_spent / total_budget * 100) if total_budget > 0 else 0),
                'expiring_funds': expiring_funds
            },
            'utilization_distribution': utilization_ranges,
            'agency_breakdown': list(agency_stats),
            'monthly_spending_trend': monthly_spending,
            'alerts_count': FinancialAlert.objects.filter(
                fund__in=queryset, 
                is_active=True, 
                is_acknowledged=False
            ).count()
        })
    
    @action(detail=False, methods=['get'])
    def budget_analysis(self, request):
        """预算分析"""
        queryset = self.get_queryset().filter(status='active')
        
        # 按类别分析
        category_analysis = EnhancedBudgetAllocation.objects.filter(
            fund__in=queryset
        ).values('category__name').annotate(
            allocated=Sum('allocated_amount'),
            spent=Sum('spent_amount'),
            committed=Sum('committed_amount')
        ).order_by('-allocated')
        
        # 风险分析
        risk_funds = []
        for fund in queryset:
            risk_score = self._calculate_risk_score(fund)
            if risk_score > 0.7:  # 高风险阈值
                risk_funds.append({
                    'fund_id': fund.fund_id,
                    'name': fund.name,
                    'risk_score': risk_score,
                    'risk_factors': self._identify_risk_factors(fund)
                })
        
        return Response({
            'category_analysis': list(category_analysis),
            'high_risk_funds': risk_funds,
            'recommendations': self._generate_budget_recommendations(queryset)
        })
    
    @action(detail=True, methods=['post'])
    def create_forecast(self, request, pk=None):
        """创建预算预测"""
        fund = self.get_object()
        forecast_months = int(request.data.get('forecast_months', 12))
        
        # 基于历史数据生成预测
        historical_data = self._get_historical_spending(fund, 12)  # 过去12个月
        forecast_data = self._generate_spending_forecast(historical_data, forecast_months)
        
        forecast = BudgetForecast.objects.create(
            fund=fund,
            forecast_date=timezone.now().date(),
            forecast_period_months=forecast_months,
            projected_spending=forecast_data['spending'],
            projected_commitments=forecast_data['commitments'],
            assumptions=request.data.get('assumptions', ''),
            created_by=request.user
        )
        
        return Response(BudgetForecastSerializer(forecast).data)
    
    @action(detail=True, methods=['get'])
    def spending_analysis(self, request, pk=None):
        """支出分析"""
        fund = self.get_object()
        
        # 按类别支出分析
        category_spending = fund.transactions.filter(
            status='processed',
            transaction_type='purchase'
        ).values('allocation__category__name').annotate(
            total_amount=Sum('amount_in_fund_currency'),
            transaction_count=Count('id')
        ).order_by('-total_amount')
        
        # 月度支出趋势
        monthly_trend = self._get_fund_monthly_trend(fund)
        
        # 供应商分析
        vendor_analysis = fund.transactions.filter(
            status='processed',
            transaction_type='purchase'
        ).values('vendor_name').annotate(
            total_spent=Sum('amount_in_fund_currency'),
            transaction_count=Count('id')
        ).order_by('-total_spent')[:10]
        
        # 大额支出
        large_transactions = fund.transactions.filter(
            status='processed',
            amount_in_fund_currency__gte=1000  # 可配置阈值
        ).order_by('-amount_in_fund_currency')[:20]
        
        return Response({
            'category_breakdown': list(category_spending),
            'monthly_trend': monthly_trend,
            'top_vendors': list(vendor_analysis),
            'large_transactions': FinancialTransactionSerializer(large_transactions, many=True).data,
            'spending_velocity': self._calculate_spending_velocity(fund)
        })
    
    def _get_date_range(self, date_range_param):
        """Centralized date range calculation with caching"""
        cache_key = f"date_range_{date_range_param}"
        cached_range = cache.get(cache_key)
        if cached_range:
            return cached_range
            
        end_date = timezone.now().date()
        if date_range_param == 'last_3_months':
            start_date = end_date - timedelta(days=90)
        elif date_range_param == 'last_6_months':
            start_date = end_date - timedelta(days=180)
        elif date_range_param == 'current_year':
            start_date = end_date.replace(month=1, day=1)
        else:  # default to last_12_months
            start_date = end_date - timedelta(days=365)
            
        result = (start_date, end_date)
        cache.set(cache_key, result, timeout=3600)  # Cache for 1 hour
        return result
    
    def _get_optimized_monthly_summary(self, queryset, start_date, end_date):
        """Optimized monthly summary with single query"""
        cache_key = f"monthly_summary_{hashlib.md5(str(queryset.query).encode()).hexdigest()}_{start_date}_{end_date}"
        cached_data = cache.get(cache_key)
        if cached_data:
            return cached_data
            
        # Single optimized query with all needed data
        monthly_data = FinancialTransaction.objects.filter(
            fund__in=queryset,
            transaction_type='purchase',
            status='processed',
            transaction_date__gte=start_date,
            transaction_date__lte=end_date
        ).select_related('fund').values(
            'transaction_date__year',
            'transaction_date__month'
        ).annotate(
            total_spent=Sum('amount_in_fund_currency'),
            transaction_count=Count('id')
        ).order_by('transaction_date__year', 'transaction_date__month')
        
        # Get active funds count efficiently using a single query
        fund_activity = queryset.values('start_date', 'end_date', 'id')
        
        result = []
        for item in monthly_data:
            month_str = f"{item['transaction_date__year']}-{item['transaction_date__month']:02d}"
            month_date = datetime.strptime(month_str, '%Y-%m').date()
            
            # Count active funds for this month efficiently
            active_funds_count = sum(
                1 for fund in fund_activity 
                if fund['start_date'] <= month_date and fund['end_date'] >= month_date
            )
            
            result.append({
                'month': month_str,
                'total_spent': float(item['total_spent'] or 0),
                'transaction_count': item['transaction_count'],
                'active_funds': active_funds_count
            })
        
        cache.set(cache_key, result, timeout=1800)  # Cache for 30 minutes
        return result
        
    @action(detail=False, methods=['get'])
    @monitor_performance
    def financial_reports(self, request):
        """Generate comprehensive financial reports - Optimized"""
        # Optimize queryset with prefetching
        queryset = self.get_queryset().filter(status='active').select_related(
            'funding_agency', 'currency', 'principal_investigator'
        ).prefetch_related(
            Prefetch('transactions', 
                    queryset=FinancialTransaction.objects.select_related('fund')),
            'allocations__category'
        )
        
        date_range = request.query_params.get('range', 'last_12_months')
        start_date, end_date = self._get_date_range(date_range)
        
        # Use optimized monthly summary
        monthly_data = self._get_optimized_monthly_summary(queryset, start_date, end_date)
        
        # Optimized fund utilization analysis - avoid N+1 queries
        fund_utilization = [
            {
                'fund_name': fund.name,
                'fund_id': fund.fund_id,
                'utilization_rate': float(fund.utilization_rate),
                'total_budget': float(fund.total_budget),
                'spent_amount': float(fund.spent_amount),
                'days_remaining': fund.days_remaining
            }
            for fund in queryset  # queryset already optimized with select_related
        ]
        
        # Optimized agency performance analysis - single query
        agency_data = self._get_optimized_agency_performance(queryset)
        
        # Optimized expense categories analysis
        expense_categories = self._get_optimized_expense_categories(queryset)
        
        # Optimized upcoming deadlines
        deadline_threshold = timezone.now().date() + timedelta(days=120)
        upcoming_deadlines = [
            {
                'fund_name': fund.name,
                'fund_id': fund.fund_id,
                'end_date': fund.end_date.isoformat() if fund.end_date else None,
                'days_remaining': fund.days_remaining,
                'remaining_budget': float(fund.available_budget)
            }
            for fund in queryset.filter(end_date__lte=deadline_threshold).order_by('end_date')
        ]
        
        return Response({
            'monthly_summary': monthly_data,
            'fund_utilization': fund_utilization,
            'agency_performance': agency_data,
            'expense_categories': expense_categories,
            'upcoming_deadlines': upcoming_deadlines,
            'report_period': {
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat(),
                'range': date_range
            }
        })
    
    def _get_optimized_agency_performance(self, queryset):
        """Optimized agency performance calculation with single query"""
        cache_key = f"agency_performance_{hashlib.md5(str(queryset.query).encode()).hexdigest()}"
        cached_data = cache.get(cache_key)
        if cached_data:
            return cached_data
            
        # Single query to get all agency data
        agency_stats = queryset.values(
            'funding_agency__name'
        ).annotate(
            total_budget=Sum('total_budget'),
            total_spent=Sum('spent_amount'),
            fund_count=Count('id')
        ).order_by('-total_budget')
        
        agency_performance = []
        for stats in agency_stats:
            agency_name = stats['funding_agency__name'] or 'McGill University Internal Funding'
            total_budget = float(stats['total_budget'] or 0)
            total_spent = float(stats['total_spent'] or 0)
            avg_utilization = (total_spent / total_budget * 100) if total_budget > 0 else 0
            
            agency_performance.append({
                'agency_name': agency_name,
                'total_budget': total_budget,
                'total_spent': total_spent,
                'fund_count': stats['fund_count'],
                'avg_utilization': float(avg_utilization)
            })
        
        cache.set(cache_key, agency_performance, timeout=1800)  # Cache for 30 minutes
        return agency_performance
    
    def _get_optimized_expense_categories(self, queryset):
        """Optimized expense categories calculation"""
        cache_key = f"expense_categories_{hashlib.md5(str(queryset.query).encode()).hexdigest()}"
        cached_data = cache.get(cache_key)
        if cached_data:
            return cached_data
            
        # Single query with aggregation
        category_data = EnhancedBudgetAllocation.objects.filter(
            fund__in=queryset
        ).aggregate(
            total_allocated=Sum('spent_amount')
        )
        total_allocated = float(category_data['total_allocated'] or 0)
        
        category_spending = EnhancedBudgetAllocation.objects.filter(
            fund__in=queryset
        ).values('category__name').annotate(
            total_spent=Sum('spent_amount')
        ).order_by('-total_spent')
        
        expense_categories = [
            {
                'category': category['category__name'],
                'amount': float(category['total_spent'] or 0),
                'percentage': round(
                    (float(category['total_spent'] or 0) / total_allocated * 100) 
                    if total_allocated > 0 else 0, 1
                )
            }
            for category in category_spending
        ]
        
        cache.set(cache_key, expense_categories, timeout=1800)  # Cache for 30 minutes
        return expense_categories
    
    def _get_date_range_with_earliest_transaction(self, queryset, date_range_param):
        """Get date range considering earliest transaction for better data coverage"""
        cache_key = f"date_range_earliest_{date_range_param}_{hashlib.md5(str(queryset.query).encode()).hexdigest()}"
        cached_range = cache.get(cache_key)
        if cached_range:
            return cached_range
            
        end_date = timezone.now().date()
        
        if date_range_param == 'last_12_months':
            # Get earliest transaction for better coverage
            earliest_transaction = FinancialTransaction.objects.filter(
                fund__in=queryset,
                transaction_type='purchase',
                status='processed'
            ).order_by('transaction_date').first()
            
            if earliest_transaction:
                eighteen_months_ago = end_date - timedelta(days=550)
                start_date = min(earliest_transaction.transaction_date.date(), eighteen_months_ago)
            else:
                start_date = end_date - timedelta(days=365)
        else:
            start_date, _ = self._get_date_range(date_range_param)
            
        result = (start_date, end_date)
        cache.set(cache_key, result, timeout=3600)  # Cache for 1 hour
        return result

    @action(detail=False, methods=['get'])
    @monitor_performance
    def monthly_expenditure_report(self, request):
        """Generate monthly lab expenditure report - Optimized"""
        queryset = self.get_queryset().filter(status='active').select_related(
            'funding_agency', 'currency'
        )
        
        date_range = request.query_params.get('range', 'last_12_months')
        start_date, end_date = self._get_date_range_with_earliest_transaction(queryset, date_range)
        
        # Optimized monthly spending with single query and caching
        cache_key = f"monthly_expenditure_{hashlib.md5(str(queryset.query).encode()).hexdigest()}_{start_date}_{end_date}"
        cached_report = cache.get(cache_key)
        if cached_report:
            return Response(cached_report)
            
        # Get all transactions at once with select_related optimization
        all_transactions = FinancialTransaction.objects.filter(
            fund__in=queryset,
            transaction_type='purchase',
            status='processed',
            transaction_date__gte=start_date,
            transaction_date__lte=end_date
        ).select_related('fund').values(
            'transaction_date__year',
            'transaction_date__month', 
            'amount_in_fund_currency',
            'description',
            'vendor_name'
        )
        
        # Process all data in memory (more efficient than multiple DB queries)
        monthly_report = {}
        for trans in all_transactions:
            month = f"{trans['transaction_date__year']}-{trans['transaction_date__month']:02d}"
            
            if month not in monthly_report:
                monthly_report[month] = {
                    'month': month,
                    'total_spent': 0.0,
                    'transaction_count': 0,
                    'categories': {'Personnel': 0, 'Equipment': 0, 'Supplies': 0, 'Other': 0}
                }
            
            amount = float(trans['amount_in_fund_currency'])
            monthly_report[month]['total_spent'] += amount
            monthly_report[month]['transaction_count'] += 1
            
            # Categorize expenses efficiently
            desc_lower = (trans['description'] or '').lower()
            vendor_lower = (trans['vendor_name'] or '').lower()
            
            if any(keyword in desc_lower for keyword in ['salary', 'stipend', 'payroll', 'personnel']):
                monthly_report[month]['categories']['Personnel'] += amount
            elif any(keyword in desc_lower for keyword in ['equipment', 'instrument', 'microscope', 'cycler', 'machine']):
                monthly_report[month]['categories']['Equipment'] += amount
            elif any(keyword in desc_lower for keyword in ['reagent', 'chemical', 'media', 'supply', 'kit', 'consumable']) or \
                 any(vendor in vendor_lower for vendor in ['sigma', 'fisher', 'life technologies']):
                monthly_report[month]['categories']['Supplies'] += amount
            else:
                monthly_report[month]['categories']['Other'] += amount
        
        # Clean up categories with zero values
        for month_data in monthly_report.values():
            month_data['categories'] = {k: v for k, v in month_data['categories'].items() if v > 0}
        
        # Convert to list and add summary
        report_data = list(monthly_report.values())
        total_expenditure = sum(month['total_spent'] for month in report_data)
        
        result = {
            'report_type': 'Monthly Lab Expenditure',
            'period': {
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat(),
                'range': date_range
            },
            'summary': {
                'total_expenditure': total_expenditure,
                'months_covered': len(report_data),
                'average_monthly_spending': total_expenditure / len(report_data) if report_data else 0
            },
            'monthly_data': report_data
        }
        
        # Cache the result
        cache.set(cache_key, result, timeout=1800)  # Cache for 30 minutes
        return Response(result)

    @action(detail=False, methods=['get'])
    @monitor_performance
    def grant_utilization_report(self, request):
        """Generate grant utilization report - Optimized"""
        cache_key = f"grant_utilization_{request.user.id}"
        cached_report = cache.get(cache_key)
        if cached_report:
            return Response(cached_report)
            
        # Optimized queryset with all related data prefetched
        queryset = self.get_queryset().filter(status='active').select_related(
            'funding_agency', 'principal_investigator', 'currency'
        ).prefetch_related(
            Prefetch('allocations', 
                    queryset=EnhancedBudgetAllocation.objects.select_related('category')),
            Prefetch('transactions',
                    queryset=FinancialTransaction.objects.filter(
                        status='processed',
                        transaction_date__gte=timezone.now().date() - timedelta(days=90)
                    ))
        )
        
        grant_utilization = []
        ninety_days_ago = timezone.now().date() - timedelta(days=90)
        
        for fund in queryset:
            # Use prefetched data to avoid additional queries
            category_breakdown = [
                {
                    'category': allocation.category.name if allocation.category else 'Unspecified',
                    'allocated': float(allocation.allocated_amount),
                    'spent': float(allocation.spent_amount),
                    'committed': float(allocation.committed_amount),
                    'utilization': float(
                        (allocation.spent_amount / allocation.allocated_amount * 100) 
                        if allocation.allocated_amount > 0 else 0
                    )
                }
                for allocation in fund.allocations.all() if allocation.allocated_amount > 0
            ]
            
            # Calculate recent activity from prefetched transactions
            recent_transactions = [t for t in fund.transactions.all() if t.transaction_date >= ninety_days_ago]
            recent_spent = sum(float(t.amount_in_fund_currency) for t in recent_transactions)
            
            grant_data = {
                'fund_id': fund.fund_id,
                'fund_name': fund.name,
                'pi_name': fund.principal_investigator.username if fund.principal_investigator else 'N/A',
                'funding_agency': fund.funding_agency.name if fund.funding_agency else 'Internal',
                'total_budget': float(fund.total_budget),
                'spent_amount': float(fund.spent_amount),
                'committed_amount': float(fund.committed_amount),
                'available_budget': float(fund.available_budget),
                'utilization_rate': float(fund.utilization_rate),
                'days_remaining': fund.days_remaining,
                'start_date': fund.start_date.isoformat() if fund.start_date else None,
                'end_date': fund.end_date.isoformat() if fund.end_date else None,
                'category_breakdown': category_breakdown,
                'recent_activity': {
                    'last_90_days_spent': recent_spent,
                    'recent_transactions': len(recent_transactions)
                }
            }
            grant_utilization.append(grant_data)
        
        # Sort by utilization rate (highest first)
        grant_utilization.sort(key=lambda x: x['utilization_rate'], reverse=True)
        
        # Calculate summary statistics efficiently
        total_budget = sum(grant['total_budget'] for grant in grant_utilization)
        total_spent = sum(grant['spent_amount'] for grant in grant_utilization)
        avg_utilization = sum(grant['utilization_rate'] for grant in grant_utilization) / len(grant_utilization) if grant_utilization else 0
        high_util_count = sum(1 for g in grant_utilization if g['utilization_rate'] > 80)
        low_util_count = sum(1 for g in grant_utilization if g['utilization_rate'] < 50)
        
        result = {
            'report_type': 'Grant Utilization Report',
            'generated_at': timezone.now().isoformat(),
            'summary': {
                'total_grants': len(grant_utilization),
                'total_budget': total_budget,
                'total_spent': total_spent,
                'overall_utilization': (total_spent / total_budget * 100) if total_budget > 0 else 0,
                'average_utilization': avg_utilization,
                'high_utilization_grants': high_util_count,
                'low_utilization_grants': low_util_count
            },
            'grants': grant_utilization
        }
        
        # Cache the result
        cache.set(cache_key, result, timeout=1800)  # Cache for 30 minutes
        return Response(result)

    @action(detail=False, methods=['get'])
    @monitor_performance
    def deadline_alerts_report(self, request):
        """Generate grant deadline alerts report - Optimized"""
        cache_key = f"deadline_alerts_{request.user.id}"
        cached_report = cache.get(cache_key)
        if cached_report:
            return Response(cached_report)
            
        # Optimized queryset with select_related
        queryset = self.get_queryset().filter(
            status='active',
            end_date__isnull=False  # Only get funds with end dates
        ).select_related('funding_agency', 'principal_investigator')
        
        now = timezone.now().date()
        critical_deadlines = []
        warning_deadlines = []
        info_deadlines = []
        total_at_risk_budget = 0
        
        for fund in queryset:
            days_remaining = (fund.end_date - now).days
            
            # Skip expired funds
            if days_remaining < 0:
                continue
                
            deadline_info = {
                'fund_id': fund.fund_id,
                'fund_name': fund.name,
                'pi_name': fund.principal_investigator.username if fund.principal_investigator else 'N/A',
                'end_date': fund.end_date.isoformat(),
                'days_remaining': days_remaining,
                'remaining_budget': float(fund.available_budget),
                'utilization_rate': float(fund.utilization_rate),
                'funding_agency': fund.funding_agency.name if fund.funding_agency else 'Internal',
                'total_budget': float(fund.total_budget)
            }
            
            if days_remaining <= 30:
                deadline_info['urgency'] = 'critical'
                critical_deadlines.append(deadline_info)
                total_at_risk_budget += float(fund.available_budget)
            elif days_remaining <= 90:
                deadline_info['urgency'] = 'warning'
                warning_deadlines.append(deadline_info)
                total_at_risk_budget += float(fund.available_budget)
            elif days_remaining <= 180:
                deadline_info['urgency'] = 'info'
                info_deadlines.append(deadline_info)
        
        # Sort each category by days remaining (most urgent first)
        critical_deadlines.sort(key=lambda x: x['days_remaining'])
        warning_deadlines.sort(key=lambda x: x['days_remaining'])
        info_deadlines.sort(key=lambda x: x['days_remaining'])
        
        result = {
            'report_type': 'Grant Deadline Alerts',
            'generated_at': timezone.now().isoformat(),
            'summary': {
                'total_grants': len(queryset),
                'critical_alerts': len(critical_deadlines),
                'warning_alerts': len(warning_deadlines),
                'info_alerts': len(info_deadlines),
                'total_at_risk_budget': total_at_risk_budget
            },
            'alerts': {
                'critical': critical_deadlines,
                'warning': warning_deadlines,
                'information': info_deadlines
            },
            'thresholds': {
                'critical': '≤ 30 days',
                'warning': '31-90 days',
                'information': '91-180 days'
            }
        }
        
        # Cache the result
        cache.set(cache_key, result, timeout=1800)  # Cache for 30 minutes
        return Response(result)

    @action(detail=True, methods=['post'])
    def transfer_funds(self, request, pk=None):
        """资金转移"""
        source_fund = self.get_object()
        target_fund_id = request.data.get('target_fund_id')
        amount = Decimal(str(request.data.get('amount', 0)))
        reason = request.data.get('reason', '')
        
        if not target_fund_id or amount <= 0:
            return Response({'error': '无效的转移参数'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            target_fund = EnhancedFund.objects.get(fund_id=target_fund_id)
        except EnhancedFund.DoesNotExist:
            return Response({'error': '目标资金不存在'}, status=status.HTTP_404_NOT_FOUND)
        
        if not source_fund.can_spend(amount):
            return Response({'error': '源资金余额不足'}, status=status.HTTP_400_BAD_REQUEST)
        
        # 创建转出交易
        FinancialTransaction.objects.create(
            fund=source_fund,
            transaction_type='transfer_out',
            amount=amount,
            currency=source_fund.currency,
            amount_in_fund_currency=amount,
            description=f'转移至 {target_fund.name}',
            justification=reason,
            status='processed',
            created_by=request.user,
            processed_date=timezone.now()
        )
        
        # 创建转入交易
        FinancialTransaction.objects.create(
            fund=target_fund,
            transaction_type='transfer_in',
            amount=amount,
            currency=target_fund.currency,
            amount_in_fund_currency=amount,  # 简化处理，实际应考虑汇率
            description=f'从 {source_fund.name} 转入',
            justification=reason,
            status='processed',
            created_by=request.user,
            processed_date=timezone.now()
        )
        
        # 更新资金余额
        source_fund.spent_amount += amount
        source_fund.save()
        
        target_fund.spent_amount -= amount  # 转入相当于减少支出
        target_fund.save()
        
        return Response({'message': '资金转移成功'})
    
    @action(detail=False, methods=['get'])
    def grant_utilization_report(self, request):
        """Generate grant utilization report for biology lab"""
        queryset = self.get_queryset().filter(status='active')
        
        # Summary statistics
        total_grants = queryset.count()
        total_budget = queryset.aggregate(total=Sum('total_budget'))['total'] or 0
        total_spent = queryset.aggregate(total=Sum('spent_amount'))['total'] or 0
        overall_utilization = (total_spent / total_budget * 100) if total_budget > 0 else 0
        high_utilization_grants = queryset.filter(spent_amount__gte=F('total_budget') * 0.8).count()
        
        # Detailed grant information
        grants_data = []
        # Can't order by property, so we'll sort in Python after getting the data
        funds_list = list(queryset)
        funds_list.sort(key=lambda f: f.utilization_rate, reverse=True)
        
        for fund in funds_list:
            # Get category breakdown if available
            category_breakdown = []
            allocations = EnhancedBudgetAllocation.objects.filter(fund=fund)
            for allocation in allocations:
                if allocation.allocated_amount > 0:
                    category_breakdown.append({
                        'category': allocation.category.name if allocation.category else 'Unspecified',
                        'allocated': float(allocation.allocated_amount),
                        'spent': float(allocation.spent_amount),
                        'utilization': float((allocation.spent_amount / allocation.allocated_amount * 100) if allocation.allocated_amount > 0 else 0)
                    })
            
            # Recent activity analysis
            ninety_days_ago = timezone.now().date() - timedelta(days=90)
            recent_transactions = FinancialTransaction.objects.filter(
                fund=fund,
                transaction_type='purchase',
                status='processed',
                transaction_date__gte=ninety_days_ago
            )
            recent_spent = recent_transactions.aggregate(total=Sum('amount_in_fund_currency'))['total'] or 0
            recent_count = recent_transactions.count()
            
            grants_data.append({
                'fund_id': fund.fund_id,
                'fund_name': fund.name,
                'pi_name': fund.principal_investigator.get_full_name() if fund.principal_investigator else 'Not assigned',
                'funding_agency': fund.funding_agency.name if fund.funding_agency else 'Internal',
                'total_budget': float(fund.total_budget),
                'spent_amount': float(fund.spent_amount),
                'available_budget': float(fund.available_budget),
                'utilization_rate': float(fund.utilization_rate),
                'days_remaining': fund.days_remaining,
                'start_date': fund.start_date.isoformat() if fund.start_date else None,
                'end_date': fund.end_date.isoformat() if fund.end_date else None,
                'category_breakdown': category_breakdown,
                'recent_activity': {
                    'last_90_days_spent': float(recent_spent),
                    'recent_transactions': recent_count
                }
            })
        
        return Response({
            'summary': {
                'total_grants': total_grants,
                'total_budget': float(total_budget),
                'overall_utilization': float(overall_utilization),
                'high_utilization_grants': high_utilization_grants
            },
            'grants': grants_data,
            'generated_at': timezone.now().isoformat()
        })
    
    
    def _get_monthly_spending_trend(self, queryset):
        """Get monthly spending trend for biology lab analysis"""
        # Get the earliest transaction date from our data to ensure we capture all data
        earliest_transaction = FinancialTransaction.objects.filter(
            fund__in=queryset,
            transaction_type='purchase',
            status='processed'
        ).order_by('transaction_date').first()
        
        if earliest_transaction:
            # Use 18 months ago or the earliest transaction date, whichever is more recent
            eighteen_months_ago = timezone.now() - timedelta(days=550)
            start_date = min(earliest_transaction.transaction_date, eighteen_months_ago)
        else:
            # Fallback to 18 months ago
            start_date = timezone.now() - timedelta(days=550)
        
        # Use Django's built-in date grouping which is more reliable
        monthly_data = FinancialTransaction.objects.filter(
            fund__in=queryset,
            transaction_type='purchase',
            status='processed',
            transaction_date__gte=start_date
        ).values(
            'transaction_date__year',
            'transaction_date__month'
        ).annotate(
            total_spent=Sum('amount_in_fund_currency'),
            transaction_count=Count('id')
        ).order_by('transaction_date__year', 'transaction_date__month')
        
        # Convert to the expected format
        formatted_data = []
        for item in monthly_data:
            month_str = f"{item['transaction_date__year']}-{item['transaction_date__month']:02d}"
            formatted_data.append({
                'month': month_str,
                'total_spent': float(item['total_spent'] or 0),
                'transaction_count': item['transaction_count']
            })
        
        return formatted_data
    
    def _calculate_risk_score(self, fund):
        """计算资金风险评分"""
        risk_score = 0.0
        
        # 预算使用率风险
        utilization = fund.utilization_rate
        if utilization > 95:
            risk_score += 0.4
        elif utilization > 80:
            risk_score += 0.2
        
        # 时间风险
        if fund.days_remaining < 30:
            risk_score += 0.3
        elif fund.days_remaining < 90:
            risk_score += 0.1
        
        # 承诺率风险
        commitment_rate = fund.commitment_rate
        if commitment_rate > 90:
            risk_score += 0.2
        
        # 支出速度风险
        velocity = self._calculate_spending_velocity(fund)
        if velocity > 1.5:  # 支出速度过快
            risk_score += 0.1
        
        return min(risk_score, 1.0)
    
    def _identify_risk_factors(self, fund):
        """识别风险因素"""
        factors = []
        
        if fund.utilization_rate > 95:
            factors.append('预算使用率过高')
        if fund.days_remaining < 30:
            factors.append('即将到期')
        if fund.commitment_rate > 90:
            factors.append('承诺金额过高')
        
        return factors
    
    def _generate_budget_recommendations(self, queryset):
        """生成预算建议"""
        recommendations = []
        
        # 分析高风险资金
        high_risk_funds = [f for f in queryset if self._calculate_risk_score(f) > 0.7]
        if high_risk_funds:
            recommendations.append({
                'type': 'warning',
                'title': '高风险资金预警',
                'message': f'有 {len(high_risk_funds)} 个资金项目存在高风险，需要重点关注'
            })
        
        # 分析低使用率资金
        low_utilization_funds = [f for f in queryset if f.utilization_rate < 30 and f.days_remaining < 180]
        if low_utilization_funds:
            recommendations.append({
                'type': 'info',
                'title': '资金使用率偏低',
                'message': f'有 {len(low_utilization_funds)} 个资金项目使用率较低，建议加快执行'
            })
        
        return recommendations
    
    def _get_historical_spending(self, fund, months):
        """获取历史支出数据"""
        start_date = timezone.now() - timedelta(days=months * 30)
        
        return FinancialTransaction.objects.filter(
            fund=fund,
            transaction_type='purchase',
            status='processed',
            transaction_date__gte=start_date
        ).extra(
            select={'month': "TO_CHAR(transaction_date, 'YYYY-MM')"}
        ).values('month').annotate(
            total_spent=Sum('amount_in_fund_currency')
        ).order_by('month')
    
    def _generate_spending_forecast(self, historical_data, forecast_months):
        """生成支出预测"""
        # 简化的线性预测模型
        if not historical_data:
            return {'spending': {}, 'commitments': {}}
        
        # 计算平均月支出
        total_spent = sum(item['total_spent'] for item in historical_data)
        avg_monthly_spending = total_spent / len(historical_data)
        
        # 生成未来预测
        forecast_spending = {}
        current_date = timezone.now().date()
        
        for i in range(forecast_months):
            month_date = current_date + timedelta(days=i * 30)
            month_key = month_date.strftime('%Y-%m')
            forecast_spending[month_key] = float(avg_monthly_spending)
        
        return {
            'spending': forecast_spending,
            'commitments': {}  # 简化处理
        }
    
    def _get_fund_monthly_trend(self, fund):
        """获取资金月度趋势"""
        six_months_ago = timezone.now() - timedelta(days=180)
        
        return fund.transactions.filter(
            status='processed',
            transaction_date__gte=six_months_ago
        ).extra(
            select={'month': "TO_CHAR(transaction_date, 'YYYY-MM')"}
        ).values('month').annotate(
            total_amount=Sum('amount_in_fund_currency'),
            transaction_count=Count('id')
        ).order_by('month')
    
    def _calculate_spending_velocity(self, fund):
        """计算支出速度"""
        if fund.days_remaining <= 0:
            return 0
        
        daily_budget = float(fund.available_budget) / fund.days_remaining
        
        # 计算最近30天的日均支出
        thirty_days_ago = timezone.now() - timedelta(days=30)
        recent_spending = fund.transactions.filter(
            transaction_type='purchase',
            status='processed',
            transaction_date__gte=thirty_days_ago
        ).aggregate(total=Sum('amount_in_fund_currency'))['total'] or 0
        
        daily_spending = float(recent_spending) / 30
        
        return daily_spending / daily_budget if daily_budget > 0 else 0


class FinancialTransactionViewSet(viewsets.ModelViewSet):
    """财务交易管理视图集"""
    queryset = FinancialTransaction.objects.all()
    serializer_class = FinancialTransactionSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['transaction_id', 'description', 'vendor_name']
    ordering_fields = ['transaction_date', 'amount', 'status']
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # 根据用户权限过滤
        user = self.request.user
        if not user.is_superuser:
            queryset = queryset.filter(
                Q(fund__principal_investigator=user) |
                Q(fund__co_investigators=user) |
                Q(created_by=user)
            ).distinct()
        
        return queryset
    
    @action(detail=False, methods=['get'])
    def pending_approvals(self, request):
        """待审批交易"""
        pending_transactions = self.get_queryset().filter(
            status='pending'
        ).order_by('-created_at')
        
        serializer = self.get_serializer(pending_transactions, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """审批交易"""
        transaction = self.get_object()
        
        if transaction.status != 'pending':
            return Response({'error': '交易状态不允许审批'}, status=status.HTTP_400_BAD_REQUEST)
        
        # 检查资金是否足够
        if not transaction.fund.can_spend(transaction.amount_in_fund_currency):
            return Response({'error': '资金余额不足'}, status=status.HTTP_400_BAD_REQUEST)
        
        transaction.status = 'approved'
        transaction.approved_by = request.user
        transaction.approved_at = timezone.now()
        transaction.save()
        
        return Response({'message': '交易已审批'})
    
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """拒绝交易"""
        transaction = self.get_object()
        reason = request.data.get('reason', '')
        
        if transaction.status != 'pending':
            return Response({'error': '交易状态不允许拒绝'}, status=status.HTTP_400_BAD_REQUEST)
        
        transaction.status = 'rejected'
        transaction.notes = f"拒绝原因: {reason}"
        transaction.save()
        
        return Response({'message': '交易已拒绝'})


class BudgetForecastViewSet(viewsets.ModelViewSet):
    """预算预测管理视图集"""
    queryset = BudgetForecast.objects.all()
    serializer_class = BudgetForecastSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['fund']
    ordering = ['-forecast_date']
    
    @action(detail=True, methods=['post'])
    def update_accuracy(self, request, pk=None):
        """更新预测准确性"""
        forecast = self.get_object()
        actual_data = request.data.get('actual_data', {})
        
        # 计算准确性评分
        accuracy_score = self._calculate_forecast_accuracy(forecast, actual_data)
        forecast.accuracy_score = accuracy_score
        forecast.save()
        
        return Response({'accuracy_score': accuracy_score})
    
    def _calculate_forecast_accuracy(self, forecast, actual_data):
        """计算预测准确性评分"""
        # 简化的准确性计算
        predicted = forecast.projected_spending
        total_error = 0
        count = 0
        
        for month, predicted_amount in predicted.items():
            if month in actual_data:
                actual_amount = actual_data[month]
                error = abs(predicted_amount - actual_amount) / max(actual_amount, 1)
                total_error += error
                count += 1
        
        if count == 0:
            return 0
        
        avg_error = total_error / count
        accuracy = max(0, 100 - (avg_error * 100))
        return round(accuracy, 2)


class FinancialAlertViewSet(viewsets.ReadOnlyModelViewSet):
    """财务预警管理视图集"""
    queryset = FinancialAlert.objects.all()
    serializer_class = FinancialAlertSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['alert_type', 'severity', 'is_active']
    ordering = ['-created_at']
    
    @action(detail=False, methods=['get'])
    def active_alerts(self, request):
        """获取活跃预警"""
        alerts = self.get_queryset().filter(
            is_active=True,
            is_acknowledged=False
        ).order_by('-severity', '-created_at')
        
        serializer = self.get_serializer(alerts, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def acknowledge(self, request, pk=None):
        """确认预警"""
        alert = self.get_object()
        alert.is_acknowledged = True
        alert.acknowledged_by = request.user
        alert.acknowledged_at = timezone.now()
        alert.save()
        
        return Response({'message': '预警已确认'})
    
    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        """解决预警"""
        alert = self.get_object()
        alert.is_active = False
        alert.resolved_at = timezone.now()
        alert.save()
        
        return Response({'message': '预警已解决'})


class CurrencyViewSet(viewsets.ReadOnlyModelViewSet):
    """货币管理视图集"""
    queryset = Currency.objects.filter(is_active=True)
    
    @action(detail=False, methods=['post'])
    def update_exchange_rates(self, request):
        """更新汇率"""
        # 这里应该集成外部汇率API
        rates = request.data.get('rates', {})
        
        updated_count = 0
        for currency_code, rate in rates.items():
            try:
                currency = Currency.objects.get(code=currency_code)
                currency.exchange_rate_to_cad = Decimal(str(rate))
                currency.save()
                updated_count += 1
            except Currency.DoesNotExist:
                continue
        
        return Response({'message': f'已更新 {updated_count} 个货币汇率'})


class FundingAgencyViewSet(viewsets.ModelViewSet):
    """资助机构管理视图集"""
    queryset = FundingAgency.objects.filter(is_active=True)
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    search_fields = ['name', 'agency_type']
    filterset_fields = ['agency_type']


class CostCenterViewSet(viewsets.ModelViewSet):
    """成本中心管理视图集"""
    queryset = CostCenter.objects.filter(is_active=True)
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    search_fields = ['code', 'name', 'department']
    filterset_fields = ['department', 'manager']
