from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator
from decimal import Decimal


class Fund(models.Model):
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
    grant_number = models.CharField(max_length=100, blank=True, null=True)
    principal_investigator = models.CharField(max_length=200, blank=True, null=True)
    start_date = models.DateField(blank=True, null=True)
    end_date = models.DateField(blank=True, null=True)
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


class Transaction(models.Model):
    TRANSACTION_TYPE_CHOICES = [
        ('purchase', 'Purchase'),
        ('adjustment', 'Budget Adjustment'),
        ('transfer', 'Fund Transfer'),
        ('refund', 'Refund'),
    ]

    fund = models.ForeignKey(Fund, on_delete=models.CASCADE, related_name='transactions')
    amount = models.DecimalField(
        max_digits=12, 
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPE_CHOICES, default='purchase')
    item_name = models.CharField(max_length=200, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    request_id = models.IntegerField(blank=True, null=True)  # Reference to requests.Request
    reference_number = models.CharField(max_length=100, blank=True, null=True)
    transaction_date = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)

    class Meta:
        ordering = ['-transaction_date']

    def __str__(self):
        return f"{self.fund.name} - ${self.amount} ({self.transaction_type})"


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
    ]

    title = models.CharField(max_length=200)
    report_type = models.CharField(max_length=20, choices=REPORT_TYPE_CHOICES)
    start_date = models.DateField()
    end_date = models.DateField()
    funds = models.ManyToManyField(Fund, blank=True)
    summary_data = models.JSONField(default=dict)  # Store calculated summary data
    generated_at = models.DateTimeField(auto_now_add=True)
    generated_by = models.ForeignKey(User, on_delete=models.CASCADE)

    class Meta:
        ordering = ['-generated_at']

    def __str__(self):
        return f"{self.title} ({self.start_date} to {self.end_date})"