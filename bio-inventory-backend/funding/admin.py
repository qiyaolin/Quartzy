from django.contrib import admin
from .models import Fund, Transaction, BudgetAllocation, FundingReport, FundCarryOver


@admin.register(Fund)
class FundAdmin(admin.ModelAdmin):
    list_display = [
        'name', 'total_budget', 'spent_amount', 'remaining_budget',
        'utilization_percentage', 'funding_agency', 'funding_source', 'is_archived', 'created_at'
    ]
    list_filter = ['is_archived', 'funding_agency', 'funding_source', 'created_at', 'start_date', 'end_date']
    search_fields = ['name', 'description', 'funding_source', 'principal_investigator', 'grant_number']
    readonly_fields = ['spent_amount', 'remaining_budget', 'utilization_percentage', 'created_at', 'updated_at']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'description', 'total_budget', 'spent_amount')
        }),
        ('Funding Source', {
            'fields': ('funding_agency', 'funding_source', 'grant_number', 'principal_investigator')
        }),
        ('Multi-year Grant Management', {
            'fields': ('grant_duration_years', 'current_year', 'annual_budgets')
        }),
        ('Timeline', {
            'fields': ('start_date', 'end_date')
        }),
        ('Additional Information', {
            'fields': ('notes', 'is_archived')
        }),
        ('Metadata', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )

    def remaining_budget(self, obj):
        return f"${obj.remaining_budget:,.2f}"
    remaining_budget.short_description = 'Remaining Budget'

    def utilization_percentage(self, obj):
        return f"{obj.utilization_percentage:.1f}%"
    utilization_percentage.short_description = 'Utilization %'


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = [
        'fund', 'amount', 'transaction_type', 'cost_type', 'expense_category',
        'fiscal_year', 'item_name', 'transaction_date', 'created_by'
    ]
    list_filter = ['transaction_type', 'cost_type', 'expense_category', 'fiscal_year', 'transaction_date', 'fund']
    search_fields = ['fund__name', 'item_name', 'description', 'reference_number', 'invoice_number', 'vendor']
    readonly_fields = ['transaction_date', 'fiscal_year']
    
    fieldsets = (
        ('Transaction Details', {
            'fields': ('fund', 'amount', 'transaction_type', 'cost_type', 'expense_category')
        }),
        ('Item Information', {
            'fields': ('item_name', 'description', 'request_id', 'reference_number')
        }),
        ('Audit Trail', {
            'fields': ('invoice_number', 'vendor', 'fiscal_year')
        }),
        ('Metadata', {
            'fields': ('created_by', 'transaction_date'),
            'classes': ('collapse',)
        })
    )


@admin.register(BudgetAllocation)
class BudgetAllocationAdmin(admin.ModelAdmin):
    list_display = [
        'fund', 'category', 'allocated_amount', 'spent_amount', 
        'remaining_amount', 'utilization_percentage'
    ]
    list_filter = ['category', 'fund']
    search_fields = ['fund__name', 'category', 'description']
    readonly_fields = ['spent_amount', 'remaining_amount', 'utilization_percentage', 'created_at', 'updated_at']

    def remaining_amount(self, obj):
        return f"${obj.remaining_amount:,.2f}"
    remaining_amount.short_description = 'Remaining Amount'

    def utilization_percentage(self, obj):
        return f"{obj.utilization_percentage:.1f}%"
    utilization_percentage.short_description = 'Utilization %'


@admin.register(FundingReport)
class FundingReportAdmin(admin.ModelAdmin):
    list_display = ['title', 'report_type', 'fiscal_year', 'is_tri_agency_compliant', 'start_date', 'end_date', 'generated_at', 'generated_by']
    list_filter = ['report_type', 'is_tri_agency_compliant', 'fiscal_year', 'generated_at']
    search_fields = ['title']
    readonly_fields = ['summary_data', 'fiscal_year', 'is_tri_agency_compliant', 'generated_at', 'generated_by']
    filter_horizontal = ['funds']


@admin.register(FundCarryOver)
class FundCarryOverAdmin(admin.ModelAdmin):
    list_display = [
        'fund', 'carryover_amount', 'from_fiscal_year', 'to_fiscal_year',
        'carryover_percentage', 'is_approved', 'is_processed', 'created_at'
    ]
    list_filter = ['is_approved', 'is_processed', 'from_fiscal_year', 'to_fiscal_year', 'fund']
    search_fields = ['fund__name', 'notes']
    readonly_fields = ['carryover_percentage', 'created_at', 'approved_at', 'processed_at']
    
    fieldsets = (
        ('Carry-over Details', {
            'fields': ('fund', 'from_fiscal_year', 'to_fiscal_year', 'carryover_amount')
        }),
        ('Budget Information', {
            'fields': ('original_budget', 'spent_amount', 'carryover_percentage')
        }),
        ('Approval Status', {
            'fields': ('is_approved', 'approved_by', 'approved_at')
        }),
        ('Processing Status', {
            'fields': ('is_processed', 'processed_at')
        }),
        ('Additional Information', {
            'fields': ('notes',)
        }),
        ('Metadata', {
            'fields': ('created_by', 'created_at'),
            'classes': ('collapse',)
        })
    )
    
    def carryover_percentage(self, obj):
        return f"{obj.carryover_percentage:.1f}%"
    carryover_percentage.short_description = 'Carry-over %'