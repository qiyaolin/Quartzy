#!/bin/bash

# 设置错误时退出
set -e

echo "🚀 启动 Django 应用..."

# 检查环境变量
echo "📋 环境信息:"
echo "GAE_ENV: ${GAE_ENV:-未设置}"
echo "DEBUG: ${DEBUG:-未设置}"

# 运行数据库迁移（安全模式）
echo "🔄 运行数据库迁移..."
python manage.py migrate --noinput --fake-initial || echo "迁移跳过或失败"

# 创建超级用户（如果不存在）
echo "👤 创建管理员用户..."
python -c "
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from django.contrib.auth.models import User
username = 'admin'
email = 'admin@example.com'
password = os.environ.get('ADMIN_PASSWORD', 'admin123')
try:
    if not User.objects.filter(username=username).exists():
        User.objects.create_superuser(username, email, password)
        print(f'✅ 创建超级用户: {username}')
    else:
        print(f'ℹ️ 超级用户 {username} 已存在')
except Exception as e:
    print(f'⚠️ 超级用户创建跳过: {e}')
" || echo "超级用户创建跳过"

echo "🌐 启动 Gunicorn 服务器..."
exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 core.wsgi:application