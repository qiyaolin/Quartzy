#!/bin/bash
#!/bin/bash

# 设置错误时退出
set -e

echo "开始 Django 应用初始化..."

# 创建缺失的迁移文件
echo "创建缺失的迁移..."
python manage.py makemigrations --noinput || true

# 强制修复生产环境迁移问题
echo "强制修复生产环境迁移问题..."
python force_fix_migration.py || true

# 运行数据库迁移
echo "运行数据库迁移..."
python manage.py migrate --noinput

# 创建超级用户（如果不存在）
echo "创建管理员用户..."
python startup.py

echo "启动 Gunicorn 服务器..."
exec gunicorn -b :$PORT core.wsgi:application
