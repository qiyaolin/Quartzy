from django.db import models
from django.db.models import Sum
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator
from decimal import Decimal
from datetime import datetime


class Fund(models.Model):
    FUNDING_AGENCY_CHOICES = [
        (1, 'Canadian Institutes of Health Research (CIHR)'),
        (2, 'Natural Sciences and Engineering Research Council (NSERC)'),
        (3, 'Social Sciences and Humanities Research Council (SSHRC)'),
        (4, 'Other Funding Source'),
    ]
    
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    total_budget = models.DecimalField(
        max_digits=12, 
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    spent_amount = models.DecimalField(
        max_digits=12, 
        decimal_places=2, 
        default=Decimal('0.00')
    )
    funding_source = models.CharField(max_length=200, blank=True, null=True)
    funding_agency = models.IntegerField(
        choices=FUNDING_AGENCY_CHOICES,
        default=4,
        help_text='Canadian Tri-Agency or other funding source'
    )
    grant_number = models.CharField(max_length=100, blank=True, null=True)
    principal_investigator = models.CharField(max_length=200, blank=True, null=True)
    start_date = models.DateField(blank=True, null=True)
    end_date = models.DateField(blank=True, null=True)
    
    # Multi-year grant support
    grant_duration_years = models.IntegerField(
        default=1, 
        validators=[MinValueValidator(1)],
        help_text='Total duration of the grant in years'
    )
    current_year = models.IntegerField(
        default=1,
        validators=[MinValueValidator(1)],
        help_text='Current year of the multi-year grant'
    )
    
    # Annual budget allocations for multi-year grants
    annual_budgets = models.JSONField(
        default=dict,
        help_text='Annual budget allocations: {"2024": 50000.00, "2025": 55000.00, ...}'
    )
    
    notes = models.TextField(blank=True, null=True)
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name

    @property
    def remaining_budget(self):
        return self.total_budget - self.spent_amount

    @property
    def utilization_percentage(self):
        if self.total_budget > 0:
            return (self.spent_amount / self.total_budget) * 100
        return 0

    def can_afford(self, amount):
        return self.remaining_budget >= amount

    def recalculate_spent_amount(self):
        """Recalculate spent amount from all transactions to ensure accuracy"""
        purchases_and_adjustments = self.transactions.filter(
            transaction_type__in=['purchase', 'adjustment']
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        
        refunds = self.transactions.filter(
            transaction_type='refund'
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        
        self.spent_amount = purchases_and_adjustments - refunds
        return self.spent_amount
    
    def get_current_fiscal_year(self):
        """Get current fiscal year (April 1 - March 31 for Canadian funding)"""
        today = datetime.now().date()
        if today.month >= 4:  # April to December
            return today.year
        else:  # January to March
            return today.year - 1
    
    def get_annual_budget(self, fiscal_year=None):
        """Get budget allocation for specific fiscal year"""
        if fiscal_year is None:
            fiscal_year = self.get_current_fiscal_year()
        
        year_str = str(fiscal_year)
        if self.annual_budgets and year_str in self.annual_budgets:
            return Decimal(str(self.annual_budgets[year_str]))
        
        # If no specific annual budget, divide total by grant duration
        return self.total_budget / self.grant_duration_years
    
    def get_unspent_amount_for_carryover(self, fiscal_year):
        """Calculate unspent amount available for carry-forward to next year"""
        year_budget = self.get_annual_budget(fiscal_year)
        year_spending = self.get_spending_by_fiscal_year(fiscal_year)
        return year_budget - year_spending
    
    def get_spending_by_fiscal_year(self, fiscal_year):
        """Get total spending for a specific fiscal year"""
        from datetime import date
        
        start_date = date(fiscal_year, 4, 1)
        end_date = date(fiscal_year + 1, 3, 31)
        
        spending = self.transactions.filter(
            transaction_date__date__range=[start_date, end_date],
            transaction_type__in=['purchase', 'adjustment']
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        
        refunds = self.transactions.filter(
            transaction_date__date__range=[start_date, end_date],
            transaction_type='refund'
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        
        return spending - refunds


class Transaction(models.Model):
    TRANSACTION_TYPE_CHOICES = [
        ('purchase', 'Purchase'),
        ('adjustment', 'Budget Adjustment'),
        ('transfer', 'Fund Transfer'),
        ('refund', 'Refund'),
        ('carryover', 'Carry-over from Previous Year'),
    ]
    
    COST_TYPE_CHOICES = [
        ('direct', 'Direct Research Cost'),
        ('indirect', 'Indirect Cost (Administrative)'),
    ]
    
    EXPENSE_CATEGORY_CHOICES = [
        ('personnel', 'Personnel Salaries & Benefits'),
        ('equipment', 'Equipment'),
        ('supplies', 'Supplies & Materials'),
        ('travel', 'Travel & Conference'),
        ('services', 'Professional Services'),
        ('facilities', 'Facilities & Overhead'),
        ('other', 'Other Direct Costs'),
    ]

    fund = models.ForeignKey(Fund, on_delete=models.CASCADE, related_name='transactions')
    amount = models.DecimalField(
        max_digits=12, 
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPE_CHOICES, default='purchase')
    
    # Canadian Tri-Agency compliance fields
    cost_type = models.CharField(
        max_length=10, 
        choices=COST_TYPE_CHOICES, 
        default='direct',
        help_text='Classify as direct research cost or indirect administrative cost'
    )
    expense_category = models.CharField(
        max_length=15,
        choices=EXPENSE_CATEGORY_CHOICES,
        default='supplies',
        help_text='Expense category for TAGFA reporting requirements'
    )
    
    # Fiscal year tracking
    fiscal_year = models.IntegerField(
        blank=True, 
        null=True,
        help_text='Fiscal year for this transaction (auto-calculated)'
    )
    
    item_name = models.CharField(max_length=200, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    request_id = models.IntegerField(blank=True, null=True)  # Reference to requests.Request
    reference_number = models.CharField(max_length=100, blank=True, null=True)
    
    # Enhanced audit trail
    transaction_date = models.DateTimeField(auto_now_add=True)
    invoice_number = models.CharField(max_length=100, blank=True, null=True)
    vendor = models.CharField(max_length=200, blank=True, null=True)
    
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)

    class Meta:
        ordering = ['-transaction_date']

    def save(self, *args, **kwargs):
        """Auto-calculate fiscal year on save"""
        if not self.fiscal_year:
            transaction_date = self.transaction_date or datetime.now()
            if transaction_date.month >= 4:  # April to December
                self.fiscal_year = transaction_date.year
            else:  # January to March
                self.fiscal_year = transaction_date.year - 1
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.fund.name} - ${self.amount} ({self.transaction_type}) - {self.cost_type}"


class BudgetAllocation(models.Model):
    fund = models.ForeignKey(Fund, on_delete=models.CASCADE, related_name='allocations')
    category = models.CharField(max_length=100)  # e.g., "Equipment", "Supplies", "Personnel"
    allocated_amount = models.DecimalField(
        max_digits=12, 
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    spent_amount = models.DecimalField(
        max_digits=12, 
        decimal_places=2, 
        default=Decimal('0.00')
    )
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['fund', 'category']
        ordering = ['category']

    def __str__(self):
        return f"{self.fund.name} - {self.category}"

    @property
    def remaining_amount(self):
        return self.allocated_amount - self.spent_amount

    @property
    def utilization_percentage(self):
        if self.allocated_amount > 0:
            return (self.spent_amount / self.allocated_amount) * 100
        return 0


class FundingReport(models.Model):
    REPORT_TYPE_CHOICES = [
        ('monthly', 'Monthly Report'),
        ('quarterly', 'Quarterly Report'),
        ('annual', 'Annual Report'),
        ('custom', 'Custom Report'),
        ('form300', 'Form 300 - Grants in Aid of Research Statement'),
        ('tri_agency_annual', 'Tri-Agency Annual Financial Report'),
        ('audit_trail', 'Audit Trail Report (7-year compliance)'),
    ]

    title = models.CharField(max_length=200)
    report_type = models.CharField(max_length=20, choices=REPORT_TYPE_CHOICES)
    start_date = models.DateField()
    end_date = models.DateField()
    fiscal_year = models.IntegerField(
        blank=True, 
        null=True,
        help_text='Fiscal year for this report (auto-calculated)'
    )
    funds = models.ManyToManyField(Fund, blank=True)
    
    # Enhanced summary data for Tri-Agency compliance
    summary_data = models.JSONField(
        default=dict,
        help_text='Summary data including direct/indirect costs, category breakdowns, etc.'
    )
    
    # Compliance tracking
    is_tri_agency_compliant = models.BooleanField(
        default=False,
        help_text='Meets Canadian Tri-Agency reporting requirements'
    )
    
    generated_at = models.DateTimeField(auto_now_add=True)
    generated_by = models.ForeignKey(User, on_delete=models.CASCADE)

    class Meta:
        ordering = ['-generated_at']

    def save(self, *args, **kwargs):
        """Auto-calculate fiscal year and compliance status"""
        if not self.fiscal_year:
            # Use start date to determine fiscal year
            if self.start_date.month >= 4:  # April to December
                self.fiscal_year = self.start_date.year
            else:  # January to March
                self.fiscal_year = self.start_date.year - 1
                
        # Check if this is a Tri-Agency report type
        tri_agency_types = ['form300', 'tri_agency_annual', 'audit_trail']
        self.is_tri_agency_compliant = self.report_type in tri_agency_types
        
        super().save(*args, **kwargs)
    
    def generate_form300_data(self):
        """Generate Form 300 compliant data structure"""
        form_data = {
            'direct_costs': {
                'personnel': Decimal('0.00'),
                'equipment': Decimal('0.00'),
                'supplies': Decimal('0.00'),
                'travel': Decimal('0.00'),
                'services': Decimal('0.00'),
                'other': Decimal('0.00'),
            },
            'indirect_costs': {
                'facilities': Decimal('0.00'),
                'administrative': Decimal('0.00'),
            },
            'total_direct': Decimal('0.00'),
            'total_indirect': Decimal('0.00'),
            'grand_total': Decimal('0.00'),
            'fiscal_year': self.fiscal_year,
            'reporting_period': f"{self.start_date} to {self.end_date}"
        }
        
        # Calculate costs by category and type
        for fund in self.funds.all():
            transactions = fund.transactions.filter(
                transaction_date__date__range=[self.start_date, self.end_date],
                transaction_type__in=['purchase', 'adjustment']
            )
            
            for transaction in transactions:
                amount = transaction.amount
                category = transaction.expense_category
                cost_type = transaction.cost_type
                
                if cost_type == 'direct':
                    if category in form_data['direct_costs']:
                        form_data['direct_costs'][category] += amount
                    else:
                        form_data['direct_costs']['other'] += amount
                elif cost_type == 'indirect':
                    if category == 'facilities':
                        form_data['indirect_costs']['facilities'] += amount
                    else:
                        form_data['indirect_costs']['administrative'] += amount
        
        # Calculate totals
        form_data['total_direct'] = sum(form_data['direct_costs'].values())
        form_data['total_indirect'] = sum(form_data['indirect_costs'].values())
        form_data['grand_total'] = form_data['total_direct'] + form_data['total_indirect']
        
        # Convert all Decimal values to float for JSON serialization
        def convert_decimals(obj):
            if isinstance(obj, dict):
                return {key: convert_decimals(value) for key, value in obj.items()}
            elif isinstance(obj, Decimal):
                return float(obj)
            else:
                return obj
        
        return convert_decimals(form_data)
    
    def __str__(self):
        return f"{self.title} ({self.start_date} to {self.end_date}) - FY{self.fiscal_year}"


class FundCarryOver(models.Model):
    """Model to track carry-over of unspent funds from one fiscal year to the next"""
    
    fund = models.ForeignKey(Fund, on_delete=models.CASCADE, related_name='carryovers')
    from_fiscal_year = models.IntegerField(
        help_text='Fiscal year the funds are being carried over from'
    )
    to_fiscal_year = models.IntegerField(
        help_text='Fiscal year the funds are being carried over to'
    )
    carryover_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text='Amount being carried over'
    )
    original_budget = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text='Original budget for the from_fiscal_year'
    )
    spent_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text='Amount spent in the from_fiscal_year'
    )
    
    # Approval and processing
    is_approved = models.BooleanField(
        default=False,
        help_text='Whether this carry-over has been approved by administrator'
    )
    approved_by = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='approved_carryovers'
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    
    # Processing status
    is_processed = models.BooleanField(
        default=False,
        help_text='Whether the carry-over transaction has been created'
    )
    processed_at = models.DateTimeField(null=True, blank=True)
    
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    
    class Meta:
        unique_together = ['fund', 'from_fiscal_year', 'to_fiscal_year']
        ordering = ['-from_fiscal_year', '-created_at']
    
    def __str__(self):
        return f"{self.fund.name} - ${self.carryover_amount} (FY{self.from_fiscal_year} → FY{self.to_fiscal_year})"
    
    @property
    def carryover_percentage(self):
        """Calculate what percentage of original budget is being carried over"""
        if self.original_budget > 0:
            return (self.carryover_amount / self.original_budget) * 100
        return 0
    
    def process_carryover(self, user):
        """Create the actual carry-over transaction"""
        if self.is_processed:
            return None
            
        if not self.is_approved:
            raise ValueError("Carry-over must be approved before processing")
        
        # Create carry-over transaction
        from datetime import datetime
        
        transaction = Transaction.objects.create(
            fund=self.fund,
            amount=self.carryover_amount,
            transaction_type='carryover',
            cost_type='direct',  # Carry-overs are typically direct costs
            expense_category='other',
            fiscal_year=self.to_fiscal_year,
            description=f"Carry-over from FY{self.from_fiscal_year}",
            reference_number=f"CO-{self.from_fiscal_year}-{self.to_fiscal_year}",
            created_by=user
        )
        
        # Mark as processed
        self.is_processed = True
        self.processed_at = datetime.now()
        self.save()
        
        return transaction