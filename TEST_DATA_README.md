# Bio-Inventory Simulated Test Data

This repository contains high-quality simulated test data for the bio-inventory management system. The data is designed to be realistic, diverse, and directly usable in test environments.

## 📊 Data Overview

The simulated data includes **55 total entries** across **11 different models**:

| Model | Entries | Description |
|-------|---------|-------------|
| **Users** | 5 | System users with different permission levels |
| **Vendors** | 5 | Major life science suppliers (Thermo Fisher, Sigma-Aldrich, etc.) |
| **Locations** | 5 | Laboratory storage locations with hierarchical structure |
| **Item Types** | 5 | Categories of lab items with custom field schemas |
| **Items** | 5 | Diverse inventory items with complete metadata |
| **Requests** | 5 | Purchase requests in various status states |
| **Request History** | 5 | Status change tracking for requests |
| **Funds** | 5 | Research grants and funding sources |
| **Transactions** | 5 | Financial transactions linked to purchases |
| **Budget Allocations** | 5 | Budget categories with spending tracking |
| **Funding Reports** | 5 | Financial reports with summary analytics |

## ✅ Data Quality Features

### Field Type Compliance
- All data strictly matches Django model field types
- Proper data types: strings, integers, decimals, dates, booleans, JSON
- Correct field constraints and validation rules

### Realistic Formatting
- **Dates**: Proper ISO format with realistic ranges (2023-2027)
- **Decimals**: Appropriate precision for prices and quantities
- **URLs**: Valid vendor websites and product pages
- **Emails**: Proper university email format
- **Serial Numbers**: Consistent ITM-xxxxxxxx format

### Appropriate Value Ranges
- **Prices**: $28.75 - $320.00 (realistic lab supply costs)
- **Quantities**: 0.5 - 2500 units (appropriate for different item types)
- **Budgets**: $25K - $500K (typical research grant ranges)
- **Dates**: Logical progression from creation to expiration

### Data Diversity
- **5 different item types**: Antibodies, Plasmids, Chemicals, Enzymes, Cell Lines
- **Multiple storage conditions**: -80°C, -20°C, 4°C, Room Temperature
- **Various request statuses**: NEW, APPROVED, ORDERED, RECEIVED, REJECTED
- **Different fund sources**: NIH, NSF, Industry, University
- **Mixed user permissions**: Superuser, Staff, Regular users

### Authenticity
- **Real vendor names**: Thermo Fisher Scientific, Sigma-Aldrich, NEB, Bio-Rad, Promega
- **Actual catalog numbers**: Based on real product catalogs
- **Scientific accuracy**: Proper molecular biology terminology and workflows
- **Laboratory realism**: Authentic storage conditions and usage patterns

## 🚀 Quick Start

### Method 1: Django Management Command (Recommended)

```bash
# Navigate to the Django project directory
cd bio-inventory-backend

# Load test data with clearing existing data
python manage.py load_test_data --clear

# Load test data without clearing (append mode)
python manage.py load_test_data
```

### Method 2: Direct Python Script

```bash
# Run the standalone loader script
cd bio-inventory-backend
python load_test_data.py
```

### Method 3: Import in Your Code

```python
from simulated_test_data import VENDOR_DATA, ITEM_DATA, USER_DATA
# Use the data dictionaries in your tests or scripts
```

## 👥 Test User Accounts

All test users have the password: `testpass123`

| Username | Role | Permissions | Email |
|----------|------|-------------|-------|
| `sarah.johnson` | Principal Investigator | Superuser | sarah.johnson@university.edu |
| `michael.chen` | Faculty Member | Staff | michael.chen@university.edu |
| `lab.manager` | Lab Manager | Staff | lab.manager@university.edu |
| `emily.rodriguez` | Postdoc | Regular | emily.rodriguez@university.edu |
| `alex.thompson` | Graduate Student | Regular | alex.thompson@university.edu |

## 📋 Sample Data Examples

### Inventory Items
- **Anti-β-Actin Antibody** (Thermo Fisher) - $285.00, stored at 4°C
- **pUC19 Cloning Vector** (Sigma-Aldrich) - $125.50, stored at -80°C
- **Tris-HCl Buffer** (NEB) - $45.75, room temperature storage
- **EcoRI Restriction Enzyme** (Bio-Rad) - $195.00, stored at -20°C
- **HEK293T Cell Line** (Promega) - $320.00, stored at -80°C

### Research Funds
- **NIH Grant R01-GM123456** - $250K total, $87.5K spent
- **NSF Career Award** - $500K total, $125K spent
- **Industry Collaboration Fund** - $150K total, $45K spent
- **Department Startup Fund** - $75K total, $72.5K spent (archived)
- **Equipment Maintenance Fund** - $25K total, $8.75K spent

