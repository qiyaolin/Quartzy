from django.test import TestCase
from rest_framework.test import APIClient

from .models import PrintJob


class FetchPendingJobAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = '/api/printing/api/fetch-pending-job/'

    def _create_job(self, **overrides):
        payload = {
            'label_data': {
                'itemName': 'Test Item',
                'barcode': 'TEST-123',
            },
            'status': 'pending',
            'priority': 'normal',
            'retry_count': 0,
            'max_retries': 3,
        }
        payload.update(overrides)
        return PrintJob.objects.create(**payload)

    def test_fetch_pending_job_claims_distinct_jobs_in_sequence(self):
        first_job = self._create_job(priority='urgent', label_data={'itemName': 'Item A', 'barcode': 'A-001'})
        second_job = self._create_job(priority='normal', label_data={'itemName': 'Item B', 'barcode': 'B-001'})

        first_response = self.client.get(self.url, {'server_id': 'printer-a'})
        second_response = self.client.get(self.url, {'server_id': 'printer-b'})

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 200)
        self.assertNotEqual(first_response.data['id'], second_response.data['id'])
        self.assertCountEqual([first_response.data['id'], second_response.data['id']], [first_job.id, second_job.id])

        first_job.refresh_from_db()
        second_job.refresh_from_db()
        self.assertEqual(first_job.status, 'processing')
        self.assertEqual(second_job.status, 'processing')
        self.assertIn(first_job.print_server_id, {'printer-a', 'printer-b'})
        self.assertIn(second_job.print_server_id, {'printer-a', 'printer-b'})

    def test_processing_job_is_not_claimed_again(self):
        job = self._create_job(label_data={'itemName': 'Single Item', 'barcode': 'S-001'})

        first_response = self.client.get(self.url, {'server_id': 'printer-a'})
        second_response = self.client.get(self.url, {'server_id': 'printer-b'})

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(first_response.data['id'], job.id)
        self.assertEqual(second_response.status_code, 204)

        job.refresh_from_db()
        self.assertEqual(job.status, 'processing')
        self.assertEqual(job.print_server_id, 'printer-a')

    def test_retryable_failed_job_can_be_claimed_once(self):
        job = self._create_job(
            status='failed',
            retry_count=1,
            max_retries=3,
            label_data={'itemName': 'Retry Item', 'barcode': 'R-001'},
        )

        first_response = self.client.get(self.url, {'server_id': 'printer-a'})
        second_response = self.client.get(self.url, {'server_id': 'printer-b'})

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(first_response.data['id'], job.id)
        self.assertEqual(second_response.status_code, 204)

        job.refresh_from_db()
        self.assertEqual(job.status, 'processing')
        self.assertEqual(job.print_server_id, 'printer-a')
