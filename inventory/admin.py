from django.contrib import admin
from django.db.models import F

from .models import Batch, Restock, Sale, SizeEntry


class SizeEntryInline(admin.TabularInline):
    model = SizeEntry
    extra = 0
    fields = ['size', 'quantity', 'initial_quantity', 'code', 'label_printed']
    readonly_fields = ['code']


@admin.register(Batch)
class BatchAdmin(admin.ModelAdmin):
    list_display = ['brand', 'bought_price', 'date_added']
    search_fields = ['brand']
    date_hierarchy = 'date_added'
    inlines = [SizeEntryInline]


@admin.register(SizeEntry)
class SizeEntryAdmin(admin.ModelAdmin):
    list_display = ['code', 'batch', 'size', 'quantity', 'initial_quantity', 'label_printed']
    list_filter = ['label_printed']
    search_fields = ['code', 'batch__brand', 'size']
    readonly_fields = ['code']
    list_select_related = ['batch']


@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = ['sold_at', 'size_entry', 'sold_price']
    search_fields = ['size_entry__code', 'size_entry__batch__brand']
    date_hierarchy = 'sold_at'
    list_select_related = ['size_entry__batch']

    def delete_model(self, request, obj):
        # Deleting a mistaken sale puts the pair back on the shelf.
        SizeEntry.objects.filter(pk=obj.size_entry_id).update(quantity=F('quantity') + 1)
        super().delete_model(request, obj)

    def delete_queryset(self, request, queryset):
        for sale in queryset:
            self.delete_model(request, sale)


@admin.register(Restock)
class RestockAdmin(admin.ModelAdmin):
    list_display = ['received_at', 'size_entry', 'quantity']
    search_fields = ['size_entry__code', 'size_entry__batch__brand']
    date_hierarchy = 'received_at'
    list_select_related = ['size_entry__batch']
