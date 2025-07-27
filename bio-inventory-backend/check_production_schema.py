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
import requests

def check_production_database():
    """通过API检查生产环境数据库状态"""
    print("检查生产环境数据库状态...")
    
    # 检查生产环境健康状态
    base_url = "https://lab-inventory-467021.nn.r.appspot.com"
    
    try:
        # 检查健康端点
        health_response = requests.get(f"{base_url}/health/", timeout=30)
        print(f"健康检查状态: {health_response.status_code}")
        
        # 检查管理员页面
        admin_response = requests.get(f"{base_url}/admin/", timeout=30)
        print(f"管理员页面状态: {admin_response.status_code}")
        
        # 尝试访问items API
        items_response = requests.get(f"{base_url}/api/items/", timeout=30)
        print(f"Items API状态: {items_response.status_code}")
        
        if items_response.status_code == 200:
            items_data = items_response.json()
            print(f"Items API响应: {len(items_data.get('results', []))} 个项目")
            
            # 检查第一个item是否有barcode字段
            if items_data.get('results'):
                first_item = items_data['results'][0]
                if 'barcode' in first_item:
                    print("✅ 生产环境API返回包含barcode字段")
                    print(f"示例barcode值: {first_item.get('barcode')}")
                else:
                    print("❌ 生产环境API返回不包含barcode字段")
                    print(f"可用字段: {list(first_item.keys())}")
        
    except requests.exceptions.RequestException as e:
        print(f"❌ 生产环境请求失败: {str(e)}")

def check_local_database():
    """检查本地数据库状态"""
    print("\n检查本地数据库状态...")
    
    with connection.cursor() as cursor:
        # 检查迁移状态
        cursor.execute("""
            SELECT app, name, applied 
            FROM django_migrations 
            WHERE app = 'items' 
            ORDER BY applied DESC
        """)
        migrations = cursor.fetchall()
        
        print("最近的迁移记录:")
        for migration in migrations[:5]:
            app, name, applied = migration
            print(f"  {name} - {applied}")
        
        # 检查barcode字段的具体信息
        if connection.vendor == 'sqlite':
            cursor.execute("PRAGMA table_info(items_item)")
            columns = cursor.fetchall()
            barcode_info = [col for col in columns if col[1] == 'barcode']
            if barcode_info:
                print(f"\nbarcode字段详细信息: {barcode_info[0]}")
        
        # 检查是否有实际的barcode数据
        cursor.execute("SELECT COUNT(*) FROM items_item WHERE barcode IS NOT NULL")
        barcode_count = cursor.fetchone()[0]
        print(f"有barcode值的项目数量: {barcode_count}")
        
        if barcode_count > 0:
            cursor.execute("SELECT barcode FROM items_item WHERE barcode IS NOT NULL LIMIT 5")
            sample_barcodes = cursor.fetchall()
            print(f"示例barcode值: {[b[0] for b in sample_barcodes]}")

if __name__ == '__main__':
    check_local_database()
    check_production_database()