#!/bin/bash

# 设置错误时退出
set -e

echo "🚀 开始 Django 应用初始化..."

# 检查环境变量
echo "📋 检查环境变量..."
echo "GAE_ENV: ${GAE_ENV:-未设置}"
echo "DEBUG: ${DEBUG:-未设置}"
echo "DB_NAME: ${DB_NAME:-未设置}"

# 收集静态文件（App Engine环境跳过清除）
echo "📦 收集静态文件..."
if [ "$GAE_ENV" = "standard" ]; then
    echo "App Engine环境：跳过静态文件清除"
    python manage.py collectstatic --noinput --no-input || echo "静态文件收集跳过"
else
    python manage.py collectstatic --noinput --clear
fi

# 检查数据库连接
echo "🔍 检查数据库连接..."
python manage.py check --database default

# 运行数据库迁移（安全模式）
echo "🔄 运行数据库迁移..."
python manage.py migrate --noinput

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
if not User.objects.filter(username=username).exists():
    User.objects.create_superuser(username, email, password)
    print(f'✅ 创建超级用户: {username}')
else:
    print(f'ℹ️ 超级用户 {username} 已存在')
"

echo "🌐 启动 Gunicorn 服务器..."
exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 core.wsgi:application