from django.apps import AppConfig


class InventoryRequestsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'inventory_requests'

    def ready(self):
        import inventory_requests.signals # Import signals here
        import inventory_requests.funding_integration # Import funding integration