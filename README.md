# Quartzy - Bio-Inventory Management System

A comprehensive laboratory inventory management system built with Django REST Framework and React TypeScript.

## 🧬 Features

- **Inventory Management**: Track laboratory items, expiration dates, and stock levels
- **Request System**: Complete workflow from request creation to receipt
- **Funding Integration**: Budget tracking and fund allocation
- **User Management**: Role-based access control
- **Real-time Notifications**: Inventory alerts and system notifications
- **Multi-language Support**: English, French, Chinese
- **Theme Support**: Light, dark, and auto themes
- **Data Export**: Excel export capabilities
- **Comprehensive Reporting**: Analytics and budget reports

## 🚀 Quick Start

### Prerequisites

- Python 3.8+ 
- Node.js 16+
- npm or yarn

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/quartzy.git
cd quartzy
```

### 2. Backend Setup

```bash
cd bio-inventory-backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Create superuser (admin account)
python manage.py createsuperuser

# Load sample data (optional)
python manage.py create_mock_data

# Start backend server
python manage.py runserver
```

The backend will be available at `http://localhost:8000`

### 3. Frontend Setup

```bash
cd bio-inventory-frontend

# Install dependencies
npm install

# Start frontend development server
npm start
```

The frontend will be available at `http://localhost:3000`

## 🐳 Docker Setup (Alternative)

For easier setup, use Docker:

```bash
# Build and start all services
docker-compose up --build

# Create superuser (in a new terminal)
docker-compose exec backend python manage.py createsuperuser

# Load sample data (optional)
docker-compose exec backend python manage.py create_mock_data
```

Access the application at `http://localhost:3000`

## 📁 Project Structure

```
quartzy/
├── bio-inventory-backend/     # Django REST API
│   ├── core/                 # Main Django configuration
│   ├── items/                # Inventory management
│   ├── requests/             # Request system
│   ├── funding/              # Budget and fund management
│   ├── users/                # User management
│   ├── notifications/        # Notification system
│   └── settings/             # System configuration
├── bio-inventory-frontend/    # React TypeScript app
│   ├── public/               # Static assets
│   └── src/                  # Source code
│       ├── components/       # Reusable components
│       ├── pages/           # Page components
│       ├── modals/          # Modal components
│       └── utils/           # Utility functions
└── docs/                     # Documentation
```

## 🔧 Configuration

### Environment Variables

Create `.env` files in both backend and frontend directories:

**Backend (.env)**:
```
DEBUG=True
SECRET_KEY=your-secret-key-here
DATABASE_URL=sqlite:///db.sqlite3
ALLOWED_HOSTS=localhost,127.0.0.1
```

**Frontend (.env)**:
```
REACT_APP_API_BASE_URL=http://localhost:8000/api
```

## 📖 API Documentation

Once the backend is running, visit:
- **API Root**: `http://localhost:8000/api/`
- **Admin Panel**: `http://localhost:8000/admin/`

### Main API Endpoints

- `/api/items/` - Inventory management
- `/api/requests/` - Request management  
- `/api/funding/` - Fund and budget management
- `/api/users/` - User management
- `/api/notifications/` - Notification system
- `/api/settings/` - System settings and preferences

## 🧪 Testing

### Backend Tests
```bash
cd bio-inventory-backend
python manage.py test
```

### Frontend Tests
```bash
cd bio-inventory-frontend
npm test
```

## 👥 User Roles

1. **Regular Users**: Can manage their own items and requests
2. **Staff**: Additional permissions for managing other users' data
3. **Admin**: Full system access including settings management

## 🔒 Authentication

The system uses token-based authentication. After login, include the token in API requests:

```
Authorization: Token your-token-here
```

## 🌍 Internationalization

The system supports multiple languages:
- English (default)
- French
- Chinese

Language can be changed in user preferences.

## 🎨 Theming

Three theme options available:
- Light theme
- Dark theme  
- Auto (follows system preference)

## 📊 Sample Data

To populate the system with sample data for testing:

```bash
cd bio-inventory-backend
python manage.py create_mock_data
```

This creates:
- Sample users
- Inventory items
- Requests
- Funding data
- Notifications

## 🚀 Deployment

### Production Setup

1. Set `DEBUG=False` in backend settings
2. Configure proper database (PostgreSQL recommended)
3. Set up static file serving
4. Configure ALLOWED_HOSTS
5. Use environment variables for sensitive data

### Environment Variables for Production

```
DEBUG=False
SECRET_KEY=your-production-secret-key
DATABASE_URL=postgresql://user:password@localhost:5432/quartzy
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🐛 Issues & Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/yourusername/quartzy/issues) page
2. Create a new issue with detailed information
3. Include steps to reproduce the problem

## 🙏 Acknowledgments

- Built with Django REST Framework and React
- UI components styled with Tailwind CSS
- Icons provided by Lucide React

---

**Happy Lab Management!** 🧪✨