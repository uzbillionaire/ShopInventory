"""Daily reports: what sold and what arrived on each day (shop-local dates)."""
from datetime import timedelta

from django.db.models import Count, F, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone

from . import stats
from .models import Restock, Sale


def daily(day):
    sales = (
        Sale.objects.filter(sold_at__date=day)
        .select_related('size_entry__batch')
        .order_by('sold_at')
    )
    received = (
        Restock.objects.filter(received_at__date=day)
        .select_related('size_entry__batch')
        .order_by('received_at')
    )
    received_rows = [
        {
            'code': r.size_entry.code,
            'brand': r.size_entry.batch.brand,
            'size': r.size_entry.size,
            'quantity': r.quantity,
            'bought_price': r.size_entry.batch.bought_price,
            'received_at': r.received_at,
        }
        for r in received
    ]
    return {
        'date': day,
        'sales': stats.sales_summary(sales),
        'sales_list': list(sales),
        'by_brand': stats.best_sellers(sales, 'size_entry__batch__brand', limit=50),
        'received': received_rows,
        'received_summary': {
            'pairs': sum(r['quantity'] for r in received_rows),
            'value': sum(r['quantity'] * r['bought_price'] for r in received_rows),
        },
    }


def days(start, end):
    """One row per day from end back to start, including quiet days."""
    tz = timezone.get_current_timezone()
    sold = {
        row['day']: row
        for row in Sale.objects.filter(sold_at__date__gte=start, sold_at__date__lte=end)
        .annotate(day=TruncDate('sold_at', tzinfo=tz))
        .values('day')
        .annotate(revenue=Sum('sold_price'), cost=Sum('size_entry__batch__bought_price'), units=Count('id'))
    }
    received = {
        row['day']: row
        for row in Restock.objects.filter(received_at__date__gte=start, received_at__date__lte=end)
        .annotate(day=TruncDate('received_at', tzinfo=tz))
        .values('day')
        .annotate(pairs=Sum('quantity'), value=Sum(F('quantity') * F('size_entry__batch__bought_price')))
    }
    rows = []
    day = end
    while day >= start:
        s, r = sold.get(day, {}), received.get(day, {})
        revenue, cost = s.get('revenue') or 0, s.get('cost') or 0
        rows.append({
            'date': day,
            'units': s.get('units', 0),
            'revenue': revenue,
            'profit': revenue - cost,
            'received_pairs': r.get('pairs') or 0,
            'received_value': r.get('value') or 0,
        })
        day -= timedelta(days=1)
    return rows
