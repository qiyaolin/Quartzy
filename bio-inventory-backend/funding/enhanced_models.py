from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator
from decimal import Decimal
from django.utils import timezone
import uuid

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
    
    FUND_TYPES = [
        ('research_grant', '研究资助'),
        ('equipment_grant', '设备资助'),
        ('operating_fund', '运营资金'),
        ('startup_fund', '启动资金'),
        ('collaboration_fund', '合作资金'),
    ]
    
    # 基本信息
    fund_id = models.CharField(max_length=50, unique=True, default=lambda: f"FUND-{uuid.uuid4().hex[:8]}")
    name = models.CharField(max_length=200)
    fund_type = models.CharField(max_length=20, choices=FUND_TYPES)
    status = models.CharField(max_length=20, choices=FUND_STATUS, default='active')
    
    # 资助信息
    funding_agency = models.ForeignKey(FundingAgency, on_delete=models.SET_NULL, null=True)
    grant_number = models.CharField(max_length=100, blank=True)
    contract_number = models.CharField(max_length=100, blank=True)
    
    # 预算信息
    currency = models.ForeignKey(Currency, on_delete=models.PROTECT, default=1)
    total_budget = models.DecimalField(max_digits=15, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    committed_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0, help_text="已承诺金额")
    spent_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0, help_text="已支出金额")
    reserved_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0, help_text="预留金额")
    
    # 时间管理
    start_date = models.DateField()
    end_date = models.DateField()
    extension_date = models.DateField(null=True, blank=True, help_text="延期日期")
    
    # 管理信息
    principal_investigator = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='pi_funds')
    co_investigators = models.ManyToManyField(User, blank=True, related_name='co_investigator_funds')
    cost_center = models.ForeignKey(CostCenter, on_delete=models.SET_NULL, null=True)
    
    # 合规和报告
    reporting_frequency = models.CharField(max_length=20, choices=[
        ('monthly', '月度'),
        ('quarterly', '季度'),
        ('semi_annual', '半年度'),
        ('annual', '年度'),
    ], default='quarterly')
    next_report_due = models.DateField(null=True, blank=True)
    indirect_cost_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0, help_text="间接成本率 (%)")
    
    # 限制条件
    spending_restrictions = models.JSONField(default=dict, help_text="支出限制条件")
    allowed_categories = models.JSONField(default=list, help_text="允许的支出类别")
    
    # 元数据
    description = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_funds')
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'end_date']),
            models.Index(fields=['principal_investigator', 'status']),
        ]
    
    def __str__(self):
        return f"{self.fund_id}: {self.name}"
    
    @property
    def available_budget(self):
        """可用预算 = 总预算 - 已支出 - 已承诺 - 预留"""
        return self.total_budget - self.spent_amount - self.committed_amount - self.reserved_amount
    
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
        end_date = self.extension_date or self.end_date
        return (end_date - timezone.now().date()).days
    
    @property
    def is_expiring_soon(self):
        """是否即将到期（30天内）"""
        return self.days_remaining <= 30
    
    def can_spend(self, amount):
        """检查是否可以支出指定金额"""
        return self.available_budget >= amount and self.status == 'active'

class BudgetCategory(models.Model):
    """预算类别管理"""
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=20, unique=True)
    description = models.TextField(blank=True)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True)
    is_direct_cost = models.BooleanField(default=True, help_text="是否为直接成本")
    requires_justification = models.BooleanField(default=False, help_text="是否需要理由说明")
    approval_threshold = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="需要审批的金额阈值")
    is_active = models.BooleanField(default=True)
    
    def __str__(self):
        return f"{self.code} - {self.name}"

class EnhancedBudgetAllocation(models.Model):
    """增强的预算分配"""
    fund = models.ForeignKey(EnhancedFund, on_delete=models.CASCADE, related_name='allocations')
    category = models.ForeignKey(BudgetCategory, on_delete=models.CASCADE)
    allocated_amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    spent_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    committed_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    reserved_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    # 时间限制
    valid_from = models.DateField(default=timezone.now)
    valid_until = models.DateField(null=True, blank=True)
    
    # 审批信息
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['fund', 'category']
        ordering = ['category__name']
    
    def __str__(self):
        return f"{self.fund.name} - {self.category.name}"
    
    @property
    def available_amount(self):
        return self.allocated_amount - self.spent_amount - self.committed_amount - self.reserved_amount