### Purchase Requests
- Anti-GFP Antibody (NEW status) - $245.00
- PCR Master Mix (APPROVED status) - $89.50
- DMSO Solvent (ORDERED status) - $28.75
- Protein Ladder (RECEIVED status) - $125.00
- Cell Culture Flask (REJECTED status) - $3.25

## 🔗 Referential Integrity

The data maintains proper foreign key relationships:

- **Items** → linked to Vendors, Locations, Item Types, Users, Funds
- **Requests** → linked to Users, Vendors, Item Types, Funds
- **Transactions** → linked to Funds and Users
- **Budget Allocations** → linked to Funds
- **Funding Reports** → linked to Users and multiple Funds
- **Request History** → linked to Requests and Users

## 🧪 Testing Scenarios

The data supports various testing scenarios:

### Inventory Management
- Items with different expiration statuses (good, expiring soon, expired)
- Low stock alerts and threshold testing
- Multi-level location hierarchy
- Custom properties for different item types

### Request Workflow
- Complete request lifecycle from NEW to RECEIVED
- Status change history tracking
- Budget validation and fund allocation
- Approval workflow testing

### Financial Tracking
- Budget utilization calculations
- Transaction history and reporting
- Fund allocation and spending limits
- Multi-fund project tracking

### User Permissions
- Role-based access control testing
- Different user permission levels
- Ownership and access restrictions

## 📁 File Structure

```
├── simulated_test_data.py              # Main data file with all test data
├── bio-inventory-backend/
│   ├── load_test_data.py              # Standalone loader script
│   └── items/management/commands/
│       └── load_test_data.py          # Django management command
└── TEST_DATA_README.md                # This documentation file
```
# Bio-Inventory Simulated Test Data

This repository contains high-quality simulated test data for the bio-inventory management system. The data is designed to be realistic, diverse, and directly usable in test environments.

## 📊 Data Overview

The simulated data includes **55 total entries** across **11 different models**:

| Model | Entries | Description |
|-------|---------|-------------|
| **Users** | 5 | System users with different permission levels |
| **Vendors** | 5 | Major life science suppliers (Thermo Fisher, Sigma-Aldrich, etc.) |
| **Locations** | 5 | Laboratory storage locations with hierarchical structure |
| **Item Types** | 5 | Categories of lab items with custom field schemas |
| **Items** | 5 | Diverse inventory items with complete metadata |
| **Requests** | 5 | Purchase requests in various status states |
| **Request History** | 5 | Status change tracking for requests |
| **Funds** | 5 | Research grants and funding sources |
| **Transactions** | 5 | Financial transactions linked to purchases |
| **Budget Allocations** | 5 | Budget categories with spending tracking |
| **Funding Reports** | 5 | Financial reports with summary analytics |

## ✅ Data Quality Features

### Field Type Compliance
- All data strictly matches Django model field types
- Proper data types: strings, integers, decimals, dates, booleans, JSON
- Correct field constraints and validation rules

### Realistic Formatting
- **Dates**: Proper ISO format with realistic ranges (2023-2027)
- **Decimals**: Appropriate precision for prices and quantities
- **URLs**: Valid vendor websites and product pages
- **Emails**: Proper university email format
- **Serial Numbers**: Consistent ITM-xxxxxxxx format

### Appropriate Value Ranges
- **Prices**: $28.75 - $320.00 (realistic lab supply costs)
- **Quantities**: 0.5 - 2500 units (appropriate for different item types)
- **Budgets**: $25K - $500K (typical research grant ranges)
- **Dates**: Logical progression from creation to expiration

### Data Diversity
- **5 different item types**: Antibodies, Plasmids, Chemicals, Enzymes, Cell Lines
- **Multiple storage conditions**: -80°C, -20°C, 4°C, Room Temperature
- **Various request statuses**: NEW, APPROVED, ORDERED, RECEIVED, REJECTED
- **Different fund sources**: NIH, NSF, Industry, University
- **Mixed user permissions**: Superuser, Staff, Regular users

### Authenticity
- **Real vendor names**: Thermo Fisher Scientific, Sigma-Aldrich, NEB, Bio-Rad, Promega
- **Actual catalog numbers**: Based on real product catalogs
- **Scientific accuracy**: Proper molecular biology terminology and workflows
- **Laboratory realism**: Authentic storage conditions and usage patterns

## 🚀 Quick Start

### Method 1: Django Management Command (Recommended)

