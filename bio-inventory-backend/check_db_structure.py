#!/usr/bin/env python
import os
import sys
import django
import sqlite3

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.db import connection
from django.conf import settings

def check_database_structure():
    """检查数据库结构和现有数据"""
    
    # 获取数据库连接
    cursor = connection.cursor()
    
    print("=== 数据库文件位置 ===")
    print(f"数据库文件: {settings.DATABASES['default']['NAME']}")
    
    print("\n=== 现有表列表 ===")
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    
    schedule_tables = []
    other_tables = []
    
    for table in tables:
        table_name = table[0]
        if table_name.startswith('schedule_'):
            schedule_tables.append(table_name)
        else:
            other_tables.append(table_name)
    
    print("Schedule 应用相关表:")
    for table in sorted(schedule_tables):
        print(f"  - {table}")
        # 检查表中的记录数量
        cursor.execute(f"SELECT COUNT(*) FROM {table};")
        count = cursor.fetchone()[0]
        print(f"    记录数量: {count}")
    
    print(f"\n其他表 ({len(other_tables)} 个):")
    for table in sorted(other_tables)[:5]:  # 只显示前5个
        print(f"  - {table}")
    if len(other_tables) > 5:
        print(f"  ... 还有 {len(other_tables) - 5} 个表")
    
    print("\n=== 检查 WaitingQueueEntry 表结构 ===")
    if 'schedule_waitingqueueentry' in [t[0] for t in tables]:
        cursor.execute("PRAGMA table_info(schedule_waitingqueueentry);")
        columns = cursor.fetchall()
        print("现有列:")
        for col in columns:
            print(f"  - {col[1]} ({col[2]}) {'NOT NULL' if col[3] else 'NULL'}")
        
        # 检查数据
        cursor.execute("SELECT COUNT(*) FROM schedule_waitingqueueentry;")
        count = cursor.fetchone()[0]
        print(f"记录数量: {count}")
    else:
        print("schedule_waitingqueueentry 表不存在")
    
    print("\n=== 检查 MeetingInstance 表是否存在 ===")
    if 'schedule_meetinginstance' in [t[0] for t in tables]:
        cursor.execute("SELECT COUNT(*) FROM schedule_meetinginstance;")
        count = cursor.fetchone()[0]
        print(f"schedule_meetinginstance 存在，记录数量: {count}")
    else:
        print("schedule_meetinginstance 表不存在 - 这是问题所在")
    
    print("\n=== 检查迁移历史 ===")
    cursor.execute("SELECT app, name FROM django_migrations WHERE app = 'schedule' ORDER BY applied;")
    migrations = cursor.fetchall()
    print("已应用的 schedule 迁移:")
    for app, name in migrations:
        print(f"  - {name}")

if __name__ == "__main__":
    check_database_structure()