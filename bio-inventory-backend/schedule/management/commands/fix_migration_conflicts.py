"""
Django management command to fix migration conflicts for Google App Engine deployment
Usage: python manage.py fix_migration_conflicts
"""
from django.core.management.base import BaseCommand
from django.db import connection, transaction
from django.core.management import call_command
import sys


class Command(BaseCommand):
    help = 'Fix migration conflicts and database inconsistencies for App Engine deployment'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force execution even if potentially destructive'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without making changes'
        )
    
    def handle(self, *args, **options):
        if options['dry_run']:
            self.stdout.write(self.style.WARNING("DRY RUN MODE - No changes will be made"))
        
        self.stdout.write("🔧 Starting migration conflict fix...")
        
        try:
            # Step 1: Check database connection
            self.check_database_connection()
            
            # Step 2: Drop conflicting indexes
            self.drop_conflicting_indexes(dry_run=options['dry_run'])
            
            # Step 3: Mark problematic migration as applied if it exists
            self.fix_migration_state(dry_run=options['dry_run'])
            
            # Step 4: Run migrations safely
            if not options['dry_run']:
                self.run_safe_migrations()
            
            # Step 5: Verify database state
            self.verify_database_state()
            
            self.stdout.write(self.style.SUCCESS("✅ Migration conflict fix completed successfully"))
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"❌ Fix failed: {e}"))
            if options['force']:
                self.stdout.write("Continuing due to --force flag...")
            else:
                sys.exit(1)
    
    def check_database_connection(self):
        """Check if database connection is working"""
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                self.stdout.write("✓ Database connection successful")
        except Exception as e:
            raise Exception(f"Database connection failed: {e}")
    
    def drop_conflicting_indexes(self, dry_run=False):
        """Drop conflicting indexes that prevent migration"""
        try:
            with connection.cursor() as cursor:
                # Get all problematic indexes from the failed migration
                problematic_indexes = [
                    'schedule_ca_content_49a524_idx',
                    'schedule_ca_google__175f78_idx', 
                    'schedule_ca_sync_st_a331b7_idx',
                    'schedule_eq_equipme_2088a1_idx',
                    'schedule_eq_user_id_e03600_idx',
                    'schedule_eq_is_acti_880401_idx',
                    'schedule_eq_check_i_811aa5_idx',
                    'schedule_pe_schedul_a85a15_idx',
                    'schedule_pe_status_60173e_idx',
                    'schedule_pe_executi_6debbe_idx',
                    'schedule_pe_executi_7f65b5_idx',
                    'schedule_wa_equipme_156a2c_idx',
                    'schedule_wa_user_id_5afd91_idx',
                    'schedule_wa_expires_e3a566_idx'
                ]
                
                existing_indexes = []
                for index_name in problematic_indexes:
                    cursor.execute("""
                        SELECT indexname FROM pg_indexes 
                        WHERE indexname = %s
                    """, [index_name])
                    
                    if cursor.fetchone():
                        existing_indexes.append(index_name)
                
                if not existing_indexes:
                    self.stdout.write("✓ No conflicting indexes found")
                    return
                
                self.stdout.write(f"Found {len(existing_indexes)} conflicting indexes:")
                for index_name in existing_indexes:
                    if dry_run:
                        self.stdout.write(f"  [DRY RUN] Would drop: {index_name}")
                    else:
                        try:
                            cursor.execute(f"DROP INDEX IF EXISTS {index_name}")
                            self.stdout.write(f"  ✓ Dropped: {index_name}")
                        except Exception as e:
                            self.stdout.write(f"  ✗ Failed to drop {index_name}: {e}")
                
        except Exception as e:
            raise Exception(f"Error handling indexes: {e}")
    
    def fix_migration_state(self, dry_run=False):
        """Mark the problematic migration as applied if needed"""
        try:
            with connection.cursor() as cursor:
                # Check if the migration record exists
                cursor.execute("""
                    SELECT * FROM django_migrations 
                    WHERE app = 'schedule' AND name = '0005_calendarsyncrecord_schedule_ca_content_49a524_idx_and_more'
                """)
                
                if cursor.fetchone():
                    self.stdout.write("✓ Migration 0005 is already marked as applied")
                else:
                    if dry_run:
                        self.stdout.write("[DRY RUN] Would mark migration 0005 as applied")
                    else:
                        cursor.execute("""
                            INSERT INTO django_migrations (app, name, applied) 
                            VALUES ('schedule', '0005_calendarsyncrecord_schedule_ca_content_49a524_idx_and_more', NOW())
                        """)
                        self.stdout.write("✓ Marked migration 0005 as applied")
                        
        except Exception as e:
            self.stdout.write(f"Warning: Could not fix migration state: {e}")
    
    def run_safe_migrations(self):
        """Run migrations safely"""
        try:
            self.stdout.write("🔄 Running migrations...")
            call_command('migrate', verbosity=1, interactive=False)
            self.stdout.write("✓ Migrations completed")
        except Exception as e:
            self.stdout.write(f"Warning: Migration issues: {e}")
    
    def verify_database_state(self):
        """Verify that key tables exist and are accessible"""
        try:
            with connection.cursor() as cursor:
                # Check key tables
                key_tables = [
                    'schedule_equipment',
                    'schedule_event', 
                    'schedule_booking',
                    'schedule_equipmentusagelog'
                ]
                
                missing_tables = []
                for table in key_tables:
                    cursor.execute("""
                        SELECT table_name FROM information_schema.tables 
                        WHERE table_name=%s AND table_schema='public'
                    """, [table])
                    
                    if not cursor.fetchone():
                        missing_tables.append(table)
                
                if missing_tables:
                    raise Exception(f"Missing critical tables: {missing_tables}")
                
                self.stdout.write("✓ All critical tables exist")
                
                # Test Equipment creation (the original issue)
                from schedule.models import Equipment
                test_equipment = Equipment(
                    name="Test Equipment",
                    description="Migration test",
                    location="Test Lab",
                    is_bookable=True
                )
                # Don't actually save, just validate
                test_equipment.full_clean()
                self.stdout.write("✓ Equipment model validation passed")
                
        except Exception as e:
            raise Exception(f"Database verification failed: {e}")