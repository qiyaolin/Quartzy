# Quartzy Backend - Django REST API

Backend service for the Quartzy Bio-Inventory Management System.

## 🛠️ Setup

### 1. Create Virtual Environment

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Environment Configuration

Create a `.env` file in the backend root:

```env
DEBUG=True
SECRET_KEY=your-very-secret-key-here-change-in-production
DATABASE_URL=sqlite:///db.sqlite3
ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### 4. Database Setup

```bash
# Run migrations
python manage.py migrate

# Create superuser account
python manage.py createsuperuser

# Load sample data (optional)
python manage.py create_mock_data
```

### 5. Start Development Server

```bash
python manage.py runserver
```

The API will be available at `http://localhost:8000/api/`

## 📚 API Documentation

### Authentication

The API uses token-based authentication. After creating a user account, obtain a token:

```bash
curl -X POST http://localhost:8000/api-token-auth/ \
     -H "Content-Type: application/json" \
     -d '{"username": "your_username", "password": "your_password"}'
```

Include the token in subsequent requests:

```bash
curl -H "Authorization: Token your-token-here" http://localhost:8000/api/items/
```

### Main Endpoints

- **Items**: `/api/items/` - Inventory management
- **Requests**: `/api/requests/` - Request system
- **Funding**: `/api/funding/` - Budget and fund management
- **Users**: `/api/users/` - User management
- **Notifications**: `/api/notifications/` - Notification system
- **Settings**: `/api/settings/` - System configuration

### Admin Panel

Access the Django admin panel at `http://localhost:8000/admin/` using your superuser credentials.

## 🗄️ Database Models

### Items App
- **Item**: Laboratory inventory items with expiration tracking

### Requests App  
- **Request**: Purchase requests with funding integration
- **RequestHistory**: Audit trail for request changes

### Funding App
- **Fund**: Budget management and allocation
- **Transaction**: Financial transaction records

### Users App
- **User**: Extended Django user model

### Notifications App
- **Notification**: System and inventory alerts

### Settings App
- **SystemSetting**: System-wide configuration
- **UserPreference**: User-specific preferences

## 🔧 Management Commands

### Create Mock Data
```bash
python manage.py create_mock_data
```
Generates sample data for testing:
- 10 users (including admin)
- 50 inventory items
- 30 requests
- 10 funds
- Various notifications

### Check Inventory Alerts
```bash
python manage.py check_inventory_alerts
```
Scans inventory for expiring items and low stock alerts.

## 🧪 Testing

Run the test suite:

```bash
# Run all tests
python manage.py test

# Run tests for specific app
python manage.py test items

# Run with coverage (if installed)
coverage run --source='.' manage.py test
coverage report
```

## 🚀 Production Deployment

### 1. Environment Variables

```env
DEBUG=False
SECRET_KEY=your-production-secret-key-minimum-32-characters
DATABASE_URL=postgresql://user:password@localhost:5432/quartzy_db
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
CORS_ALLOWED_ORIGINS=https://yourdomain.com
EMAIL_HOST=smtp.your-email-provider.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@domain.com
EMAIL_HOST_PASSWORD=your-email-password
```

### 2. Database Setup

For PostgreSQL:

```bash
# Install PostgreSQL adapter
pip install psycopg2-binary

# Set DATABASE_URL in .env
DATABASE_URL=postgresql://user:password@localhost:5432/quartzy_db
```

### 3. Static Files

```bash
# Collect static files
python manage.py collectstatic
```

### 4. Production Server

Use a production WSGI server like Gunicorn:

```bash
pip install gunicorn
gunicorn core.wsgi:application --bind 0.0.0.0:8000
```

## 🔒 Security Considerations

- Change `SECRET_KEY` in production
- Set `DEBUG=False` in production
- Use HTTPS in production
- Configure proper `ALLOWED_HOSTS`
- Use environment variables for sensitive data
- Regular security updates for dependencies

## 📊 API Response Formats

All API responses follow consistent patterns:

### Success Response
```json
{
  "count": 25,
  "next": "http://localhost:8000/api/items/?page=2",
  "previous": null,
  "results": [...]
}
```

### Error Response
```json
{
  "error": "Invalid request",
  "details": {
    "field_name": ["This field is required."]
  }
}
```

## 🔍 Debugging

### Enable Debug Logging

Add to `settings.py`:

```python
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
        },
    },
}
```

### Common Issues

1. **CORS Errors**: Ensure `CORS_ALLOWED_ORIGINS` includes your frontend URL
2. **Token Authentication**: Verify token format: `Token your-token-here`
3. **Database Migrations**: Run `python manage.py migrate` after model changes
4. **Static Files**: Run `python manage.py collectstatic` if admin styles are missing

## 📝 Development Notes

- Follow Django REST Framework conventions
- Use Django's built-in permissions system
- Implement proper error handling and validation
- Write tests for new features
- Keep dependencies updated and secure