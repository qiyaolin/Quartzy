from django.db import models
from django.db.models import Sum
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator
from decimal import Decimal
from django.utils import timezone
import uuid


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

    def recalculate_spent_amount(self):
        """Recalculate spent amount from actual inventory items and personnel expenses"""
        # Calculate from inventory items
        from items.models import Item
        inventory_spending = Item.objects.filter(
            fund_id=self.id
        ).exclude(price__isnull=True).aggregate(
            total=Sum('price')
        )['total'] or Decimal('0.00')
        
        # Calculate from personnel expenses (approved only)
        personnel_spending = self.personnel_expenses.filter(
            is_approved=True
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        
        # Calculate from legacy transactions (for backward compatibility)
        transaction_spending = self.transactions.filter(
            transaction_type__in=['purchase', 'adjustment']
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        
        refunds = self.transactions.filter(
            transaction_type='refund'
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        
        # Total spent amount from all sources
        self.spent_amount = inventory_spending + personnel_spending + transaction_spending - refunds
        return self.spent_amount


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


# Enhanced Models for Financial Dashboard

class Currency(models.Model):
    """货币管理"""
    code = models.CharField(max_length=3, unique=True, help_text="货币代码 (如: CAD, USD)")
    name = models.CharField(max_length=50, help_text="货币名称")
    symbol = models.CharField(max_length=5, help_text="货币符号")
    exchange_rate_to_cad = models.DecimalField(max_digits=10, decimal_places=6, default=1.0)
    is_active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.code} - {self.name}"


class FundingAgency(models.Model):
    """资助机构管理"""
    AGENCY_TYPES = [
        ('government', '政府机构'),
        ('foundation', '基金会'),
        ('industry', '工业合作'),
        ('university', '大学内部'),
        ('international', '国际组织'),
    ]
    
    name = models.CharField(max_length=200, unique=True)
    agency_type = models.CharField(max_length=20, choices=AGENCY_TYPES)
    contact_person = models.CharField(max_length=100, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    website = models.URLField(blank=True)
    reporting_requirements = models.TextField(blank=True, help_text="报告要求")
    payment_terms = models.TextField(blank=True, help_text="付款条件")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.name


class CostCenter(models.Model):
    """成本中心管理"""
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    department = models.CharField(max_length=100, blank=True)
    manager = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.code} - {self.name}"


class EnhancedFund(models.Model):
    """增强的资金管理模型"""
    FUND_STATUS = [
        ('active', '活跃'),
        ('pending', '待批准'),
        ('suspended', '暂停'),
        ('closed', '已关闭'),
        ('expired', '已过期'),
    ]
    
    # 基本信息 - using CharField instead of lambda for default
    fund_id = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=200)
    status = models.CharField(max_length=20, choices=FUND_STATUS, default='active')
    
    # 资助信息
    funding_agency = models.ForeignKey(FundingAgency, on_delete=models.SET_NULL, null=True, blank=True)
    grant_number = models.CharField(max_length=100, blank=True)
    
    # 预算信息
    currency = models.ForeignKey(Currency, on_delete=models.PROTECT, null=True, blank=True)
    total_budget = models.DecimalField(max_digits=15, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    committed_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0, help_text="已承诺金额")
    spent_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0, help_text="已支出金额")
    
    # 时间管理
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    
    # 管理信息
    principal_investigator = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='pi_enhanced_funds')
    co_investigators = models.ManyToManyField(User, blank=True, related_name='co_investigator_enhanced_funds')
    cost_center = models.ForeignKey(CostCenter, on_delete=models.SET_NULL, null=True, blank=True)
    
    # 元数据
    description = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_enhanced_funds')
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.fund_id}: {self.name}"
    
    def save(self, *args, **kwargs):
        if not self.fund_id:
            self.fund_id = f"FUND-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)
    
    @property
    def available_budget(self):
        """可用预算"""
        return self.total_budget - self.spent_amount - self.committed_amount
    
    @property
    def utilization_rate(self):
        """预算使用率"""
        if self.total_budget > 0:
            return (self.spent_amount / self.total_budget) * 100
        return 0
    
    @property
    def commitment_rate(self):
        """承诺率"""
        if self.total_budget > 0:
            return ((self.spent_amount + self.committed_amount) / self.total_budget) * 100
        return 0
    
    @property
    def days_remaining(self):
        """剩余天数"""
        if self.end_date:
            delta = self.end_date - timezone.now().date()
            return delta.days
        return 0
    
    def can_spend(self, amount):
        """检查是否可以支出指定金额"""
        return self.available_budget >= amount


class BudgetCategory(models.Model):
    """预算类别"""
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    
    def __str__(self):
        return self.name


class EnhancedBudgetAllocation(models.Model):
    """增强的预算分配"""
    fund = models.ForeignKey(EnhancedFund, on_delete=models.CASCADE, related_name='allocations')
    category = models.ForeignKey(BudgetCategory, on_delete=models.CASCADE)
    allocated_amount = models.DecimalField(max_digits=15, decimal_places=2)
    spent_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    committed_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    
    class Meta:
        unique_together = ['fund', 'category']
    
    def __str__(self):
        return f"{self.fund.name} - {self.category.name}"


