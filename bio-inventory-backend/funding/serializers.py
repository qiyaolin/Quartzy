from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Fund, Transaction, BudgetAllocation, FundingReport, PersonnelExpense


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email']


class FundSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    remaining_budget = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    utilization_percentage = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)

    class Meta:
        model = Fund
        fields = [
            'id', 'name', 'description', 'total_budget', 'spent_amount',
            'funding_source', 'grant_number', 'principal_investigator',
            'start_date', 'end_date', 'notes', 'is_archived',
            'created_at', 'updated_at', 'created_by',
            'remaining_budget', 'utilization_percentage'
        ]
        read_only_fields = ['spent_amount', 'created_at', 'updated_at', 'created_by']

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class TransactionSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    fund = FundSerializer(read_only=True)
    fund_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = Transaction
        fields = [
            'id', 'fund', 'fund_id', 'amount', 'transaction_type',
            'item_name', 'description', 'request_id', 'reference_number',
            'transaction_date', 'created_by'
        ]
        read_only_fields = ['transaction_date', 'created_by']

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

    class Meta:
        model = FundingReport
        fields = [
            'id', 'title', 'report_type', 'start_date', 'end_date',
            'funds', 'fund_ids', 'summary_data', 'generated_at', 'generated_by'
        ]
        read_only_fields = ['summary_data', 'generated_at', 'generated_by']

    def create(self, validated_data):
        fund_ids = validated_data.pop('fund_ids', [])
        validated_data['generated_by'] = self.context['request'].user
        
        report = super().create(validated_data)
        
        if fund_ids:
            report.funds.set(fund_ids)
        
        return report


class BudgetSummarySerializer(serializers.Serializer):
    total_budget = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_spent = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_remaining = serializers.DecimalField(max_digits=15, decimal_places=2)
    fund_count = serializers.IntegerField()
    active_fund_count = serializers.IntegerField()
    average_utilization = serializers.DecimalField(max_digits=5, decimal_places=2)
    funds_near_limit = serializers.IntegerField()
    funds_over_budget = serializers.IntegerField()


class PersonnelExpenseSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    approved_by = UserSerializer(read_only=True)
    employee = UserSerializer(read_only=True)
    fund = FundSerializer(read_only=True)
    fund_id = serializers.IntegerField(write_only=True)
    employee_id = serializers.IntegerField(write_only=True, source='employee', required=False)

    class Meta:
        model = PersonnelExpense
        fields = [
            'id', 'fund', 'fund_id', 'employee', 'employee_id', 'employee_name', 'expense_type', 'amount',
            'expense_date', 'description', 'reference_number', 'is_approved',
            'approved_by', 'approved_at', 'notes', 'created_by', 'created_at', 'updated_at'
        ]
        read_only_fields = ['approved_by', 'approved_at', 'created_by', 'created_at', 'updated_at']

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        
        # Convert employee_id to User object if provided
        if 'employee' in validated_data and validated_data['employee']:
            employee_id = validated_data['employee']
            try:
                from django.contrib.auth.models import User
                employee = User.objects.get(id=employee_id)
                validated_data['employee'] = employee  # Replace ID with User object
                
                # Auto-generate employee_name if not provided
                if not validated_data.get('employee_name'):
                    if employee.first_name and employee.last_name:
                        validated_data['employee_name'] = f"{employee.first_name} {employee.last_name}"
                    else:
                        validated_data['employee_name'] = employee.username
            except User.DoesNotExist:
                # Remove invalid employee_id to let model validation handle it
                validated_data.pop('employee', None)
        
        return super().create(validated_data)