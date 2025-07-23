# Quartzy Bio-Inventory System

## Project Overview
Full-stack inventory management system with Django backend and React TypeScript frontend.

## Architecture
- **Backend**: Django REST API (`bio-inventory-backend/`)
- **Frontend**: React TypeScript with Tailwind CSS (`bio-inventory-frontend/`)

## Detailed Feature Implementation

### 1. Items Management (Inventory)

#### Backend (`bio-inventory-backend/items/`)
- **Models** (`models.py`):
  - `Item`: Main inventory model with fields like name, quantity, expiration_date, fund_id
  - `Vendor`, `Location`, `ItemType`: Reference models
- **ViewSets** (`views.py`):
  - `ItemViewSet`: Full CRUD operations
    - `alerts()` action: Gets expired/expiring/low stock items
    - Filters: ItemFilter class with search across name, catalog_number, vendor
    - Search fields: ['name', 'catalog_number', 'vendor__name']
  - `VendorViewSet`, `LocationViewSet`, `ItemTypeViewSet`: Reference data management
- **API Endpoints** (`urls.py`):
  - `/items/` - List/Create items
  - `/items/{id}/` - Retrieve/Update/Delete specific item
  - `/items/alerts/` - Get items needing attention

#### Frontend (`bio-inventory-frontend/src/`)
- **Main Page** (`pages/InventoryPage.tsx`):
  - `groupedInventory`: Groups items by name-vendor-catalog_number
  - `fetchInventory()`: API calls with filter parameters
  - Pagination logic with `itemsPerPage = 10`
- **Components**:
  - `InventoryTable.tsx`: Display items with expand/collapse groups
  - `InventorySidebar.tsx`: Filtering interface
- **Modals**:
  - `ItemFormModal.tsx`: Add/Edit item form
  - `ItemRequestHistoryModal.tsx`: View item request history

### 2. Requests Management

#### Backend (`bio-inventory-backend/requests/`)
- **Models** (`models.py`):
  - `Request`: Purchase requests with status workflow
  - `RequestHistory`: Audit trail for status changes
- **ViewSets** (`views.py`):
  - `RequestViewSet`: Full CRUD + workflow actions
    - `approve()` action: Changes status NEW → APPROVED with fund validation
    - `mark_received()` action: Changes status ORDERED → RECEIVED, creates inventory item
    - Search fields: ['item_name', 'catalog_number', 'vendor__name']
- **Funding Integration** (`funding_integration.py`):
  - `validate_fund_budget()`: Checks if fund has sufficient budget
  - `create_transaction_on_approval()`: Creates transaction record

#### Frontend
- **Main Page** (`pages/RequestsPage.tsx`):
  - Request status workflow management
  - Batch operations support
- **Components**:
  - `RequestsTable.tsx`: Display requests with status indicators
  - `RequestsSidebar.tsx`: Filter by status, dates, etc.
- **Modals**:
  - `RequestFormModal.tsx`: Create/edit requests
  - `RequestDetailModal.tsx`: View request details
  - `BatchFundSelectionModal.tsx`: Assign funds to multiple requests
  - `BatchReceivedModal.tsx`: Mark multiple requests as received

### 3. Funding Management

#### Backend (`bio-inventory-backend/funding/`)
- **Models** (`models.py`):
  - `Fund`: Budget containers with total_budget, spent_amount
  - `Transaction`: Spending records linked to requests
  - `BudgetAllocation`, `FundingReport`: Advanced budget tracking
- **ViewSets** (`views.py`):
  - `FundViewSet`: Fund CRUD operations
    - `archive()` action: Mark fund as archived
    - `budget_summary()` action: Get spending overview
    - `spending_analysis()` action: Advanced analytics
  - Permission-based access (is_staff vs regular users)

#### Frontend
- **Main Page** (`pages/FundingPage.tsx`):
  - Fund overview with budget utilization
- **Components** (`components/funding/`):
  - `FundManagement.tsx`: Fund CRUD interface
  - `BudgetReports.tsx`: Analytics and charts
  - `TransactionRecords.tsx`: Transaction history

### 4. Notifications & Alerts

#### Backend (`bio-inventory-backend/notifications/`)
- **Models** (`models.py`):
  - `Notification`: System alerts and messages
- **Services** (`services.py`):
  - `create_notification()`: Create new notifications
  - `get_user_notifications()`: Retrieve user-specific alerts
- **Background Tasks** (`management/commands/check_inventory_alerts.py`):
  - Scheduled task to check for expired items, low stock, etc.

#### Frontend
- **Components**:
  - `NotificationCenter.tsx`: Display system alerts
  - `AlertsBanner.tsx`: Top-level alert display

### 5. Settings Management

#### Backend (`bio-inventory-backend/settings/`)
- **Models** (`models.py`):
  - `SystemSetting`: System-wide configurations with admin-only restrictions
    - Fields: key, value, setting_type, description, is_admin_only
    - Types: TEXT, NUMBER, BOOLEAN, EMAIL
  - `UserPreference`: User-specific preferences  
    - Fields: theme, language, email_notifications, items_per_page, etc.
