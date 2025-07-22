from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Fund, Transaction, BudgetAllocation, FundingReport


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