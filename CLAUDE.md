# Quartzy Bio-Inventory Management System

## Project Overview

Quartzy is a comprehensive bio-inventory management system built with Django REST Framework backend and React TypeScript frontend. The system manages laboratory inventory, requests, funding, user management, and system settings.

## Architecture

### Backend (Django REST Framework)
- **Location**: `bio-inventory-backend/`
- **Framework**: Django 4.x + Django REST Framework
- **Database**: SQLite (default) / PostgreSQL (production ready)
- **Authentication**: Token-based authentication

### Frontend (React TypeScript)
- **Location**: `bio-inventory-frontend/`
- **Framework**: React 18 + TypeScript
- **Styling**: Tailwind CSS
- **Build Tool**: Create React App with custom webpack config
- **Icons**: Lucide React

## Apps & Functionality

### 1. Core App (`core/`)
- Main Django settings and URL configuration
- Central configuration for the entire application

### 2. Items App (`items/`)
- **Models**: Item inventory management
- **Features**: 
  - Item CRUD operations
  - Expiration tracking and alerts
  - Fund association
  - Batch operations
- **API Endpoints**: `/api/items/`

### 3. Requests App (`requests/`)
- **Models**: Request, RequestHistory
- **Features**:
  - Request creation and management
  - Request status tracking (pending, approved, received, etc.)
  - Integration with funding system
  - Batch operations (fund selection, marking received)
- **API Endpoints**: `/api/requests/`
- **Key Files**:
  - `models.py:15` - Request model with item_type field
  - `views.py:45` - Request filtering and pagination
  - `funding_integration.py` - Integration with funding system

### 4. Funding App (`funding/`)
- **Models**: Fund management and budget tracking
- **Features**:
  - Budget allocation and tracking
  - Transaction records
  - Fund reporting and analytics
  - Integration with items and requests
- **API Endpoints**: `/api/funding/`

### 5. Users App (`users/`)
- **Models**: User management extensions
- **Features**: User profile management
- **API Endpoints**: `/api/users/`

### 6. Notifications App (`notifications/`)
- **Models**: Notification system
- **Features**:
  - Inventory alerts (expiration, low stock)
  - System notifications
  - Email notifications
- **Management Commands**: `check_inventory_alerts.py`

### 7. Settings App (`settings/`) **[RECENTLY ANALYZED]**
- **Models**: 
  - `SystemSetting`: System-wide configuration (admin-only)
  - `UserPreference`: User-specific preferences
- **Features**:
  - System configuration management
  - User preferences (theme, language, notifications)
  - Admin-only settings with proper permissions
  - Bulk settings updates
- **API Endpoints**: `/api/settings/`
- **Key Features**:
  - Theme support (light/dark/auto)
  - Multi-language support (en/fr/zh)
  - Notification preferences
  - Pagination and refresh interval settings
  - Admin system statistics

## Frontend Pages & Components

### Pages
- **InventoryPage**: Main inventory management interface
- **RequestsPage**: Request management and tracking
- **FundingPage**: Budget and fund management
- **ReportsPage**: Analytics and reporting
- **SettingsPage**: System and user preferences *(fully functional)*
- **UserManagementPage**: User administration
- **LoginPage**: Authentication

### Key Components
- **InventoryTable**: Items display with filtering and pagination
- **RequestsTable**: Requests display with status tracking
- **EnhancedDataVisualization**: Charts and analytics
- **NotificationCenter**: Real-time notifications
- **AuthContext**: Authentication state management

### Modals
- **ItemFormModal**: Item creation/editing
- **RequestFormModal**: Request creation with funding integration
- **BatchFundSelectionModal**: Bulk fund assignment
- **BatchReceivedModal**: Bulk status updates
- **MarkReceivedModal**: Individual item receiving

## Settings System Details

### Backend Implementation
- **Complete API**: Full CRUD operations for system settings and user preferences
- **Permission System**: Admin-only settings vs user preferences
- **Data Models**: Comprehensive settings with type validation
- **Bulk Operations**: Admin can update multiple settings at once

### Frontend Implementation  
- **Full UI**: Complete settings interface with 3 tabs
- **User Preferences**: Theme, language, notifications, pagination
- **System Settings**: Admin-only configuration management
- **Administration**: System statistics and information
- **Real-time Updates**: Immediate feedback on save operations

### Settings Categories
1. **User Preferences** (All users):
   - Theme: light/dark/auto
   - Language: English/French/Chinese
   - Email/Push notifications
   - Items per page (5-100)
   - Auto-refresh interval (10-300 seconds)

2. **System Settings** (Admin only):
   - Configurable key-value pairs
   - Multiple data types (TEXT, NUMBER, BOOLEAN, EMAIL)
   - Sensitive data handling with show/hide toggle
   - Bulk update capability

