from django.apps import AppConfig


class RequestsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'requests'

    def ready(self):
        import requests.signals # Import signals here
        import requests.funding_integration # Import funding integration