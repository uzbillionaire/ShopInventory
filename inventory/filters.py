import django_filters
from django.db.models import Q
from django.utils.translation import gettext_lazy as _

from .models import Sale, SizeEntry

# A size at or below this many pairs shows as running low (red on the stock list).
LOW_STOCK_PAIRS = 1


class SizeEntryFilter(django_filters.FilterSet):
    q = django_filters.CharFilter(method='filter_q', label=_('Brand or code'))
    size = django_filters.CharFilter(method='filter_size')
    stock = django_filters.ChoiceFilter(
        method='filter_stock', choices=[('in', _('In stock')), ('low', _('Running low')), ('out', _('Sold out')), ('all', _('All'))],
    )
    added_from = django_filters.DateFilter(field_name='batch__date_added', lookup_expr='date__gte')
    added_to = django_filters.DateFilter(field_name='batch__date_added', lookup_expr='date__lte')

    class Meta:
        model = SizeEntry
        fields = ['label_printed']

    def filter_q(self, queryset, name, value):
        value = value.strip()
        return queryset.filter(Q(batch__brand__icontains=value) | Q(code__iexact=value)) if value else queryset

    def filter_size(self, queryset, name, value):
        return queryset.filter(size=value.strip().replace(',', '.'))

    def filter_stock(self, queryset, name, value):
        if value == 'in':
            return queryset.filter(quantity__gt=0)
        if value == 'low':
            return queryset.filter(quantity__gt=0, quantity__lte=LOW_STOCK_PAIRS)
        if value == 'out':
            return queryset.filter(quantity=0)
        return queryset


class SaleFilter(django_filters.FilterSet):
    start = django_filters.DateFilter(field_name='sold_at', lookup_expr='date__gte')
    end = django_filters.DateFilter(field_name='sold_at', lookup_expr='date__lte')
    code = django_filters.CharFilter(field_name='size_entry__code', lookup_expr='iexact')
    brand = django_filters.CharFilter(field_name='size_entry__batch__brand', lookup_expr='icontains')

    class Meta:
        model = Sale
        fields = []
