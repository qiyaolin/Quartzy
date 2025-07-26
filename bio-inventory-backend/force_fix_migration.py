#!/usr/bin/env python
"""
强制修复生产环境迁移问题的脚本
彻底清理financial_type字段相关的迁移冲突
"""
import os
import sys
import django
from django.conf import settings

# 设置 Django 环境
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.db import connection, transaction
from django.core.management.color import no_style

def force_fix_migrations():
    """强制修复迁移问题"""
    print("开始强制修复迁移问题...")
    
    with connection.cursor() as cursor:
        try:
            with transaction.atomic():
                # 1. 删除有问题的迁移记录
                print("删除有问题的迁移记录...")
                cursor.execute("""
                    DELETE FROM django_migrations 
                    WHERE app = 'items' AND name = '0005_item_financial_type'
                """)
                
                # 2. 检查并删除financial_type字段（如果存在）
                print("检查financial_type字段...")
                
                # 检查items_item表的financial_type字段
                if connection.vendor == 'postgresql':
                    cursor.execute("""
                        SELECT column_name 
                        FROM information_schema.columns 
                        WHERE table_name='items_item' AND column_name='financial_type'
                    """)
                    if cursor.fetchone():
                        print("删除items_item表的financial_type字段...")
                        cursor.execute("ALTER TABLE items_item DROP COLUMN financial_type")
                
                # 检查inventory_requests_request表的financial_type字段
                if connection.vendor == 'postgresql':
                    cursor.execute("""
                        SELECT column_name 
                        FROM information_schema.columns 
                        WHERE table_name='inventory_requests_request' AND column_name='financial_type'
                    """)
                    if cursor.fetchone():
                        print("删除inventory_requests_request表的financial_type字段...")
                        cursor.execute("ALTER TABLE inventory_requests_request DROP COLUMN financial_type")
                
                # 3. 标记新的迁移为已应用
                print("标记新迁移为已应用...")
                cursor.execute("""
                    INSERT INTO django_migrations (app, name, applied) 
                    VALUES ('items', '0005_remove_financial_type_if_exists', NOW())
                    ON CONFLICT (app, name) DO NOTHING
                """)
                
                cursor.execute("""
                    INSERT INTO django_migrations (app, name, applied) 
                    VALUES ('inventory_requests', '0002_remove_financial_type_if_exists', NOW())
                    ON CONFLICT (app, name) DO NOTHING
                """)
                
                print("✅ 迁移修复完成！")
                return True
                
        except Exception as e:
            print(f"❌ 修复过程中出错: {e}")
            return False

if __name__ == '__main__':
    success = force_fix_migrations()
    if success:
        print("现在可以正常运行Django应用了")
    else:
        print("修复失败，请检查错误信息")
        sys.exit(1)