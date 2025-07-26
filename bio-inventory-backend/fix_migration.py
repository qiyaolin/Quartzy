#!/usr/bin/env python
"""
修复数据库迁移问题的脚本
解决 financial_type 字段重复添加的问题
"""
import os
import sys
import django
from django.conf import settings
from django.core.management import execute_from_command_line

# 设置 Django 环境
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.db import connection
from django.core.management.color import no_style
from django.db import transaction

def check_column_exists(table_name, column_name):
    """检查数据库表中是否存在指定列"""
    with connection.cursor() as cursor:
        # 检查数据库类型
        if 'sqlite' in connection.vendor:
            # SQLite 查询方式
            cursor.execute(f"PRAGMA table_info({table_name})")
            columns = [row[1] for row in cursor.fetchall()]
            return column_name in columns
        else:
            # PostgreSQL 查询方式
            cursor.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name=%s AND column_name=%s
            """, [table_name, column_name])
            return cursor.fetchone() is not None

def mark_migration_as_applied(app_name, migration_name):
    """将迁移标记为已应用"""
    with connection.cursor() as cursor:
        if 'sqlite' in connection.vendor:
            # SQLite 方式
            cursor.execute("""
                INSERT OR IGNORE INTO django_migrations (app, name, applied) 
                VALUES (?, ?, datetime('now'))
            """, [app_name, migration_name])
        else:
            # PostgreSQL 方式
            cursor.execute("""
                INSERT INTO django_migrations (app, name, applied) 
                VALUES (%s, %s, NOW())
                ON CONFLICT (app, name) DO NOTHING
            """, [app_name, migration_name])

def main():
    print("开始修复数据库迁移问题...")
    
    # 检查 financial_type 列是否存在
    if check_column_exists('items_item', 'financial_type'):
        print("✓ financial_type 列已存在于数据库中")
        
        # 将相关迁移标记为已应用
        try:
            with transaction.atomic():
                mark_migration_as_applied('items', '0005_item_financial_type')
                print("✓ 已将 items.0005_item_financial_type 迁移标记为已应用")
        except Exception as e:
            print(f"✗ 标记迁移时出错: {e}")
            return False
    else:
        print("✗ financial_type 列不存在，需要正常运行迁移")
        return False
    
    print("迁移修复完成！")
    return True

if __name__ == '__main__':
    success = main()
    if success:
        print("现在可以重新部署应用了")
    else:
        print("需要手动检查数据库状态")