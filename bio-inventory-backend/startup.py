#!/usr/bin/env python
"""
Startup script to create superuser if it doesn't exist
"""
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth.models import User

def create_superuser_if_not_exists():
    username = 'admin'
    email = 'admin@example.com'
    password = os.environ.get('ADMIN_PASSWORD', 'admin123')
    
    if not User.objects.filter(username=username).exists():
        User.objects.create_superuser(username, email, password)
        print(f"Created superuser: {username}")
    else:
        print(f"Superuser {username} already exists")

if __name__ == '__main__':
    create_superuser_if_not_exists()