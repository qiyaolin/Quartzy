#!/usr/bin/env python
"""
检查生产环境Item模型的数据库schema
"""
import os
import django
from django.conf import settings

# 设置 Django 环境
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.db import connection
from items.models import Item

def check_item_schema():
    """检查Item表的schema"""
    print("检查Item表的数据库schema...")
    
    with connection.cursor() as cursor:
        if connection.vendor == 'postgresql':
            # PostgreSQL查询
            cursor.execute("""
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns 
                WHERE table_name='items_item'
                ORDER BY ordinal_position
            """)
            columns = cursor.fetchall()
            
            print(f"Item表共有 {len(columns)} 个字段:")
            print("-" * 80)
            print(f"{'字段名':<25} {'数据类型':<20} {'可空':<10} {'默认值'}")
            print("-" * 80)
            
            barcode_found = False
            for col in columns:
                column_name, data_type, is_nullable, default_value = col
                if column_name == 'barcode':
                    barcode_found = True
                    print(f"✅ {column_name:<25} {data_type:<20} {is_nullable:<10} {default_value or 'NULL'}")
                else:
                    print(f"   {column_name:<25} {data_type:<20} {is_nullable:<10} {default_value or 'NULL'}")
            
            print("-" * 80)
            if barcode_found:
                print("✅ barcode字段存在于数据库中！")
            else:
                print("❌ barcode字段不存在于数据库中！")
                
        else:
            # SQLite查询
            cursor.execute("PRAGMA table_info(items_item)")
            columns = cursor.fetchall()
            
            print(f"Item表共有 {len(columns)} 个字段:")
            barcode_found = any(col[1] == 'barcode' for col in columns)
            
            for col in columns:
                if col[1] == 'barcode':
                    print(f"✅ barcode字段: {col}")
                else:
                    print(f"   {col[1]}: {col}")
            
            if barcode_found:
                print("✅ barcode字段存在于数据库中！")
            else:
                print("❌ barcode字段不存在于数据库中！")

    # 检查Django模型定义
    print("\n检查Django模型定义:")
    item_fields = [f.name for f in Item._meta.fields]
    if 'barcode' in item_fields:
        print("✅ barcode字段存在于Django模型中！")
    else:
        print("❌ barcode字段不存在于Django模型中！")
    
    print(f"Item模型字段: {item_fields}")

if __name__ == '__main__':
    check_item_schema()