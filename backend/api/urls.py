from django.urls import path
from . import views

urlpatterns = [
    path('trigger-extraction/', views.trigger_extraction, name='trigger_extraction'),
]
