# Quartzy Bio-Inventory Project Structure

## Overview

This document outlines the structure of the Quartzy Bio-Inventory project, which consists of a Django backend and a React frontend. The system provides comprehensive inventory management with integrated funding/budget tracking capabilities.

## Project Structure

```
Quartzy/
├── bio-inventory-backend/          # Django backend application
│   ├── core/                       # Core Django configuration
│   ├── funding/                    # Funding/budget management module
│   ├── items/                      # Inventory items management
│   ├── requests/                   # Purchase requests system
│   ├── users/                      # User management
│   ├── manage.py                   # Django management script
│   └── requirements.txt            # Python dependencies
└── bio-inventory-frontend/         # React frontend application
    ├── public/                     # Static assets
    ├── src/                        # Source code
    └── package.json                # Node.js dependencies
```

## Backend Structure (Django)

### Core Components

- **core/**: Contains Django settings, URL routing, and WSGI configuration
- **manage.py**: Django's command-line utility for administrative tasks

### Main Applications

#### 1. Funding Module
Location: `bio-inventory-backend/funding/`

The funding module provides comprehensive budget and financial management capabilities with:
- Fund creation and management
- Transaction tracking
- Budget allocation system
- Advanced analytics and reporting
- Smart recommendations

Key files:
- `models.py`: Fund, Transaction, BudgetAllocation, FundingReport
- `views.py`: API endpoints for fund management
- `serializers.py`: Data serialization for API responses
- `urls.py`: URL routing for funding endpoints
- `README.md`: Detailed documentation of the module

#### 2. Items Module
Location: `bio-inventory-backend/items/`

Manages laboratory inventory items with:
- Item creation and tracking
- Expiration date management
- Association with funding sources

Key files:
- `models.py`: Item model definition
- `views.py`: Item management API endpoints
- `serializers.py`: Data serialization

#### 3. Requests Module
Location: `bio-inventory-backend/requests/`

Handles purchase requests with:
- Request creation and approval workflow
- Integration with funding system
- Request history tracking

Key files:
- `models.py`: Request model definition
- `views.py`: Request management API endpoints
- `funding_integration.py`: Integration with funding module

#### 4. Users Module
Location: `bio-inventory-backend/users/`

Manages user authentication and permissions:
- User registration and authentication
- Role-based access control
- User profile management

### Management Commands

Each module includes custom management commands for administrative tasks:
- `funding/management/commands/`: Funding data management
- `items/management/commands/`: Item data management

### Data Models

The backend uses Django's ORM with the following key models:
1. **Fund**: Represents funding sources with budget tracking
2. **Transaction**: Records financial transactions linked to funds
3. **Item**: Represents inventory items
4. **Request**: Represents purchase requests
5. **User**: User authentication and profile information

## Frontend Structure (React)

Location: `bio-inventory-frontend/src/`

### Main Components

- **App.tsx**: Main application component
- **MainApp.tsx**: Primary application layout with routing
- **index.tsx**: Entry point

### Pages

- **FundingPage.tsx**: Main funding management interface
- **InventoryPage.tsx**: Inventory item management
- **RequestsPage.tsx**: Purchase request management
- **UserManagementPage.tsx**: User administration
- **ReportsPage.tsx**: Analytics and reporting
- **LoginPage.tsx**: User authentication

### Components

#### General Components
- `Header.tsx`: Application header/navigation
- `AlertsBanner.tsx`: System alerts display
- Various table and sidebar components

#### Funding Components
Located in `src/components/funding/`:
- `FundManagement.tsx`: Fund creation and management
- `TransactionRecords.tsx`: Financial transaction tracking
- `BudgetReports.tsx`: Financial analytics and reporting
- `ArchivedFunds.tsx`: Management of archived funds
- `CarryOverManagement.tsx`: Budget carry-over functionality

### Modals

Reusable modal dialogs in `src/modals/`:
- `FundModal.tsx`: Fund creation/editing
- `FundSelectionModal.tsx`: Funding source selection
- Various other form and confirmation modals

## Key Features

### Funding Management
- Multi-grant support
- Real-time budget control
- Transaction tracking
- Analytics and reporting
- Compliance features

### Inventory Management
- Item tracking with expiration dates
- Category-based organization
- Search and filtering capabilities

### Request System
- Purchase request workflow
- Approval processes
- Integration with funding system

### User Management
- Role-based access control
- Authentication system
- User profile management

## API Endpoints

The backend provides RESTful API endpoints organized by module:
- `/api/funds/`: Funding management
- `/api/transactions/`: Transaction tracking
- `/api/items/`: Inventory management
- `/api/requests/`: Purchase requests
- `/api/users/`: User management

## Development Setup

### Backend
1. Install Python dependencies: `pip install -r requirements.txt`
2. Run migrations: `python manage.py migrate`
3. Start server: `python manage.py runserver`

### Frontend
1. Install Node dependencies: `npm install`
2. Start development server: `npm start`

## Data Management

The system includes several management commands for data operations:
- `create_sample_funding`: Generate test funding data
- `create_mock_data`: Generate test inventory data
- Various data validation and integrity commands

This structure provides a comprehensive laboratory inventory management system with integrated financial tracking capabilities.