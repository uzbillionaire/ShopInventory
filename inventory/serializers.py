import json
import re

from django.contrib.auth import get_user_model
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from .models import Batch, Sale, SizeEntry

# Well under the database's integer limit (~2.1 billion); a typo with extra zeros gets a clear 400, not a crash.
MAX_PRICE = 1_000_000_000
MAX_PAIRS = 9999

SIZE_PATTERN = re.compile(r'^\d{1,2}([.,]5)?$')


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = get_user_model()
        fields = ['id', 'username', 'first_name', 'last_name']


class BatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Batch
        fields = ['id', 'brand', 'bought_price', 'picture', 'date_added']
        read_only_fields = ['bought_price', 'date_added']

    def validate_brand(self, value):
        from .services import canonical_brand

        brand = canonical_brand(value, exclude=self.instance)
        if not brand:
            raise serializers.ValidationError(_('Enter a brand.'))
        return brand


class SizeEntrySerializer(serializers.ModelSerializer):
    batch = BatchSerializer(read_only=True)
    sold = serializers.SerializerMethodField()
    in_stock = serializers.BooleanField(read_only=True)

    class Meta:
        model = SizeEntry
        fields = ['code', 'size', 'quantity', 'initial_quantity', 'sold', 'in_stock', 'label_printed', 'batch']
        read_only_fields = ['code', 'size', 'initial_quantity', 'label_printed']
        extra_kwargs = {'quantity': {'max_value': MAX_PAIRS}}

    def get_sold(self, entry) -> int:
        return entry.initial_quantity - entry.quantity


class BrandGroupSerializer(serializers.Serializer):
    """One brand on the stock list, with every matching size line under it."""

    brand = serializers.CharField()
    pairs = serializers.IntegerField(help_text='Pairs left across all sizes shown.')
    min_price = serializers.IntegerField()
    max_price = serializers.IntegerField()
    last_added = serializers.DateTimeField()
    deliveries = serializers.IntegerField(help_text='How many deliveries the sizes come from.')
    entries = SizeEntrySerializer(many=True)


class SaleSerializer(serializers.ModelSerializer):
    code = serializers.CharField(source='size_entry.code', read_only=True)
    brand = serializers.CharField(source='size_entry.batch.brand', read_only=True)
    size = serializers.CharField(source='size_entry.size', read_only=True)
    bought_price = serializers.IntegerField(source='size_entry.batch.bought_price', read_only=True)
    profit = serializers.IntegerField(read_only=True)

    class Meta:
        model = Sale
        fields = ['id', 'code', 'brand', 'size', 'bought_price', 'sold_price', 'profit', 'payment', 'sold_at']


class SizeEntryDetailSerializer(SizeEntrySerializer):
    barcode_svg = serializers.SerializerMethodField()
    recent_sales = serializers.SerializerMethodField()
    last_brand_price = serializers.SerializerMethodField()
    delivery_sizes = serializers.SerializerMethodField()

    class Meta(SizeEntrySerializer.Meta):
        fields = SizeEntrySerializer.Meta.fields + ['barcode_svg', 'recent_sales', 'last_brand_price', 'delivery_sizes']

    def get_delivery_sizes(self, entry) -> int:
        """Sizes sharing this delivery's brand, price and photo: editing those changes all of them."""
        return entry.batch.sizes.count()

    def get_barcode_svg(self, entry) -> str:
        from .services import barcode_svg

        return barcode_svg(entry.code)

    def get_recent_sales(self, entry) -> list[dict]:
        return SaleSerializer(entry.sales.select_related('size_entry__batch')[:20], many=True).data

    def get_last_brand_price(self, entry) -> int | None:
        """Most recent price this brand sold for: a one-tap suggestion when selling."""
        return (
            Sale.objects.filter(size_entry__batch__brand__iexact=entry.batch.brand)
            .values_list('sold_price', flat=True).first()
        )