```bash
# Navigate to the Django project directory
cd bio-inventory-backend

# Load test data with clearing existing data
python manage.py load_test_data --clear

# Load test data without clearing (append mode)
python manage.py load_test_data
```

### Method 2: Direct Python Script

```bash
# Run the standalone loader script
cd bio-inventory-backend
python load_test_data.py
```

### Method 3: Import in Your Code

```python
from simulated_test_data import VENDOR_DATA, ITEM_DATA, USER_DATA
# Use the data dictionaries in your tests or scripts
```

## 👥 Test User Accounts

All test users have the password: `testpass123`

| Username | Role | Permissions | Email |
|----------|------|-------------|-------|
| `sarah.johnson` | Principal Investigator | Superuser | sarah.johnson@university.edu |
| `michael.chen` | Faculty Member | Staff | michael.chen@university.edu |
| `lab.manager` | Lab Manager | Staff | lab.manager@university.edu |
| `emily.rodriguez` | Postdoc | Regular | emily.rodriguez@university.edu |
| `alex.thompson` | Graduate Student | Regular | alex.thompson@university.edu |

## 📋 Sample Data Examples

### Inventory Items
- **Anti-β-Actin Antibody** (Thermo Fisher) - $285.00, stored at 4°C
- **pUC19 Cloning Vector** (Sigma-Aldrich) - $125.50, stored at -80°C
- **Tris-HCl Buffer** (NEB) - $45.75, room temperature storage
- **EcoRI Restriction Enzyme** (Bio-Rad) - $195.00, stored at -20°C
- **HEK293T Cell Line** (Promega) - $320.00, stored at -80°C

### Research Funds
- **NIH Grant R01-GM123456** - $250K total, $87.5K spent
- **NSF Career Award** - $500K total, $125K spent
- **Industry Collaboration Fund** - $150K total, $45K spent
- **Department Startup Fund** - $75K total, $72.5K spent (archived)
- **Equipment Maintenance Fund** - $25K total, $8.75K spent

### Purchase Requests
- Anti-GFP Antibody (NEW status) - $245.00
- PCR Master Mix (APPROVED status) - $89.50
- DMSO Solvent (ORDERED status) - $28.75
- Protein Ladder (RECEIVED status) - $125.00
- Cell Culture Flask (REJECTED status) - $3.25

## 🔗 Referential Integrity

The data maintains proper foreign key relationships:

- **Items** → linked to Vendors, Locations, Item Types, Users, Funds
- **Requests** → linked to Users, Vendors, Item Types, Funds
- **Transactions** → linked to Funds and Users
- **Budget Allocations** → linked to Funds
- **Funding Reports** → linked to Users and multiple Funds
- **Request History** → linked to Requests and Users

## 🧪 Testing Scenarios

The data supports various testing scenarios:

### Inventory Management
- Items with different expiration statuses (good, expiring soon, expired)
- Low stock alerts and threshold testing
- Multi-level location hierarchy
- Custom properties for different item types

### Request Workflow
- Complete request lifecycle from NEW to RECEIVED
- Status change history tracking
- Budget validation and fund allocation
- Approval workflow testing

### Financial Tracking
- Budget utilization calculations
- Transaction history and reporting
- Fund allocation and spending limits
- Multi-fund project tracking

### User Permissions
- Role-based access control testing
- Different user permission levels
- Ownership and access restrictions


## 🛠️ Customization

To modify the test data:

1. **Edit `simulated_test_data.py`** - Update data dictionaries
2. **Maintain relationships** - Ensure foreign key references are correct
3. **Follow field constraints** - Respect model validation rules
4. **Test data integrity** - Validate after modifications

## 🔍 Data Validation

The data has been validated for:

- ✅ Django model field type compliance
- ✅ Foreign key relationship integrity
- ✅ Realistic value ranges and formats
- ✅ Proper date sequences and logic
- ✅ Scientific accuracy and terminology
- ✅ Database insertion compatibility

## 📞 Support

If you encounter issues with the test data:

1. Check Django model definitions for field requirements
2. Verify foreign key relationships are properly maintained
3. Ensure all required dependencies are installed
4. Review error messages for specific field validation issues

## 🎯 Use Cases

This test data is perfect for:

- **Development testing** - Realistic data for feature development
- **User acceptance testing** - Authentic scenarios for stakeholder review
- **Performance testing** - Sufficient data volume for basic performance tests
- **Demo environments** - Professional-looking data for demonstrations
- **Training** - Realistic examples for user training sessions

---

*Generated for Bio-Inventory Management System - High-quality simulated data for comprehensive testing*