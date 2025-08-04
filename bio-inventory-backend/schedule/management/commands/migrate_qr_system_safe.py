#!/usr/bin/env python
"""
安全QR系统迁移命令 - 专门为生产环境设计
不会影响现有数据，智能检测和添加所需字段
"""

from django.core.management.base import BaseCommand
from django.db import connection, transaction
from django.db.migrations.recorder import MigrationRecorder
import uuid


class Command(BaseCommand):
    help = '安全地迁移QR码签到系统到生产环境'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='只检查不执行实际迁移',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='强制执行迁移（谨慎使用）',
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('🚀 开始QR系统安全迁移...'))
        
        dry_run = options['dry_run']
        force = options['force']
        
        if dry_run:
            self.stdout.write(self.style.WARNING('📋 DRY RUN 模式 - 只检查不执行'))
        
        try:
            with transaction.atomic():
                # 1. 检查当前数据库状态
                self.check_database_status()
                
                # 2. 安全地添加Equipment字段
                self.migrate_equipment_fields(dry_run)
                
                # 3. 创建新的QR相关表
                self.create_qr_tables(dry_run)
                
                # 4. 更新迁移记录
                if not dry_run:
                    self.update_migration_records()
                
                # 5. 验证迁移结果
                self.verify_migration()
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ 迁移失败: {e}'))
            raise
        
        self.stdout.write(self.style.SUCCESS('✅ QR系统迁移完成！'))

    def check_database_status(self):
        """检查当前数据库状态"""
        self.stdout.write('📊 检查数据库当前状态...')
        
        with connection.cursor() as cursor:
            db_vendor = connection.vendor
            self.stdout.write(f'数据库类型: {db_vendor}')
            
            # 检查schedule_equipment表是否存在
            if db_vendor == 'postgresql':
                cursor.execute("""
                    SELECT table_name FROM information_schema.tables 
                    WHERE table_name='schedule_equipment' AND table_schema='public'
                """)
            else:  # SQLite
                cursor.execute("""
                    SELECT name FROM sqlite_master 
                    WHERE type='table' AND name='schedule_equipment'
                """)
            
            equipment_table_exists = cursor.fetchone()
            
            if equipment_table_exists:
                self.stdout.write('✅ schedule_equipment表已存在')
                
                # 检查现有字段
                if db_vendor == 'postgresql':
                    cursor.execute("""
                        SELECT column_name FROM information_schema.columns 
                        WHERE table_name='schedule_equipment'
                    """)
                else:  # SQLite
                    cursor.execute("PRAGMA table_info(schedule_equipment)")
                
                existing_columns = [row[0] if db_vendor == 'postgresql' else row[1] 
                                  for row in cursor.fetchall()]
                
                self.stdout.write(f'现有字段: {", ".join(existing_columns)}')
                
                # 检查是否已有QR相关字段
                qr_fields = ['qr_code', 'current_user_id', 'current_checkin_time', 'is_in_use']
                existing_qr_fields = [field for field in qr_fields if field in existing_columns]
                
                if existing_qr_fields:
                    self.stdout.write(f'⚠️ 已存在QR字段: {", ".join(existing_qr_fields)}')
                else:
                    self.stdout.write('📝 未发现QR字段，需要添加')
            else:
                self.stdout.write('❌ schedule_equipment表不存在，需要先运行基础迁移')
                raise Exception('请先确保schedule应用的基础迁移已完成')

    def migrate_equipment_fields(self, dry_run=False):
        """安全地添加Equipment QR相关字段"""
        self.stdout.write('🔧 处理Equipment表QR字段...')
        
        with connection.cursor() as cursor:
            db_vendor = connection.vendor
            
            # 检查每个字段是否需要添加
            fields_to_add = []
            
            if db_vendor == 'postgresql':
                cursor.execute("""
                    SELECT column_name FROM information_schema.columns 
                    WHERE table_name='schedule_equipment'
                """)
            else:  # SQLite
                cursor.execute("PRAGMA table_info(schedule_equipment)")
            
            existing_columns = [row[0] if db_vendor == 'postgresql' else row[1] 
                              for row in cursor.fetchall()]
            
            # 定义需要的字段
            required_fields = {
                'qr_code': 'VARCHAR(50) NULL',
                'current_user_id': 'INTEGER NULL',
                'current_checkin_time': 'TIMESTAMP NULL',
                'is_in_use': 'BOOLEAN DEFAULT FALSE'
            }
            
            for field_name, field_definition in required_fields.items():
                if field_name not in existing_columns:
                    fields_to_add.append((field_name, field_definition))
            
            if fields_to_add:
                self.stdout.write(f'需要添加字段: {[f[0] for f in fields_to_add]}')
                
                if not dry_run:
                    for field_name, field_definition in fields_to_add:
                        try:
                            cursor.execute(f"""
                                ALTER TABLE schedule_equipment 
                                ADD COLUMN {field_name} {field_definition}
                            """)
                            self.stdout.write(f'✅ 已添加字段: {field_name}')
                        except Exception as e:
                            self.stdout.write(f'⚠️ 字段{field_name}可能已存在: {e}')
                    
                    # 为qr_code字段添加唯一约束
                    if 'qr_code' in [f[0] for f in fields_to_add]:
                        try:
                            if db_vendor == 'postgresql':
                                cursor.execute("""
                                    CREATE UNIQUE INDEX CONCURRENTLY schedule_equipment_qr_code_unique 
                                    ON schedule_equipment(qr_code) 
                                    WHERE qr_code IS NOT NULL
                                """)
                            else:  # SQLite
                                cursor.execute("""
                                    CREATE UNIQUE INDEX schedule_equipment_qr_code_unique 
                                    ON schedule_equipment(qr_code)
                                """)
                            self.stdout.write('✅ 已添加qr_code唯一约束')
                        except Exception as e:
                            self.stdout.write(f'⚠️ qr_code唯一约束可能已存在: {e}')
                    
                    # 添加外键约束
                    if 'current_user_id' in [f[0] for f in fields_to_add]:
                        try:
                            if db_vendor == 'postgresql':
                                cursor.execute("""
                                    ALTER TABLE schedule_equipment 
                                    ADD CONSTRAINT schedule_equipment_current_user_fk 
                                    FOREIGN KEY (current_user_id) REFERENCES auth_user(id)
                                """)
                            self.stdout.write('✅ 已添加current_user外键约束')
                        except Exception as e:
                            self.stdout.write(f'⚠️ current_user外键约束可能已存在: {e}')
            else:
                self.stdout.write('✅ Equipment表QR字段已全部存在')

    def create_qr_tables(self, dry_run=False):
        """创建QR相关的新表"""
        self.stdout.write('📋 创建QR相关表...')
        
        with connection.cursor() as cursor:
            db_vendor = connection.vendor
            
            # 检查表是否已存在
            tables_to_check = ['schedule_equipmentusagelog', 'schedule_waitingqueueentry']
            
            for table_name in tables_to_check:
                if db_vendor == 'postgresql':
                    cursor.execute("""
                        SELECT table_name FROM information_schema.tables 
                        WHERE table_name=%s AND table_schema='public'
                    """, [table_name])
                else:  # SQLite
                    cursor.execute("""
                        SELECT name FROM sqlite_master 
                        WHERE type='table' AND name=?
                    """, [table_name])
                
                table_exists = cursor.fetchone()
                
                if table_exists:
                    self.stdout.write(f'✅ 表{table_name}已存在')
                else:
                    self.stdout.write(f'📝 需要创建表: {table_name}')
                    
                    if not dry_run:
                        if table_name == 'schedule_equipmentusagelog':
                            self.create_usage_log_table(cursor, db_vendor)
                        elif table_name == 'schedule_waitingqueueentry':
                            self.create_waiting_queue_table(cursor, db_vendor)

    def create_usage_log_table(self, cursor, db_vendor):
        """创建设备使用日志表"""
        try:
            if db_vendor == 'postgresql':
                cursor.execute("""
                    CREATE TABLE schedule_equipmentusagelog (
                        id SERIAL PRIMARY KEY,
                        equipment_id INTEGER NOT NULL REFERENCES schedule_equipment(id),
                        user_id INTEGER NOT NULL REFERENCES auth_user(id),
                        check_in_time TIMESTAMP NOT NULL,
                        check_out_time TIMESTAMP NULL,
                        usage_duration INTERVAL NULL,
                        qr_scan_method VARCHAR(20) DEFAULT 'mobile_camera',
                        notes TEXT NULL,
                        is_active BOOLEAN DEFAULT TRUE,
                        created_at TIMESTAMP DEFAULT NOW(),
                        updated_at TIMESTAMP DEFAULT NOW()
                    )
                """)
            else:  # SQLite
                cursor.execute("""
                    CREATE TABLE schedule_equipmentusagelog (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        equipment_id INTEGER NOT NULL,
                        user_id INTEGER NOT NULL,
                        check_in_time TIMESTAMP NOT NULL,
                        check_out_time TIMESTAMP NULL,
                        usage_duration TEXT NULL,
                        qr_scan_method VARCHAR(20) DEFAULT 'mobile_camera',
                        notes TEXT NULL,
                        is_active BOOLEAN DEFAULT 1,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (equipment_id) REFERENCES schedule_equipment(id),
                        FOREIGN KEY (user_id) REFERENCES auth_user(id)
                    )
                """)
            
            self.stdout.write('✅ 已创建设备使用日志表')
            
            # 添加索引
            indexes = [
                "CREATE INDEX idx_equipmentusagelog_equipment ON schedule_equipmentusagelog(equipment_id)",
                "CREATE INDEX idx_equipmentusagelog_user ON schedule_equipmentusagelog(user_id)",
                "CREATE INDEX idx_equipmentusagelog_active ON schedule_equipmentusagelog(is_active)",
                "CREATE INDEX idx_equipmentusagelog_checkin ON schedule_equipmentusagelog(check_in_time)"
            ]
            
            for index_sql in indexes:
                try:
                    cursor.execute(index_sql)
                except Exception as e:
                    self.stdout.write(f'⚠️ 索引可能已存在: {e}')
                    
        except Exception as e:
            self.stdout.write(f'❌ 创建使用日志表失败: {e}')
            raise

    def create_waiting_queue_table(self, cursor, db_vendor):
        """创建等待队列表"""
        try:
            if db_vendor == 'postgresql':
                cursor.execute("""
                    CREATE TABLE schedule_waitingqueueentry (
                        id SERIAL PRIMARY KEY,
                        equipment_id INTEGER NOT NULL REFERENCES schedule_equipment(id),
                        user_id INTEGER NOT NULL REFERENCES auth_user(id),
                        position INTEGER DEFAULT 1,
                        requested_start_time TIMESTAMP NOT NULL,
                        requested_end_time TIMESTAMP NOT NULL,
                        status VARCHAR(20) DEFAULT 'waiting',
                        notified_at TIMESTAMP NULL,
                        expires_at TIMESTAMP NOT NULL,
                        created_at TIMESTAMP DEFAULT NOW(),
                        updated_at TIMESTAMP DEFAULT NOW()
                    )
                """)
            else:  # SQLite
                cursor.execute("""
                    CREATE TABLE schedule_waitingqueueentry (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        equipment_id INTEGER NOT NULL,
                        user_id INTEGER NOT NULL,
                        position INTEGER DEFAULT 1,
                        requested_start_time TIMESTAMP NOT NULL,
                        requested_end_time TIMESTAMP NOT NULL,
                        status VARCHAR(20) DEFAULT 'waiting',
                        notified_at TIMESTAMP NULL,
                        expires_at TIMESTAMP NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (equipment_id) REFERENCES schedule_equipment(id),
                        FOREIGN KEY (user_id) REFERENCES auth_user(id)
                    )
                """)
            
            self.stdout.write('✅ 已创建等待队列表')
            
            # 添加索引
            indexes = [
                "CREATE INDEX idx_waitingqueue_equipment ON schedule_waitingqueueentry(equipment_id)",
                "CREATE INDEX idx_waitingqueue_user ON schedule_waitingqueueentry(user_id)",
                "CREATE INDEX idx_waitingqueue_status ON schedule_waitingqueueentry(status)",
                "CREATE INDEX idx_waitingqueue_expires ON schedule_waitingqueueentry(expires_at)"
            ]
            
            for index_sql in indexes:
                try:
                    cursor.execute(index_sql)
                except Exception as e:
                    self.stdout.write(f'⚠️ 索引可能已存在: {e}')
                    
        except Exception as e:
            self.stdout.write(f'❌ 创建等待队列表失败: {e}')
            raise

    def update_migration_records(self):
        """更新Django迁移记录"""
        self.stdout.write('📝 更新迁移记录...')
        
        try:
            recorder = MigrationRecorder(connection)
            
            # 记录我们的迁移已应用
            migrations_to_record = [
                ('schedule', '0002_add_qr_checkin_support'),
                ('schedule', '0003_create_usage_log'),
            ]
            
            for app, migration_name in migrations_to_record:
                if not recorder.migration_qs.filter(app=app, name=migration_name).exists():
                    recorder.record_applied(app, migration_name)
                    self.stdout.write(f'✅ 已记录迁移: {app}.{migration_name}')
                else:
                    self.stdout.write(f'📋 迁移记录已存在: {app}.{migration_name}')
                    
        except Exception as e:
            self.stdout.write(f'⚠️ 更新迁移记录时出错: {e}')

    def verify_migration(self):
        """验证迁移结果"""
        self.stdout.write('🔍 验证迁移结果...')
        
        with connection.cursor() as cursor:
            db_vendor = connection.vendor
            
            # 验证Equipment表字段
            if db_vendor == 'postgresql':
                cursor.execute("""
                    SELECT column_name FROM information_schema.columns 
                    WHERE table_name='schedule_equipment' 
                    AND column_name IN ('qr_code', 'current_user_id', 'current_checkin_time', 'is_in_use')
                """)
            else:  # SQLite
                cursor.execute("PRAGMA table_info(schedule_equipment)")
                all_columns = cursor.fetchall()
                qr_columns = [col[1] for col in all_columns 
                            if col[1] in ['qr_code', 'current_user_id', 'current_checkin_time', 'is_in_use']]
                # 模拟PostgreSQL的返回格式
                cursor.execute("SELECT 1")  # 重置cursor
                
            if db_vendor == 'postgresql':
                qr_columns = [row[0] for row in cursor.fetchall()]
                
            expected_fields = ['qr_code', 'current_user_id', 'current_checkin_time', 'is_in_use']
            missing_fields = [field for field in expected_fields if field not in qr_columns]
            
            if missing_fields:
                self.stdout.write(f'❌ 缺少字段: {missing_fields}')
            else:
                self.stdout.write('✅ Equipment表QR字段验证通过')
            
            # 验证新表是否存在
            tables_to_verify = ['schedule_equipmentusagelog', 'schedule_waitingqueueentry']
            
            for table_name in tables_to_verify:
                if db_vendor == 'postgresql':
                    cursor.execute("""
                        SELECT table_name FROM information_schema.tables 
                        WHERE table_name=%s AND table_schema='public'
                    """, [table_name])
                else:  # SQLite
                    cursor.execute("""
                        SELECT name FROM sqlite_master 
                        WHERE type='table' AND name=?
                    """, [table_name])
                
                table_exists = cursor.fetchone()
                
                if table_exists:
                    self.stdout.write(f'✅ 表{table_name}验证通过')
                else:
                    self.stdout.write(f'❌ 表{table_name}不存在')

    def generate_qr_code(self):
        """生成唯一QR码"""
        return f"BSC-{uuid.uuid4().hex[:8].upper()}"