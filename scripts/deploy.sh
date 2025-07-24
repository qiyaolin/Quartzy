#!/bin/bash

# Quartzy Bio-Inventory System Deployment Script
set -e

echo "🚀 Starting Quartzy deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKEND_DIR="bio-inventory-backend"
FRONTEND_DIR="bio-inventory-frontend"
ENV_FILE=".env"

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if environment file exists
if [ ! -f "$BACKEND_DIR/$ENV_FILE" ]; then
    print_warning "Environment file not found. Creating from example..."
    cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/$ENV_FILE"
    print_warning "Please update $BACKEND_DIR/$ENV_FILE with your configuration"
fi

# Backend deployment
echo "📦 Deploying backend..."
cd $BACKEND_DIR

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    print_status "Creating virtual environment..."
    python -m venv venv
fi

# Activate virtual environment
print_status "Activating virtual environment..."
source venv/bin/activate || source venv/Scripts/activate

# Install dependencies
print_status "Installing Python dependencies..."
pip install -r requirements.txt

# Run migrations
print_status "Running database migrations..."
python manage.py migrate

# Create logs directory
mkdir -p logs

# Optimize database
print_status "Optimizing database..."
python manage.py optimize_db --clear-cache --analyze-tables

# Collect static files (for production)
if [ "$1" = "production" ]; then
    print_status "Collecting static files..."
    python manage.py collectstatic --noinput
fi

# Create superuser if none exists
print_status "Checking for superuser..."
python manage.py shell -c "
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(is_superuser=True).exists():
    print('Creating superuser...')
    User.objects.create_superuser('admin', 'admin@example.com', 'admin123')
    print('Superuser created: admin/admin123')
else:
    print('Superuser already exists')
"

cd ..

# Frontend deployment
echo "🎨 Deploying frontend..."
cd $FRONTEND_DIR

# Install Node.js dependencies
print_status "Installing Node.js dependencies..."
npm install

# Build frontend
if [ "$1" = "production" ]; then
    print_status "Building production frontend..."
    npm run build
else
    print_status "Building development frontend..."
    npm run build
fi

# Type check
print_status "Running TypeScript type check..."
npm run type-check

cd ..

# Final steps
print_status "Setting up system services..."

# Create systemd service files for production
if [ "$1" = "production" ]; then
    echo "Creating systemd service files..."
    
    # Backend service
    cat > /tmp/quartzy-backend.service << EOF
[Unit]
Description=Quartzy Bio-Inventory Backend
After=network.target postgresql.service

[Service]
Type=forking
User=www-data
Group=www-data
WorkingDirectory=$(pwd)/$BACKEND_DIR
Environment=PATH=$(pwd)/$BACKEND_DIR/venv/bin
ExecStart=$(pwd)/$BACKEND_DIR/venv/bin/gunicorn -c gunicorn.conf.py core.wsgi:application
ExecReload=/bin/kill -s HUP \$MAINPID
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

    # Frontend service (if using a separate web server)
    cat > /tmp/quartzy-frontend.service << EOF
[Unit]
Description=Quartzy Bio-Inventory Frontend
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=$(pwd)/$FRONTEND_DIR
ExecStart=/usr/bin/npx serve -s build -l 3000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

    print_status "Service files created in /tmp/"
    print_warning "Copy service files to /etc/systemd/system/ and run:"
    print_warning "sudo systemctl daemon-reload"
    print_warning "sudo systemctl enable quartzy-backend quartzy-frontend"
    print_warning "sudo systemctl start quartzy-backend quartzy-frontend"
fi

# Display deployment summary
echo ""
echo "🎉 Deployment completed successfully!"
echo ""
echo "📋 Summary:"
echo "   • Backend: Django + PostgreSQL"
echo "   • Frontend: React + TypeScript"
echo "   • Environment: $1"
echo ""
echo "🔗 Access URLs:"
if [ "$1" = "production" ]; then
    echo "   • Backend API: http://your-domain:8000/api/"
    echo "   • Frontend: http://your-domain:3000/"
else
    echo "   • Backend API: http://localhost:8000/api/"
    echo "   • Frontend: http://localhost:3000/"
fi
echo "   • Admin Panel: http://localhost:8000/admin/ (admin/admin123)"
echo ""
echo "🔧 To start services manually:"
echo "   Backend:  cd $BACKEND_DIR && source venv/bin/activate && python manage.py runserver"
echo "   Frontend: cd $FRONTEND_DIR && npm start"
echo ""
print_status "Happy coding! 🚀"