#!/usr/bin/env python
"""
紧急迁移视图 - 用于修复生产环境barcode字段
"""
from django.http import JsonResponse
from django.contrib.admin.views.decorators import staff_member_required
from django.db import connection
from django.views.decorators.csrf import csrf_exempt
import json

@staff_member_required
@csrf_exempt
def emergency_migrate_barcode(request):
    """紧急添加barcode字段到生产环境"""
    
    if request.method != 'POST':
        return JsonResponse({'error': 'POST method required'}, status=405)
    
    try:
        with connection.cursor() as cursor:
            # 检查数据库类型
            db_vendor = connection.vendor
            
            if db_vendor == 'postgresql':
                # PostgreSQL - 检查barcode字段是否存在
                cursor.execute("""
                    SELECT column_name FROM information_schema.columns 
                    WHERE table_name='items_item' AND column_name='barcode'
                """)
                
                if not cursor.fetchone():
                    # 添加barcode字段
                    cursor.execute("""
                        ALTER TABLE items_item 
                        ADD COLUMN barcode VARCHAR(50) NULL
                    """)
                    
                    # 添加唯一约束（允许NULL值）
                    cursor.execute("""
                        CREATE UNIQUE INDEX items_item_barcode_unique 
                        ON items_item(barcode) 
                        WHERE barcode IS NOT NULL
                    """)
                    
                    # 更新Django迁移记录
                    cursor.execute("""
                        INSERT INTO django_migrations (app, name, applied) 
                        VALUES ('items', '0006_item_barcode', NOW())
                        ON CONFLICT (app, name) DO NOTHING
                    """)
                    
                    return JsonResponse({
                        'success': True,
                        'message': 'Barcode字段已成功添加到PostgreSQL数据库',
                        'database': 'postgresql'
                    })
                else:
                    return JsonResponse({
                        'success': True,
                        'message': 'Barcode字段已存在于PostgreSQL数据库中',
                        'database': 'postgresql'
                    })
                    
            else:  # SQLite
                # SQLite - 检查barcode字段是否存在
                cursor.execute("PRAGMA table_info(items_item)")
                columns = cursor.fetchall()
                barcode_exists = any(col[1] == 'barcode' for col in columns)
                
                if not barcode_exists:
                    # SQLite添加字段
                    cursor.execute("""
                        ALTER TABLE items_item 
                        ADD COLUMN barcode VARCHAR(50) NULL
                    """)
                    
                    # SQLite创建唯一索引
                    cursor.execute("""
                        CREATE UNIQUE INDEX items_item_barcode_unique 
                        ON items_item(barcode)
                    """)
                    
                    # 更新Django迁移记录
                    cursor.execute("""
                        INSERT OR IGNORE INTO django_migrations (app, name, applied) 
                        VALUES ('items', '0006_item_barcode', datetime('now'))
                    """)
                    
                    return JsonResponse({
                        'success': True,
                        'message': 'Barcode字段已成功添加到SQLite数据库',
                        'database': 'sqlite'
                    })
                else:
                    return JsonResponse({
                        'success': True,
                        'message': 'Barcode字段已存在于SQLite数据库中',
                        'database': 'sqlite'
                    })
                    
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e),
            'message': '添加barcode字段时发生错误'
        }, status=500)

@staff_member_required
def check_barcode_status(request):
    """检查barcode字段状态"""
    
    try:
        with connection.cursor() as cursor:
            db_vendor = connection.vendor
            
            if db_vendor == 'postgresql':
                # 检查字段是否存在
                cursor.execute("""
                    SELECT column_name, data_type, is_nullable 
                    FROM information_schema.columns 
                    WHERE table_name='items_item' AND column_name='barcode'
                """)
                field_info = cursor.fetchone()
                
                # 检查迁移记录
                cursor.execute("""
                    SELECT applied FROM django_migrations 
                    WHERE app='items' AND name='0006_item_barcode'
                """)
                migration_info = cursor.fetchone()
                
            else:  # SQLite
                cursor.execute("PRAGMA table_info(items_item)")
                columns = cursor.fetchall()
                field_info = next((col for col in columns if col[1] == 'barcode'), None)
                
                cursor.execute("""
                    SELECT applied FROM django_migrations 
                    WHERE app='items' AND name='0006_item_barcode'
                """)
                migration_info = cursor.fetchone()
            
            return JsonResponse({
                'database': db_vendor,
                'field_exists': field_info is not None,
                'field_info': field_info,
                'migration_applied': migration_info is not None,
                'migration_date': migration_info[0] if migration_info else None
            })
            
    except Exception as e:
        return JsonResponse({
            'error': str(e),
            'message': '检查barcode字段状态时发生错误'
        }, status=500)