class FinancialTransaction(models.Model):
    """财务交易"""
    TRANSACTION_TYPES = [
        ('purchase', '采购'),
        ('transfer_in', '转入'),
        ('transfer_out', '转出'),
        ('refund', '退款'),
        ('adjustment', '调整'),
    ]
    
    STATUS_CHOICES = [
        ('pending', '待处理'),
        ('approved', '已批准'),
        ('processed', '已处理'),
        ('rejected', '已拒绝'),
    ]
    
    fund = models.ForeignKey(EnhancedFund, on_delete=models.CASCADE, related_name='transactions')
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPES)
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    currency = models.ForeignKey(Currency, on_delete=models.PROTECT, null=True, blank=True)
    amount_in_fund_currency = models.DecimalField(max_digits=15, decimal_places=2)
    description = models.TextField()
    justification = models.TextField(blank=True)
    vendor_name = models.CharField(max_length=200, blank=True)
    reference_number = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    transaction_date = models.DateTimeField(default=timezone.now)
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_transactions')
    approved_at = models.DateTimeField(null=True, blank=True)
    processed_date = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_transactions')
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-transaction_date']
    
    def __str__(self):
        return f"{self.fund.name} - {self.amount} ({self.transaction_type})"


class BudgetForecast(models.Model):
    """预算预测"""
    fund = models.ForeignKey(EnhancedFund, on_delete=models.CASCADE, related_name='forecasts')
    forecast_date = models.DateField()
    forecast_period_months = models.IntegerField()
    projected_spending = models.JSONField(default=dict)
    projected_commitments = models.JSONField(default=dict)
    assumptions = models.TextField(blank=True)
    accuracy_score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-forecast_date']
    
    def __str__(self):
        return f"{self.fund.name} - {self.forecast_date}"


class FinancialAlert(models.Model):
    """财务预警"""
    ALERT_TYPES = [
        ('budget_exceeded', '预算超支'),
        ('nearing_limit', '接近限额'),
        ('expiring_soon', '即将到期'),
        ('low_balance', '余额不足'),
        ('high_burn_rate', '支出过快'),
    ]
    
    SEVERITY_LEVELS = [
        ('low', '低'),
        ('medium', '中'),
        ('high', '高'),
        ('critical', '严重'),
    ]
    
    fund = models.ForeignKey(EnhancedFund, on_delete=models.CASCADE, related_name='alerts')
    alert_type = models.CharField(max_length=20, choices=ALERT_TYPES)
    severity = models.CharField(max_length=10, choices=SEVERITY_LEVELS)
    title = models.CharField(max_length=200)
    message = models.TextField()
    threshold_value = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    current_value = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    is_acknowledged = models.BooleanField(default=False)
    acknowledged_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='acknowledged_alerts')
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.fund.name} - {self.title}"


class PersonnelExpense(models.Model):
    """Personnel expense tracking model"""
    EXPENSE_TYPES = [
        ('salary', 'Salary'),
        ('benefits', 'Benefits'),
        ('stipend', 'Stipend'),
        ('bonus', 'Bonus'),
        ('training', 'Training'),
        ('travel', 'Travel'),
    ]
    
    fund = models.ForeignKey(Fund, on_delete=models.CASCADE, related_name='personnel_expenses')
    employee = models.ForeignKey(User, on_delete=models.CASCADE, related_name='personnel_expenses', null=True, blank=True, help_text="The employee for this expense")
    employee_name = models.CharField(max_length=200, blank=True, help_text="Name of the employee")
    expense_type = models.CharField(max_length=20, choices=EXPENSE_TYPES)
    amount = models.DecimalField(
        max_digits=12, 
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    expense_date = models.DateField(help_text="Date of the expense")
    description = models.TextField(blank=True, help_text="Additional details about the expense")
    reference_number = models.CharField(max_length=100, blank=True, help_text="Reference or invoice number")
    
    # Metadata
    is_approved = models.BooleanField(default=False)
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_personnel_expenses')
    approved_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_personnel_expenses')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-expense_date', '-created_at']
    
    def __str__(self):
        return f"{self.employee_name} - {self.expense_type} - ${self.amount}"
    
    def save(self, *args, **kwargs):
        # Auto-populate employee_name from employee User
        if self.employee:
            if self.employee.first_name and self.employee.last_name:
                self.employee_name = f"{self.employee.first_name} {self.employee.last_name}"
            else:
                self.employee_name = self.employee.username
        
        super().save(*args, **kwargs)
        # Note: Fund recalculation is handled by post_save signal to avoid transaction issues


# Signal handlers
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

@receiver(post_save, sender=PersonnelExpense)
def update_fund_on_personnel_expense_save(sender, instance, **kwargs):
    """Update fund spent amount when personnel expense is saved"""
    try:
        instance.fund.recalculate_spent_amount()
        instance.fund.save(update_fields=['spent_amount'])
    except Exception as e:
        # Log error but don't fail the original save
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error updating fund spent amount: {e}")

@receiver(post_delete, sender=PersonnelExpense)
def update_fund_on_personnel_expense_delete(sender, instance, **kwargs):
    """Update fund spent amount when personnel expense is deleted"""
    try:
        instance.fund.recalculate_spent_amount()
        instance.fund.save(update_fields=['spent_amount'])
    except Exception as e:
        # Log error but don't fail the original delete
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error updating fund spent amount after delete: {e}")