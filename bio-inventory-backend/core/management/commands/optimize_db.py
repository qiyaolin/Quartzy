from django.core.management.base import BaseCommand
from django.db import connection, transaction
from django.core.cache import cache
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Optimize database performance by creating indexes and analyzing tables'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear-cache',
            action='store_true',
            dest='clear_cache',
            help='Clear application cache',
        )
        parser.add_argument(
            '--analyze-tables',
            action='store_true',
            dest='analyze_tables',
            help='Analyze database tables for PostgreSQL',
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Starting database optimization...'))

        # Clear cache if requested
        if options['clear_cache']:
            self.clear_cache()

        # Create indexes for better performance
        self.create_indexes()

        # Analyze tables for PostgreSQL
        if options['analyze_tables']:
            self.analyze_tables()

        self.stdout.write(self.style.SUCCESS('Database optimization completed successfully!'))

    def clear_cache(self):
        """Clear application cache"""
        try:
            cache.clear()
            self.stdout.write(self.style.SUCCESS('✓ Cache cleared successfully'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'✗ Error clearing cache: {e}'))

    def create_indexes(self):
        """Create database indexes for better performance"""
        indexes = [
            # Items table indexes
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS items_item_expiration_date_idx ON items_item (expiration_date);',
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS items_item_vendor_id_idx ON items_item (vendor_id);',
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS items_item_location_id_idx ON items_item (location_id);',
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS items_item_item_type_id_idx ON items_item (item_type_id);',
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS items_item_is_archived_idx ON items_item (is_archived);',
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS items_item_created_at_idx ON items_item (created_at);',
            
            # Requests table indexes
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS requests_request_status_idx ON requests_request (status);',
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS requests_request_created_by_id_idx ON requests_request (created_by_id);',
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS requests_request_vendor_id_idx ON requests_request (vendor_id);',
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS requests_request_fund_id_idx ON requests_request (fund_id);',
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS requests_request_created_at_idx ON requests_request (created_at);',
            
            # Request history table indexes
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS requests_requesthistory_request_id_idx ON requests_requesthistory (request_id);',
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS requests_requesthistory_user_id_idx ON requests_requesthistory (user_id);',
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS requests_requesthistory_timestamp_idx ON requests_requesthistory (timestamp);',
            
            # Funding table indexes
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS funding_fund_created_by_id_idx ON funding_fund (created_by_id);',
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS funding_transaction_fund_id_idx ON funding_transaction (fund_id);',
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS funding_transaction_timestamp_idx ON funding_transaction (timestamp);',
            
            # Notifications table indexes
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS notifications_notification_user_id_idx ON notifications_notification (user_id);',
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS notifications_notification_is_read_idx ON notifications_notification (is_read);',
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS notifications_notification_created_at_idx ON notifications_notification (created_at);',
            
            # Composite indexes for common queries
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS items_item_vendor_location_idx ON items_item (vendor_id, location_id);',
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS requests_request_status_created_at_idx ON requests_request (status, created_at);',
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS items_item_expiration_archived_idx ON items_item (expiration_date, is_archived);',
        ]

        with connection.cursor() as cursor:
            for index_sql in indexes:
                try:
                    cursor.execute(index_sql)
                    index_name = index_sql.split('IF NOT EXISTS ')[1].split(' ON ')[0]
                    self.stdout.write(self.style.SUCCESS(f'✓ Created index: {index_name}'))
                except Exception as e:
                    if 'already exists' in str(e):
                        continue
                    self.stdout.write(self.style.WARNING(f'⚠ Index creation warning: {e}'))

    def analyze_tables(self):
        """Analyze tables for PostgreSQL query planner"""
        tables = [
            'items_item',
            'items_vendor',
            'items_location',
            'items_itemtype',
            'requests_request',
            'requests_requesthistory',
            'funding_fund',
            'funding_transaction',
            'notifications_notification',
            'auth_user',
        ]

        with connection.cursor() as cursor:
            for table in tables:
                try:
                    cursor.execute(f'ANALYZE {table};')
                    self.stdout.write(self.style.SUCCESS(f'✓ Analyzed table: {table}'))
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f'⚠ Error analyzing {table}: {e}'))

        # Update global statistics
        try:
            with connection.cursor() as cursor:
                cursor.execute('ANALYZE;')
            self.stdout.write(self.style.SUCCESS('✓ Updated global database statistics'))
        except Exception as e:
            self.stdout.write(self.style.WARNING(f'⚠ Error updating global stats: {e}'))