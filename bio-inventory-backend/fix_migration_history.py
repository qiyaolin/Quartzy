#!/usr/bin/env python
import os
import sys
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.db import connection

def fix_migration_history():
    """清理重复的迁移记录"""
    
    cursor = connection.cursor()
    
    print("=== 检查当前迁移历史 ===")
    cursor.execute("""
        SELECT app, name, applied 
        FROM django_migrations 
        WHERE app = 'schedule' 
        ORDER BY applied
    """)
    migrations = cursor.fetchall()
    
    print("当前迁移记录:")
    seen_migrations = set()
    duplicates = []
    
    for app, name, applied in migrations:
        print(f"  - {name} (应用于: {applied})")
        if name in seen_migrations:
            duplicates.append((app, name))
            print(f"    ⚠️  重复迁移！")
        else:
            seen_migrations.add(name)
    
    if duplicates:
        print(f"\n发现 {len(duplicates)} 个重复的迁移记录")
        
        # 删除重复的迁移记录，只保留第一个
        for app, name in duplicates:
            cursor.execute("""
                DELETE FROM django_migrations 
                WHERE app = ? AND name = ? 
                AND id NOT IN (
                    SELECT MIN(id) 
                    FROM django_migrations 
                    WHERE app = ? AND name = ?
                )
            """, [app, name, app, name])
            
        print("已删除重复的迁移记录")
        
        # 验证清理结果
        cursor.execute("""
            SELECT app, name 
            FROM django_migrations 
            WHERE app = 'schedule' 
            ORDER BY applied
        """)
        remaining = cursor.fetchall()
        print("\n清理后的迁移记录:")
        for app, name in remaining:
            print(f"  - {name}")
    else:
        print("没有发现重复的迁移记录")
    
    print("\n=== 标记问题迁移为已应用 ===")
    # 由于第四个迁移有问题，我们将其标记为未应用
    cursor.execute("""
        DELETE FROM django_migrations 
        WHERE app = 'schedule' AND name = '0004_calendarsyncrecord_meetingconfiguration_and_more'
    """)
    print("已移除问题迁移记录，准备重新创建")

if __name__ == "__main__":
    fix_migration_history()