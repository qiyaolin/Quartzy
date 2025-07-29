from django.urls import path
from . import views

urlpatterns = [
    path('import/', views.import_data, name='import_data'),
]