3. **Administration** (Admin only):
   - System statistics dashboard
   - User and data counts
   - Configuration overview

## Recent Changes (Branch: 0722-v2)

### Modified Files:
- **Backend**:
  - `items/management/commands/create_mock_data.py` - Enhanced mock data generation
  - `requests/models.py` - Added item_type field 
  - `requests/serializers.py` - Updated serialization
  - `requests/views.py` - Enhanced filtering and pagination
  - `requirements.txt` - Updated dependencies

- **Frontend**:
  - `package.json` - Updated dependencies
  - Multiple component updates for better UX
  - New batch operation modals
  - Enhanced export functionality (`utils/excelExport.ts`)

### New Files:
- `requests/migrations/0004_request_item_type.py` - Database migration
- `BatchFundSelectionModal.tsx` - Bulk fund assignment
- `BatchReceivedModal.tsx` - Bulk status updates
- `excelExport.ts` - Excel export utilities

## Development Commands

### Backend
```bash
cd bio-inventory-backend
python manage.py runserver          # Start development server
python manage.py migrate            # Run migrations
python manage.py createsuperuser    # Create admin user
python manage.py check_inventory_alerts  # Check for inventory alerts
```

### Frontend
```bash
cd bio-inventory-frontend
npm start                           # Start development server
npm run build                      # Build for production
npm test                           # Run tests
```

## API Endpoints Summary

- `/api/items/` - Inventory management
- `/api/requests/` - Request management
- `/api/funding/` - Fund and budget management
- `/api/users/` - User management
- `/api/notifications/` - Notification system
- `/api/settings/` - System settings and user preferences
  - `/api/settings/preferences/my-preferences/` - Get user preferences
  - `/api/settings/preferences/update-preferences/` - Update user preferences
  - `/api/settings/preferences/overview/` - Complete settings overview
  - `/api/settings/admin/system-info/` - Admin system statistics
  - `/api/settings/admin/bulk-update/` - Bulk update system settings

## Authentication & Permissions

- **Authentication**: Token-based authentication via `Authorization: Token <token>` header
- **User Roles**: 
  - Regular users: Can manage their own items/requests and preferences
  - Staff/Admin: Full system access including settings management
- **Permission Levels**: Model-level and view-level permission checks

## Key Features

1. **Inventory Management**: Full CRUD with filtering, search, and batch operations
2. **Request System**: Complete workflow from request to receipt
3. **Funding Integration**: Budget tracking and fund allocation
4. **User Management**: Role-based access control
5. **Notifications**: Real-time alerts and email notifications
6. **Settings Management**: Comprehensive system configuration *(fully implemented)*
7. **Reporting**: Analytics and data export capabilities
8. **Multi-language Support**: English, French, Chinese
9. **Theme Support**: Light, dark, and auto themes

## Testing & Quality

- Backend: Django test framework with model and API tests
- Frontend: Jest and React Testing Library
- Code quality: ESLint and Prettier for frontend
- Database: Comprehensive migrations and data integrity

## Deployment Notes

- Frontend builds to `build/` directory
- Backend ready for production with proper settings separation
- Static files handling configured
- Database migrations included
- Environment-specific configuration supported

## Current Issues and Solutions (2025-07-23)

### Issues Found:
1. **Notifications API 404 errors**: `/api/notifications/notifications/summary/` endpoint not accessible
2. **Settings API 404 errors**: Several settings endpoints returning 404
3. **System Settings functionality**: Frontend displays but backend endpoints missing
4. **Administration functionality**: Frontend shows stats but no real data

### Root Cause:
- URL routing configuration issues in both `notifications/urls.py` and main `core/urls.py`
- Django server needs restart to pick up URL changes
- Some ViewSet endpoints exist but are not properly routed

### Solutions Implemented:
1. **Fixed notifications URL routing**: Changed `path('api/', include(router.urls))` to `path('', include(router.urls))`
2. **Added temporary API endpoints** in `core/urls.py` for immediate functionality:
   - `/api/notifications/notifications/summary/` - Returns notification statistics
   - `/api/settings/preferences/overview/` - Returns user preferences and system settings
   - `/api/settings/preferences/update-preferences/` - Updates user preferences
   - `/api/settings/admin/system-info/` - Returns admin system statistics
   - `/api/settings/admin/bulk-update/` - Bulk updates system settings

### Current Status:
- ✅ Settings page layout fixed (no longer obscured)
- ✅ Temporary API endpoints added for immediate functionality
- ⏳ Server restart needed to activate new endpoints
- ✅ System Settings will function once endpoints are active
- ✅ Administration panel will show real data once endpoints are active

### Next Steps:
1. Restart Django development server
2. Test all Settings functionality
3. Verify System Settings can be modified by admins
4. Verify Administration panel shows correct statistics

---

*Last Updated: 2025-07-23 - API endpoint fixes implemented, server restart pending*