from django.urls import path, re_path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenBlacklistView, TokenRefreshView

from . import views

app_name = 'inventory'

router = DefaultRouter()
router.register('batches', views.BatchViewSet, basename='batch')
router.register('entries', views.SizeEntryViewSet, basename='entry')
router.register('sales', views.SaleViewSet, basename='sale')

urlpatterns = [
    path('auth/token/', views.LoginView.as_view(), name='token'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/logout/', TokenBlacklistView.as_view(), name='logout'),
    path('auth/me/', views.MeView.as_view(), name='me'),
    path('labels/pdf/', views.LabelSheetView.as_view(), name='labels_pdf'),
    path('stats/', views.StatsView.as_view(), name='stats'),
    path('reports/daily/', views.DailyReportView.as_view(), name='daily_report'),
    path('reports/daily.xlsx', views.DailyReportExportView.as_view(), name='daily_report_export'),
    path('reports/days/', views.DailyReportListView.as_view(), name='daily_report_list'),
    re_path(r'^export/(?P<kind>inventory|sales)\.(?P<fmt>csv|xlsx)$', views.ExportView.as_view(), name='export'),
    *router.urls,
]
