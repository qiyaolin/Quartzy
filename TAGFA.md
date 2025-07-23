# TAGFA Form 300 模块重写前端与后端理解文档

---

## 目录
1. 概述
2. 后端实现详解
    - 2.1 主要数据模型
    - 2.2 关键API接口
    - 2.3 业务流程与合规逻辑
3. 前端实现详解
    - 3.1 页面与组件结构
    - 3.2 主要数据流与交互
    - 3.3 用户体验与合规提示
4. 端到端数据流与典型用例
5. 合规与业务要点
6. 未来重写注意事项

---

## 1. 概述

TAGFA Form 300（加拿大三大机构Form 300）是科研经费管理系统中用于生成“Grants in Aid of Research Statement”的标准合规报表。该模块需支持：
- 自动归集直接/间接费用
- 多基金、多年度合规统计
- 7年审计追溯
- 前后端联动生成、导出、展示

---

## 2. 后端实现详解

### 2.1 主要数据模型

#### Fund（funding/models.py）
- 代表一个科研经费账户，核心字段：
    - `name`, `total_budget`, `spent_amount`, `funding_agency`（1:CIHR, 2:NSERC, 3:SSHRC, 4:Other）
    - `grant_duration_years`, `current_year`, `annual_budgets`（多年度支持）

#### Transaction（funding/models.py）
- 代表一笔经费支出/调整，核心字段：
    - `amount`, `transaction_type`（purchase/adjustment等）
    - `cost_type`（direct/indirect）
    - `expense_category`（personnel, equipment, supplies, travel, services, facilities, other）
    - `fiscal_year`, `transaction_date`

#### FundingReport（funding/models.py）
- 代表一次报表生成，核心字段：
    - `report_type`（form300/tri_agency_annual等）
    - `start_date`, `end_date`, `fiscal_year`, `funds`（多对多）
    - `summary_data`（JSON，存储Form 300结构化结果）
    - `is_tri_agency_compliant`（合规标记）

### 2.2 关键API接口

- `POST /api/reports/generate_form300/`
    - 参数：`fiscal_year`，可选`fund_ids`
    - 逻辑：按年度、基金归集所有三大机构相关fund，统计所有相关transaction，自动分类direct/indirect及各细项，生成summary_data
    - 返回：FundingReport序列化数据 + form300_data结构

- 相关序列化器：FundingReportSerializer（funding/serializers.py）
    - 只读/只写字段区分，自动生成summary_data

### 2.3 业务流程与合规逻辑

- 生成Form 300时，后端会：
    1. 校验年度与基金
    2. 自动筛选三大机构基金（funding_agency in 1,2,3）
    3. 统计所有相关transaction，按cost_type/expense_category归类
    4. 汇总direct/indirect/各细项/总计，写入summary_data
    5. 返回结构化数据供前端展示/导出
- 7年审计追溯：所有transaction均有详细时间、类型、发票、vendor等字段，便于合规追溯

---

## 3. 前端实现详解

### 3.1 页面与组件结构

- 主要入口：FundingPage（src/pages/FundingPage.tsx）
    - Tab切换，包含BudgetReports（src/components/funding/BudgetReports.tsx）
- 主要组件：
    - BudgetReports：负责Form 300生成、展示、导出
    - FundManagement/FundModal：基金管理与三大机构标记
    - CarryOverManagement：多年度结转

### 3.2 主要数据流与交互

- 生成流程：
    1. 用户在FundingPage切换到“Budget Reports”Tab
    2. 点击“Generate Form 300”按钮，弹出modal，选择年度与基金
    3. 前端调用`/api/reports/generate_form300/`，传递token、年度、基金ID
    4. 后端返回结构化form300_data，前端展示在卡片/表格中
    5. 用户可点击“Export Form 300”导出为CSV（Excel兼容）

- 主要状态与交互：
    - `form300Data`：存储后端返回的Form 300结构
    - `showForm300Modal`：控制生成弹窗
    - `form300FiscalYear`、`selectedTriAgencyFunds`：用户输入
    - `loading`：生成中loading状态

- 展示内容：
    - 直接费用/间接费用分组、各细项、总计、年度、期间
    - 合规提示、导出按钮、历史记录

### 3.3 用户体验与合规提示

- 仅三大机构基金可生成Form 300，前端有显著标识与筛选
- 生成modal中可选年度、基金，留空则全选
- 生成后有导出按钮，格式为CSV，含合规说明
- 多年度/结转等高级功能在同一Tab下可用

---

## 4. 端到端数据流与典型用例

### 典型用例：
1. 管理员新建/编辑基金，标记为CIHR/NSERC/SSHRC
2. 日常录入/导入transaction，标注cost_type/expense_category
3. 年度末，管理员在FundingPage生成Form 300，选择年度与基金
4. 系统自动归集所有支出，生成合规报表，前端展示与导出
5. 审计时可追溯所有原始transaction明细

---

## 5. 合规与业务要点

- Form 300必须覆盖所有三大机构基金，且支出分类需严格按direct/indirect及细项
- 7年审计追溯要求所有transaction可查
- 多年度基金需支持carry-over与年度分摊
- 前端需有明显合规提示与导出功能

---

## 6. 未来重写注意事项

- 后端：
    - 保持模型与API解耦，便于扩展更多报表类型
    - summary_data结构应可配置/扩展
    - transaction分类与合规校验逻辑需可单元测试
- 前端：
    - 组件化拆分，BudgetReports与Form 300逻辑解耦
    - Modal、导出、展示等交互应可复用
    - 合规提示与用户引导需清晰
- 端到端：
    - 保证数据一致性与可追溯性
    - 充分测试多年度、多基金、异常场景

---

如需详细字段/接口/交互示例，请参考现有代码实现与API文档。 