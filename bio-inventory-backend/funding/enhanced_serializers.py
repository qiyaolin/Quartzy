from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    EnhancedFund, BudgetCategory, EnhancedBudgetAllocation,
    FinancialTransaction, BudgetForecast, FinancialAlert,
    Currency, FundingAgency, CostCenter
)

class CurrencySerializer(serializers.ModelSerializer):
    class Meta:
        model = Currency
        fields = '__all__'

class FundingAgencySerializer(serializers.ModelSerializer):
    class Meta:
        model = FundingAgency
        fields = '__all__'

class CostCenterSerializer(serializers.ModelSerializer):
    manager_name = serializers.CharField(source='manager.username', read_only=True)
    
    class Meta:
        model = CostCenter
        fields = '__all__'

class BudgetCategorySerializer(serializers.ModelSerializer):
    parent_name = serializers.CharField(source='parent.name', read_only=True)
    
    class Meta:
        model = BudgetCategory
        fields = '__all__'

class EnhancedBudgetAllocationSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_code = serializers.CharField(source='category.code', read_only=True)
    fund_name = serializers.CharField(source='fund.name', read_only=True)
    available_amount = serializers.ReadOnlyField()
    utilization_percentage = serializers.SerializerMethodField()
    approved_by_name = serializers.CharField(source='approved_by.username', read_only=True)
    
    class Meta:
        model = EnhancedBudgetAllocation
        fields = '__all__'
        read_only_fields = ('approved_at', 'created_at', 'updated_at')
    
    def get_utilization_percentage(self, obj):
        if obj.allocated_amount > 0:
            return round((obj.spent_amount / obj.allocated_amount) * 100, 2)
        return 0

class EnhancedFundSerializer(serializers.ModelSerializer):
    currency_name = serializers.CharField(source='currency.name', read_only=True)
    currency_symbol = serializers.CharField(source='currency.symbol', read_only=True)
    funding_agency_name = serializers.CharField(source='funding_agency.name', read_only=True)
    cost_center_name = serializers.CharField(source='cost_center.name', read_only=True)
    pi_name = serializers.SerializerMethodField()
    pi_full_name = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    
    # 计算字段
    available_budget = serializers.ReadOnlyField()
    utilization_rate = serializers.ReadOnlyField()
    commitment_rate = serializers.ReadOnlyField()
    days_remaining = serializers.ReadOnlyField()
    is_expiring_soon = serializers.ReadOnlyField()
    
    # 关联数据
    allocations = EnhancedBudgetAllocationSerializer(many=True, read_only=True)
    recent_transactions = serializers.SerializerMethodField()
    alert_count = serializers.SerializerMethodField()
    
    class Meta:
        model = EnhancedFund
        fields = '__all__'
        read_only_fields = ('fund_id', 'created_at', 'updated_at', 'created_by')
    
    def get_recent_transactions(self, obj):
        recent = obj.transactions.filter(status='processed').order_by('-transaction_date')[:5]
        return FinancialTransactionSerializer(recent, many=True).data
    
    def get_alert_count(self, obj):
        return obj.alerts.filter(is_active=True, is_acknowledged=False).count()
    
    def get_pi_name(self, obj):
        """Get PI display name"""
        if obj.principal_investigator:
            return obj.principal_investigator.username
        return 'N/A'
    
    def get_pi_full_name(self, obj):
        """Get PI full name for biology lab display"""
        if obj.principal_investigator:
            first_name = obj.principal_investigator.first_name or ''
            last_name = obj.principal_investigator.last_name or ''
            if first_name and last_name:
                return f"Dr. {first_name} {last_name}"
            return obj.principal_investigator.username
        return 'N/A'

class FinancialTransactionSerializer(serializers.ModelSerializer):
    fund_name = serializers.CharField(source='fund.name', read_only=True)
    fund_id = serializers.CharField(source='fund.fund_id', read_only=True)
    currency_symbol = serializers.CharField(source='currency.symbol', read_only=True)
    allocation_category = serializers.CharField(source='allocation.category.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.username', read_only=True)
    
    class Meta:
        model = FinancialTransaction
        fields = '__all__'
        read_only_fields = ('transaction_id', 'created_at', 'updated_at', 'approved_at', 'processed_date')

class BudgetForecastSerializer(serializers.ModelSerializer):
    fund_name = serializers.CharField(source='fund.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    
    class Meta:
        model = BudgetForecast
        fields = '__all__'
        read_only_fields = ('created_at',)

class FinancialAlertSerializer(serializers.ModelSerializer):
    fund_name = serializers.CharField(source='fund.name', read_only=True)
    fund_id = serializers.CharField(source='fund.fund_id', read_only=True)
    acknowledged_by_name = serializers.CharField(source='acknowledged_by.username', read_only=True)
    
    class Meta:
        model = FinancialAlert
        fields = '__all__'
        read_only_fields = ('created_at', 'acknowledged_at', 'resolved_at')

class FundSummarySerializer(serializers.Serializer):
    """资金汇总序列化器"""
    total_funds = serializers.IntegerField()
    active_funds = serializers.IntegerField()
    total_budget = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_spent = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_committed = serializers.DecimalField(max_digits=15, decimal_places=2)
    available_budget = serializers.DecimalField(max_digits=15, decimal_places=2)
    overall_utilization = serializers.DecimalField(max_digits=5, decimal_places=2)
    expiring_funds = serializers.IntegerField()
    high_risk_funds = serializers.IntegerField()

class SpendingAnalysisSerializer(serializers.Serializer):
    """支出分析序列化器"""
    category_breakdown = serializers.ListField()
    monthly_trend = serializers.ListField()
    top_vendors = serializers.ListField()
    spending_velocity = serializers.DecimalField(max_digits=10, decimal_places=2)
    large_transactions = FinancialTransactionSerializer(many=True)

class BudgetRecommendationSerializer(serializers.Serializer):
    """预算建议序列化器"""
    type = serializers.CharField()
    title = serializers.CharField()
    message = serializers.CharField()
    priority = serializers.CharField(default='medium')
    action_required = serializers.BooleanField(default=False)