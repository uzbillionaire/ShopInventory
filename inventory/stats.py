"""Aggregations for the statistics dashboard."""
from datetime import timedelta

from django.db.models import Count, F, Max, Q, Sum
from django.db.models.functions import TruncDay, TruncMonth, TruncWeek
from django.utils import timezone

from .models import SizeEntry


def inventory_value():
    totals = SizeEntry.objects.filter(quantity__gt=0).aggregate(
        value=Sum(F('quantity') * F('batch__bought_price')),
        pairs=Sum('quantity'),
    )
    return totals['value'] or 0, totals['pairs'] or 0


def sales_summary(sales):
    totals = sales.aggregate(
        revenue=Sum('sold_price'),
        cost=Sum('size_entry__batch__bought_price'),
        units=Count('id'),
    )
    revenue, cost = totals['revenue'] or 0, totals['cost'] or 0
    return {'revenue': revenue, 'cost': cost, 'profit': revenue - cost, 'units': totals['units']}


def best_sellers(sales, field, limit=5):
    rows = list(
        sales.values(label=F(field))
        .annotate(units=Count('id'), revenue=Sum('sold_price'))
        .order_by('-units', '-revenue')[:limit]
    )
    top = rows[0]['units'] if rows else 1
    for row in rows:
        row['share'] = round(row['units'] / top * 100)
    return rows


def slow_moving(days):
    """Lines still in stock, older than `days`, with no sale in that window."""
    cutoff = timezone.now() - timedelta(days=days)
    return (
        SizeEntry.objects.filter(quantity__gt=0, batch__date_added__lt=cutoff)
        .select_related('batch')
        .annotate(last_sale=Max('sales__sold_at'))
        .filter(Q(last_sale__isnull=True) | Q(last_sale__lt=cutoff))
        .order_by('batch__date_added')
    )


def sales_over_time(sales, start, end):
    """Revenue/profit per day, week or month (picked from the range length)."""
    span = (end - start).days
    if span <= 45:
        trunc, step = TruncDay, 'day'
    elif span <= 200:
        trunc, step = TruncWeek, 'week'
    else:
        trunc, step = TruncMonth, 'month'
    rows = (
        sales.annotate(bucket=trunc('sold_at', tzinfo=timezone.get_current_timezone()))
        .values('bucket')
        .annotate(revenue=Sum('sold_price'), cost=Sum('size_entry__batch__bought_price'), units=Count('id'))
        .order_by('bucket')
    )
    by_bucket = {_as_date(row['bucket']): row for row in rows}

    points = []
    cursor = _bucket_start(start, step)
    while cursor <= end:
        row = by_bucket.get(cursor, {})
        revenue, cost = row.get('revenue') or 0, row.get('cost') or 0
        points.append({'date': cursor, 'revenue': revenue, 'profit': revenue - cost, 'units': row.get('units', 0)})
        cursor = _next_bucket(cursor, step)

    peak = max((p['revenue'] for p in points), default=0) or 1
    for point in points:
        point['height'] = round(point['revenue'] / peak * 100, 1)
        point['profit_height'] = round(max(point['profit'], 0) / peak * 100, 1)
    return step, points


def _as_date(value):
    return value.date() if hasattr(value, 'date') else value


def _bucket_start(day, step):
    if step == 'week':
        return day - timedelta(days=day.weekday())
    if step == 'month':
        return day.replace(day=1)
    return day


def _next_bucket(day, step):
    if step == 'day':
        return day + timedelta(days=1)
    if step == 'week':
        return day + timedelta(days=7)
    return (day.replace(day=28) + timedelta(days=4)).replace(day=1)