class SizeEntryEditSerializer(serializers.Serializer):
    """Fixing a product. Send only what changed; a blank `picture` removes the photo."""

    size = serializers.CharField(max_length=10, required=False)
    quantity = serializers.IntegerField(min_value=0, max_value=MAX_PAIRS, required=False)
    brand = serializers.CharField(max_length=120, required=False)
    bought_price = serializers.IntegerField(min_value=1, max_value=MAX_PRICE, required=False)
    picture = serializers.ImageField(required=False, allow_null=True)

    def validate_size(self, value):
        value = value.strip()
        if not SIZE_PATTERN.match(value):
            raise serializers.ValidationError(_('Enter a size like 41 or 41.5.'))
        value = value.replace(',', '.')
        entry = self.context['entry']
        # Two lines with one size in one delivery would look identical on the shelf.
        if entry.batch.sizes.exclude(pk=entry.pk).filter(size=value).exists():
            raise serializers.ValidationError(_('This delivery already has size %(size)s.') % {'size': value})
        return value

    def validate_brand(self, value):
        from .services import canonical_brand

        brand = canonical_brand(value, exclude=self.context['entry'].batch)
        if not brand:
            raise serializers.ValidationError(_('Enter a brand.'))
        return brand


class SizeRowSerializer(serializers.Serializer):
    size = serializers.CharField(max_length=10)
    quantity = serializers.IntegerField(min_value=1, max_value=MAX_PAIRS)

    def validate_size(self, value):
        value = value.strip()
        if not SIZE_PATTERN.match(value):
            raise serializers.ValidationError(_('Enter a size like 41 or 41.5.'))
        return value.replace(',', '.')


class JSONListField(serializers.ListField):
    """Accepts a real list (JSON body) or a JSON string (multipart form with a photo)."""

    def get_value(self, dictionary):
        # ListField reads multipart values with getlist(); a JSON string arrives as one value.
        value = dictionary.get(self.field_name, serializers.empty)
        if isinstance(value, str):
            return value
        return super().get_value(dictionary)

    def to_internal_value(self, data):
        if isinstance(data, str):
            try:
                data = json.loads(data)
            except ValueError:
                raise serializers.ValidationError(_('Sizes must be a JSON list.'))
        return super().to_internal_value(data)


class BatchCreateSerializer(serializers.Serializer):
    brand = serializers.CharField(max_length=120)
    bought_price = serializers.IntegerField(min_value=1, max_value=MAX_PRICE)
    picture = serializers.ImageField(required=False, allow_null=True)
    sizes = JSONListField(child=SizeRowSerializer(), min_length=1, max_length=40)


class RestockLineSerializer(serializers.Serializer):
    added = serializers.IntegerField()
    merged = serializers.BooleanField(help_text='True if the pairs were added to an existing line (same barcode).')
    entry = SizeEntrySerializer()


class RestockResultSerializer(serializers.Serializer):
    batch = BatchSerializer(allow_null=True)
    lines = RestockLineSerializer(many=True)


class SellSerializer(serializers.Serializer):
    sold_price = serializers.IntegerField(min_value=0, max_value=MAX_PRICE)
    payment = serializers.ChoiceField(choices=Sale.PAYMENT_CHOICES, default=Sale.CASH)


class SellResultSerializer(serializers.Serializer):
    sale = SaleSerializer()
    entry = SizeEntrySerializer()


class LabelItemSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=16)
    copies = serializers.IntegerField(min_value=1, max_value=500, default=1)


# One PDF of 2000 labels is ~75 pages; much more ties the server up for minutes.
MAX_LABELS_PER_SHEET = 2000


class LabelSheetSerializer(serializers.Serializer):
    items = LabelItemSerializer(many=True, allow_empty=False, max_length=500)

    def validate_items(self, items):
        if sum(item['copies'] for item in items) > MAX_LABELS_PER_SHEET:
            raise serializers.ValidationError(
                _('At most %(max)d labels per PDF. Lower the copies or print in parts.') % {'max': MAX_LABELS_PER_SHEET},
            )
        return items


class DayQuerySerializer(serializers.Serializer):
    date = serializers.DateField(required=False)


class DateRangeSerializer(serializers.Serializer):
    start = serializers.DateField(required=False)
    end = serializers.DateField(required=False)
    slow_days = serializers.IntegerField(min_value=1, max_value=365, required=False, default=30)

    def validate(self, attrs):
        if attrs.get('start') and attrs.get('end') and attrs['start'] > attrs['end']:
            raise serializers.ValidationError(_('The start date must be before the end date.'))
        return attrs
