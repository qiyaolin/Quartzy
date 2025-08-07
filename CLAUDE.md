# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a bio-inventory management system with a Django REST API backend, React TypeScript frontend, and DYMO printing integration. The system features mobile-responsive design with separate mobile and desktop interfaces, comprehensive inventory tracking, equipment scheduling, QR code integration, and multi-language support.

## Architecture

### Backend (Django + DRF)
- **Framework**: Django 5.2.4 + Django REST Framework 3.16.0
- **Database**: SQLite (development), PostgreSQL (production via Google Cloud SQL)
- **Authentication**: Token-based authentication (DRF TokenAuthentication)
- **Key Apps**:
  - `items`: Core inventory management
  - `inventory_requests`: Request workflow management  
  - `users`: Custom user management and authentication
  - `funding`: Financial tracking and budget management
  - `notifications`: Email notifications and alerts
  - `schedule`: Equipment scheduling with QR check-in system
  - `printing`: DYMO label printing integration

### Frontend (React + TypeScript)
- **Framework**: React 18.3.1 + TypeScript 4.9.5
- **Styling**: Tailwind CSS with custom design system
- **Architecture**: Device-aware routing (MobileApp vs DesktopApp)
- **State Management**: React Context API (AuthContext, NotificationContext)
- **Key Features**:
  - Responsive design with mobile-first approach
  - Barcode scanning with ZBar WebAssembly
  - Real-time notifications with react-hot-toast
  - Excel export capabilities with xlsx
  - Equipment QR code generation and scanning

### Design System
- Custom Tailwind configuration with semantic color palette
- Science-themed brand colors and extended spacing/typography
- Mobile-optimized touch interactions and animations
- Accessibility-focused contrast ratios and interactive states

## Development Commands

### Backend (bio-inventory-backend/)
```bash
# Setup
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser

# Development
python manage.py runserver          # Start development server (port 8000)
python manage.py test              # Run all tests
python manage.py shell             # Interactive Django shell
python manage.py makemigrations    # Create new migrations
python manage.py migrate           # Apply migrations
python manage.py collectstatic     # Collect static files for production

# Custom Management Commands
python manage.py create_mock_data           # Generate sample inventory data
python manage.py create_sample_funding      # Create funding samples
python manage.py check_inventory_alerts     # Check for inventory alerts
python manage.py generate_group_meetings    # Generate scheduled meetings
python manage.py send_meeting_reminders     # Send meeting notification emails
python manage.py test_qr_system            # Test QR code functionality
```

### Frontend (bio-inventory-frontend/)
```bash
# Setup
npm install

# Development
npm start                    # Start development server (port 3000)
npm test                     # Run Jest tests
npm run build               # Build for production
npm run eject               # Eject from Create React App (irreversible)

# Firebase Deployment
npm run predeploy           # Build before deploy
npm run deploy              # Deploy to Firebase Hosting
npm run deploy:preview      # Deploy to preview channel
```

### Printing Server (dymo-print-server-nodejs/)
```bash
# Setup and run printing agent
python src/production_print_agent.py
```

## Key Architectural Patterns

### Device-Aware Architecture
The frontend automatically detects device type and renders appropriate interfaces:
- `MainApp.tsx` → routes to `MobileApp.tsx` or `DesktopApp.tsx`
- Mobile components in `src/components/mobile/` with touch-optimized interactions
- Shared components with responsive behavior via Tailwind breakpoints

### Django App Structure
Each Django app follows a consistent pattern:
- `models.py`: Database models with relationships
- `serializers.py`: DRF serializers for API responses
- `views.py`: API viewsets and business logic
- `urls.py`: URL routing with API versioning
- `filters.py`: django-filter integration for query filtering
- `signals.py`: Django signals for automated workflows

### Authentication Flow
- Token-based authentication with `rest_framework.authtoken`
- `AuthContext` manages frontend authentication state
- `CustomAuthToken` view handles login with enhanced user data
- Protected routes automatically redirect to login page

### API Design
- RESTful endpoints following DRF conventions
- Consistent error handling with proper HTTP status codes
- Django-filter integration for complex querying
- CORS configured for development and production domains

### Mobile-First Responsive Design
- Tailwind's mobile-first breakpoint system
- Custom breakpoints: `mobile` (max-width: 767px), `tablet`, `desktop`
- Touch-specific styles using `hover:` variants for desktop-only interactions
- Separate mobile components for complex UI patterns

## Environment Configuration

### Backend Environment Variables
- `DEBUG`: Development mode (default: False)
- `SECRET_KEY`: Django secret key
- `ALLOWED_HOSTS`: Comma-separated allowed hosts
- `DB_USER`, `DB_PASS`, `DB_NAME`: Database credentials
- `INSTANCE_CONNECTION_NAME`: Google Cloud SQL instance
- `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`: SMTP credentials
- `CORS_ALLOWED_ORIGINS`: Allowed CORS origins for production
- `FRONTEND_URL`: Frontend URL for email links

### Database Configuration
- Development: SQLite (`db.sqlite3`)
- Production: PostgreSQL via Google Cloud SQL with Unix socket connection
- Automatic environment detection via `GAE_ENV` variable

### CORS & Security
- Development CORS: localhost:3000, 127.0.0.1:3000
- Production CORS: Firebase Hosting and App Engine domains
- Production security headers: HSTS, XSS protection, secure cookies

## Testing

### Backend Testing
- Django's built-in testing framework
- Test files in each app's `tests.py`
- Run specific app tests: `python manage.py test <app_name>`

### Frontend Testing  
- Jest + React Testing Library setup
- Test files: `src/**/__tests__/*.test.ts`
- Component tests in `src/utils/__tests__/`

## Common Development Patterns

### Adding New Django App Features
1. Create models in `models.py` with proper relationships
2. Create serializers in `serializers.py` for API responses  
3. Implement ViewSets in `views.py` with proper permissions
4. Add URL patterns in `urls.py` and include in main `core/urls.py`
5. Create migrations: `python manage.py makemigrations <app_name>`
6. Apply migrations: `python manage.py migrate`

### Adding Frontend Components
1. Place reusable components in `src/components/`
2. Mobile-specific components go in `src/components/mobile/`
3. Use TypeScript interfaces for props and data structures
4. Follow Tailwind naming conventions for styling
5. Implement error boundaries for robust error handling

### API Integration Pattern
1. Define API endpoints in `src/config/api.ts`
2. Create service functions for API calls
3. Use async/await with proper error handling
4. Integrate with React context for state management
5. Handle loading states and user feedback

## Deployment

### Backend Deployment (Google App Engine)
- Configuration in `app.yaml` with environment variables
- Static files served via `collectstatic`
- Database migrations run via startup scripts
- Health check endpoints: `/health/`, `/ready/`

### Frontend Deployment (Firebase Hosting)
- Build production bundle with `npm run build`
- Deploy with Firebase CLI: `firebase deploy --only hosting`
- Environment-specific configuration for API URLs

## Notable Features & Integrations

### QR Code System
- Equipment QR code generation and scanning
- Check-in/check-out workflow with time tracking
- Usage logging and analytics

### Email Notification System  
- SMTP configuration for automated emails
- Template-based notifications in `templates/notifications/emails/`
- Inventory alerts, meeting reminders, and system notifications

### Barcode Integration
- ZBar WebAssembly for barcode scanning
- DYMO Connect Framework for label printing
- Print server integration with queue management

### Mobile Optimization
- Touch-optimized interfaces and animations
- Mobile-specific modals and drawers
- Speed dial floating action button for common actions
- Responsive tables and cards for mobile viewing