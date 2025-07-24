# Dependencies Documentation

This document explains the key dependencies used in the Quartzy Bio-Inventory Management System.

## Backend Dependencies (Django)

### Core Dependencies
- **Django (5.2.4)**: Web framework
- **djangorestframework (3.16.0)**: REST API framework
- **django-cors-headers (4.7.0)**: CORS handling for frontend
- **django-filter (24.2)**: Advanced filtering for API endpoints

### Database
- **psycopg2-binary (2.9.10)**: PostgreSQL adapter

### Performance & Caching
- **redis (5.2.1)**: In-memory data store for caching
- **django-redis (5.4.0)**: Django Redis integration

### Production Server
- **gunicorn (23.0.0)**: WSGI HTTP server
- **whitenoise (6.6.0)**: Static file serving

### Security
- **django-ratelimit (5.0.0)**: Rate limiting for API endpoints
- **djangorestframework-simplejwt (5.3.0)**: JWT authentication

### File Processing
- **Pillow (10.3.0)**: Image processing
- **openpyxl (3.1.2)**: Excel file reading/writing
- **xlsxwriter (3.2.0)**: Excel file creation with formatting

### Utilities
- **python-decouple (3.8)**: Environment variable management
- **python-dateutil (2.9.0)**: Date/time utilities
- **django-phonenumber-field (7.3.0)**: Phone number validation
- **phonenumbers (8.13.33)**: Phone number parsing

### API Documentation
- **drf-spectacular (0.27.2)**: OpenAPI schema generation

### Development & Testing
- **django-extensions (3.2.3)**: Development utilities
- **django-debug-toolbar (4.3.0)**: Debug information
- **coverage (7.4.4)**: Test coverage

### Monitoring
- **sentry-sdk[django] (1.45.0)**: Error tracking and monitoring

### Background Tasks (Optional)
- **celery (5.3.6)**: Distributed task queue
- **django-celery-beat (2.6.0)**: Periodic task scheduler

### Email
- **django-anymail (10.3)**: Email service integration

## Frontend Dependencies (React/TypeScript)

### Core Framework
- **react (18.3.1)**: Core React library
- **react-dom (18.3.1)**: React DOM bindings
- **typescript (5.6.3)**: TypeScript support
- **react-scripts (5.0.1)**: Create React App build tools

### Routing
- **react-router-dom (6.22.3)**: Client-side routing
- **@types/react-router-dom (5.3.3)**: TypeScript types

### Styling
- **tailwindcss (3.4.3)**: Utility-first CSS framework
- **@tailwindcss/forms (0.5.7)**: Form styling utilities
- **@tailwindcss/typography (0.5.12)**: Typography utilities
- **autoprefixer (10.4.19)**: CSS vendor prefixes
- **postcss (8.4.38)**: CSS processor
- **clsx (2.1.1)**: Conditional CSS classes

### UI Components & Icons
- **lucide-react (0.460.0)**: Icon library
- **framer-motion (11.1.7)**: Animation library

### Data Management
- **axios (1.6.8)**: HTTP client
- **react-query (3.39.3)**: Server state management
- **react-hook-form (7.51.3)**: Form handling
- **@hookform/resolvers (3.3.4)**: Form validation resolvers
- **yup (1.4.0)**: Schema validation

### Data Visualization
- **react-chartjs-2 (5.2.0)**: Chart.js React wrapper
- **chart.js (4.4.2)**: Charting library

### File Handling
- **xlsx (0.18.5)**: Excel file processing
- **@types/xlsx (0.0.36)**: TypeScript types
- **react-dropzone (14.2.3)**: File drag & drop
- **@types/react-dropzone (5.1.0)**: TypeScript types

### Internationalization
- **react-i18next (14.1.0)**: React i18n integration
- **i18next (23.11.2)**: Internationalization framework
- **i18next-browser-languagedetector (7.2.1)**: Language detection

### Performance Optimization
- **react-window (1.8.8)**: Virtual scrolling
- **react-virtual (2.10.4)**: Alternative virtual scrolling
- **react-memo (1.0.0)**: Memoization utilities

### Utilities
- **date-fns (3.6.0)**: Date manipulation
- **lodash.debounce (4.0.8)**: Function debouncing
- **@types/lodash.debounce (4.0.9)**: TypeScript types

### Notifications
- **react-hot-toast (2.5.2)**: Toast notifications

### Service Worker
- **workbox-core (7.1.0)**: Service worker utilities
- **workbox-expiration (7.1.0)**: Cache expiration
- **workbox-precaching (7.1.0)**: Precaching strategies
- **workbox-routing (7.1.0)**: Request routing  
- **workbox-strategies (7.1.0)**: Caching strategies

### Testing
- **@testing-library/jest-dom (5.17.0)**: Jest DOM matchers
- **@testing-library/react (16.0.1)**: React testing utilities
- **@testing-library/user-event (14.5.2)**: User interaction simulation

### Development Dependencies
- **eslint**: Code linting
- **prettier**: Code formatting
- **@typescript-eslint/**: TypeScript ESLint integration
- **webpack-bundle-analyzer**: Bundle size analysis

## Development Dependencies

### Backend Development
See `requirements-dev.txt` for additional development dependencies including:
- **pytest**: Testing framework
- **black**: Code formatting
- **flake8**: Linting
- **mypy**: Type checking

### Frontend Development
Development dependencies are included in `package.json` devDependencies section.

## Installation

### Backend
```bash
# Production
pip install -r requirements.txt

# Development
pip install -r requirements-dev.txt
```

### Frontend
```bash
npm install
```

## Version Management

Dependencies are pinned to specific versions for stability. Regular updates should be performed with careful testing:

1. **Security Updates**: Apply immediately when available
2. **Minor Updates**: Test thoroughly before deploying
3. **Major Updates**: Plan migration and test extensively

## Optional Dependencies

Some dependencies are marked as optional and can be excluded for simpler deployments:
- **Redis/Caching**: Can use Django's default cache backend
- **Celery**: For background tasks (can be replaced with simple async views)
- **Sentry**: For error monitoring (development can use Django logging)
- **Service Workers**: PWA features (can be disabled)

## Troubleshooting

### Common Issues
1. **psycopg2-binary**: If installation fails, install PostgreSQL dev headers
2. **Pillow**: Requires system image libraries (JPEG, PNG support)
3. **Node modules**: Clear `node_modules` and reinstall if issues persist
4. **Python version**: Ensure Python 3.8+ is used
5. **Node version**: Ensure Node.js 16+ is used

### Performance Considerations
- **Redis**: Significantly improves caching performance
- **react-window**: Essential for large data sets
- **Webpack optimization**: Use production build for deployment
- **Image optimization**: Consider using WebP format with Pillow