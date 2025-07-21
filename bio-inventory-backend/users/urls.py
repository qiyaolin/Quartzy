from django.urls import path
from .views import CurrentUserView, UserListCreateView, UserDetailView, toggle_user_status

urlpatterns = [
    path('users/me/', CurrentUserView.as_view(), name='current-user'),
    path('users/', UserListCreateView.as_view(), name='user-list-create'),
    path('users/<int:pk>/', UserDetailView.as_view(), name='user-detail'),
    path('users/<int:user_id>/toggle-status/', toggle_user_status, name='toggle-user-status'),
] 