- **ViewSets** (`views.py`):
  - `SystemSettingViewSet`: CRUD for system settings with role-based access
  - `UserPreferenceViewSet`: User preference management
    - `my_preferences()` action: Get current user preferences
    - `update_preferences()` action: Update user preferences  
    - `overview()` action: Complete settings overview
  - `AdminSettingsViewSet`: Admin-only system management
    - `bulk_update()` action: Bulk update system settings
    - `system_info()` action: System statistics for admin dashboard
- **API Endpoints** (`urls.py`):
  - `/api/settings/system/` - System settings CRUD
  - `/api/settings/preferences/` - User preferences management
  - `/api/settings/admin/` - Admin-only system operations

#### Frontend (`bio-inventory-frontend/src/pages/SettingsPage.tsx`)
- **Tabbed Interface**:
  - User Preferences: Personal settings, theme, notifications
  - System Settings: Admin-only system configuration
  - Administration: System statistics and admin tools
- **Role-based Access**: Different features for regular users vs administrators
- **Real-time Updates**: Settings changes applied immediately
- **Security Features**: Sensitive setting masking, admin-only restrictions

#### Management Commands
- `init_default_settings`: Initialize default system settings on deployment

### 6. Data Export

#### Implementation (`bio-inventory-frontend/src/utils/excelExport.ts`)
- `exportToExcel()`: Main export function
  - Supports multiple data types (items, requests, transactions)
  - Creates formatted Excel files with headers
  - Used in: InventoryPage, RequestsPage, FundingPage

## API Patterns

### Standard REST Endpoints
```
GET    /api/{app}/{model}/           # List with filters
POST   /api/{app}/{model}/           # Create
GET    /api/{app}/{model}/{id}/      # Retrieve
PUT    /api/{app}/{model}/{id}/      # Update
DELETE /api/{app}/{model}/{id}/      # Delete
```

### Custom Actions
```
POST   /api/requests/{id}/approve/           # Approve request
POST   /api/requests/{id}/mark_received/     # Mark as received
GET    /api/items/alerts/                    # Get alert items
GET    /api/funding/budget_summary/          # Budget overview
GET    /api/settings/preferences/overview/   # Complete user settings
POST   /api/settings/admin/bulk-update/      # Bulk update system settings
GET    /api/settings/admin/system-info/      # System statistics
```

## Common Modification Patterns

### Adding New Field to Model
1. Update model in `{app}/models.py`
2. Update serializer in `{app}/serializers.py`  
3. Create migration: `python manage.py makemigrations {app}`
4. Update frontend TypeScript interfaces
5. Update forms/tables in React components

### Adding New API Endpoint
1. Add method to ViewSet in `{app}/views.py`
2. Use `@action()` decorator for custom endpoints
3. Update frontend API calls
4. Add to URL patterns if needed

### Adding New React Component
1. Create component in appropriate folder (`components/`, `modals/`, `pages/`)
2. Follow existing patterns for props/state management
3. Import and use in parent components
4. Add to routing if it's a page component

## Development Commands
- Backend: `python manage.py runserver` (from bio-inventory-backend/)
- Frontend: `npm start` (from bio-inventory-frontend/)
- Migrations: `python manage.py makemigrations && python manage.py migrate`
- Install dependencies: `pip install -r requirements.txt` (backend), `npm install` (frontend)

## Troubleshooting Common Issues

### Admin Role Display Issue (2025-07-23)
**Problem**: Admin users see "User" role in Settings page instead of "Administrator"

**Root Cause**: 
- Settings page fetches user info from `/api/settings/preferences/overview/` endpoint
- This endpoint exists in `core/urls.py` as temporary API but server restart required
- User info should come from authenticated context in `AuthContext.tsx`

**Solution**:
1. Restart Django development server to activate new API endpoints
2. Clear browser cache if user info is cached
3. Verify token authentication is working properly

**Code Locations**:
- User role display: `bio-inventory-frontend/src/pages/SettingsPage.tsx:358-362`
- Auth context: `bio-inventory-frontend/src/components/AuthContext.tsx:22-27`
- API endpoint: `bio-inventory-backend/core/urls.py:60-69`

### Authentication System
**Token Storage**: localStorage with key 'authToken'
**API Endpoints**:
- Login: `/api/users/token/` (returns token + user info)
- Current user: `/api/users/me/` (used by AuthContext)
- Settings overview: `/api/settings/preferences/overview/` (temporary in core/urls.py)

### Database User Verification
```bash
# Check user permissions in Django shell
cd bio-inventory-backend
venv/Scripts/python.exe manage.py shell -c "from django.contrib.auth.models import User; [print(f'{u.username}: is_staff={u.is_staff}') for u in User.objects.all()]"
```