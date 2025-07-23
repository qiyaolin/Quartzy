from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Fund, Transaction, BudgetAllocation, FundingReport, FundCarryOver


class NullableDateField(serializers.DateField):
    """Custom DateField that converts empty strings to None"""
    def to_internal_value(self, value):
        if value == '' or value is None:
            return None
        return super().to_internal_value(value)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email']


class FundSerializer(serializers.ModelSerializer):
    # Updated serializer to include new fields for tri-agency and multi-year tracking
    created_by = UserSerializer(read_only=True)
    remaining_budget = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    utilization_percentage = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)
    current_fiscal_year = serializers.SerializerMethodField()
    current_year_budget = serializers.SerializerMethodField()
    current_year_spending = serializers.SerializerMethodField()
    
    # Override date fields to handle empty strings
    start_date = NullableDateField(required=False, allow_null=True)
    end_date = NullableDateField(required=False, allow_null=True)
    
    # Explicitly define funding_agency and grant_duration_years as writable
    funding_agency = serializers.CharField(required=False)
    grant_duration_years = serializers.IntegerField(required=False)

    class Meta:
        model = Fund
        fields = [
            'id', 'name', 'description', 'total_budget', 'spent_amount',
            'funding_source', 'funding_agency', 'grant_number', 'principal_investigator',
            'start_date', 'end_date', 'grant_duration_years', 'current_year', 'annual_budgets',
            'notes', 'is_archived', 'created_at', 'updated_at', 'created_by',
            'remaining_budget', 'utilization_percentage', 'current_fiscal_year',
            'current_year_budget', 'current_year_spending'
        ]
        read_only_fields = ['spent_amount', 'created_at', 'updated_at', 'created_by']
    
    def get_current_fiscal_year(self, obj):
        return obj.get_current_fiscal_year()
    
    def get_current_year_budget(self, obj):
        return obj.get_annual_budget()
    
    def get_current_year_spending(self, obj):
        return obj.get_spending_by_fiscal_year(obj.get_current_fiscal_year())

    def to_internal_value(self, data):
        # Clean up empty strings before validation
        if isinstance(data, dict):
            cleaned_data = data.copy()
            
            # Convert empty strings to None for optional fields
            optional_fields = ['description', 'funding_source', 'grant_number', 
                              'principal_investigator', 'notes', 'start_date', 'end_date']
            for field in optional_fields:
                if field in cleaned_data and cleaned_data[field] == '':
                    cleaned_data[field] = None
                    
            # Ensure annual_budgets has a default value if not provided or empty
            if 'annual_budgets' not in cleaned_data or cleaned_data['annual_budgets'] in [None, '']:
                cleaned_data['annual_budgets'] = {}
                
            return super().to_internal_value(cleaned_data)
        return super().to_internal_value(data)

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class TransactionSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    fund = FundSerializer(read_only=True)
    fund_id = serializers.IntegerField(write_only=True)
    cost_type_display = serializers.CharField(source='get_cost_type_display', read_only=True)
    expense_category_display = serializers.CharField(source='get_expense_category_display', read_only=True)

    class Meta:
        model = Transaction
        fields = [
            'id', 'fund', 'fund_id', 'amount', 'transaction_type', 'cost_type', 'expense_category',
            'cost_type_display', 'expense_category_display', 'fiscal_year',
            'item_name', 'description', 'request_id', 'reference_number',
            'invoice_number', 'vendor', 'transaction_date', 'created_by'
        ]
        read_only_fields = ['transaction_date', 'created_by', 'fiscal_year']

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class BudgetAllocationSerializer(serializers.ModelSerializer):
    remaining_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    utilization_percentage = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)

    class Meta:
        model = BudgetAllocation
        fields = [
            'id', 'fund', 'category', 'allocated_amount', 'spent_amount',
            'description', 'created_at', 'updated_at',
            'remaining_amount', 'utilization_percentage'
        ]
        read_only_fields = ['spent_amount', 'created_at', 'updated_at']


class FundingReportSerializer(serializers.ModelSerializer):
    generated_by = UserSerializer(read_only=True)
    funds = FundSerializer(many=True, read_only=True)
    fund_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False
    )
    report_type_display = serializers.CharField(source='get_report_type_display', read_only=True)

    class Meta:
        model = FundingReport
        fields = [
            'id', 'title', 'report_type', 'report_type_display', 'start_date', 'end_date',
            'fiscal_year', 'funds', 'fund_ids', 'summary_data', 'is_tri_agency_compliant',
            'generated_at', 'generated_by'
        ]
        read_only_fields = ['summary_data', 'generated_at', 'generated_by', 'fiscal_year', 'is_tri_agency_compliant']

    def create(self, validated_data):
        fund_ids = validated_data.pop('fund_ids', [])
        validated_data['generated_by'] = self.context['request'].user
        
        report = super().create(validated_data)
        
        if fund_ids:
            report.funds.set(fund_ids)
        
        # Generate Form 300 data for tri-agency reports
        if report.report_type in ['form300', 'tri_agency_annual']:
            report.summary_data = report.generate_form300_data()
            report.save()
        
        return report


class FundCarryOverSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    approved_by = UserSerializer(read_only=True)
    fund = FundSerializer(read_only=True)
    fund_id = serializers.IntegerField(write_only=True)
    carryover_percentage = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)

    class Meta:
        model = FundCarryOver
        fields = [
            'id', 'fund', 'fund_id', 'from_fiscal_year', 'to_fiscal_year',
            'carryover_amount', 'original_budget', 'spent_amount', 'carryover_percentage',
            'is_approved', 'approved_by', 'approved_at', 'is_processed', 'processed_at',
            'notes', 'created_at', 'created_by'
        ]
        read_only_fields = [
            'is_processed', 'processed_at', 'approved_by', 'approved_at',
            'created_at', 'created_by'
        ]

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class BudgetSummarySerializer(serializers.Serializer):
    total_budget = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_spent = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_remaining = serializers.DecimalField(max_digits=15, decimal_places=2)
    fund_count = serializers.IntegerField()
    active_fund_count = serializers.IntegerField()
    average_utilization = serializers.DecimalField(max_digits=5, decimal_places=2)
    funds_near_limit = serializers.IntegerField()
    funds_over_budget = serializers.IntegerField()
    
    # New Tri-Agency specific metrics
    total_direct_costs = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_indirect_costs = serializers.DecimalField(max_digits=15, decimal_places=2)
    tri_agency_funds_count = serializers.IntegerField()
    pending_carryovers = serializers.IntegerField()