class FinancialTransaction(models.Model):
    """增强的财务交易记录"""
    TRANSACTION_TYPES = [
        ('purchase', '采购'),
        ('refund', '退款'),
        ('transfer_in', '转入'),
        ('transfer_out', '转出'),
        ('adjustment', '调整'),
        ('commitment', '承诺'),
        ('release', '释放承诺'),
        ('indirect_cost', '间接成本'),
    ]
    
    STATUS_CHOICES = [
        ('pending', '待处理'),
        ('approved', '已批准'),
        ('processed', '已处理'),
        ('cancelled', '已取消'),
        ('rejected', '已拒绝'),
    ]
    
    # 基本信息
    transaction_id = models.CharField(max_length=50, unique=True, default=lambda: f"TXN-{uuid.uuid4().hex[:8]}")
    fund = models.ForeignKey(EnhancedFund, on_delete=models.CASCADE, related_name='transactions')
    allocation = models.ForeignKey(EnhancedBudgetAllocation, on_delete=models.SET_NULL, null=True, blank=True)
    
    # 交易信息
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPES)
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    currency = models.ForeignKey(Currency, on_delete=models.PROTECT)
    amount_in_fund_currency = models.DecimalField(max_digits=12, decimal_places=2, help_text="基金货币金额")
    exchange_rate = models.DecimalField(max_digits=10, decimal_places=6, default=1.0)
    
    # 关联信息
    request_id = models.IntegerField(null=True, blank=True, help_text="关联的采购请求ID")
    purchase_order_number = models.CharField(max_length=100, blank=True)
    invoice_number = models.CharField(max_length=100, blank=True)
    vendor_name = models.CharField(max_length=200, blank=True)
    
    # 状态和审批
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_transactions')
    approved_at = models.DateTimeField(null=True, blank=True)
    
    # 详细信息
    description = models.TextField()
    justification = models.TextField(blank=True, help_text="支出理由")
    notes = models.TextField(blank=True)
    attachments = models.JSONField(default=list, help_text="附件文件路径列表")
    
    # 时间信息
    transaction_date = models.DateTimeField(default=timezone.now)
    due_date = models.DateField(null=True, blank=True)
    processed_date = models.DateTimeField(null=True, blank=True)
    
    # 元数据
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_transactions')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-transaction_date']
        indexes = [
            models.Index(fields=['fund', '-transaction_date']),
            models.Index(fields=['status', '-transaction_date']),
            models.Index(fields=['transaction_type', '-transaction_date']),
        ]
    
    def __str__(self):
        return f"{self.transaction_id}: {self.fund.name} - {self.amount}"

class BudgetForecast(models.Model):
    """预算预测"""
    fund = models.ForeignKey(EnhancedFund, on_delete=models.CASCADE, related_name='forecasts')
    forecast_date = models.DateField()
    forecast_period_months = models.IntegerField(default=12, help_text="预测期间（月）")
    
    # 预测数据
    projected_spending = models.JSONField(default=dict, help_text="按月预测支出")
    projected_commitments = models.JSONField(default=dict, help_text="按月预测承诺")
    risk_factors = models.JSONField(default=list, help_text="风险因素")
    assumptions = models.TextField(blank=True, help_text="预测假设")
    
    # 准确性跟踪
    accuracy_score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, help_text="预测准确性评分")
    
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-forecast_date']
        unique_together = ['fund', 'forecast_date']
    
    def __str__(self):
        return f"{self.fund.name} - 预测 {self.forecast_date}"

class FinancialAlert(models.Model):
    """财务预警"""
    ALERT_TYPES = [
        ('budget_threshold', '预算阈值'),
        ('expiration_warning', '到期预警'),
        ('overspending', '超支预警'),
        ('commitment_high', '承诺过高'),
        ('reporting_due', '报告到期'),
        ('compliance_issue', '合规问题'),
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
    threshold_value = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    current_value = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    
    is_active = models.BooleanField(default=True)
    is_acknowledged = models.BooleanField(default=False)
    acknowledged_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.fund.name} - {self.title}"