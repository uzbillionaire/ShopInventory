import secrets
from pathlib import Path

from django.db import models
from django.urls import reverse
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

# No 0/O or 1/I, so a code typed by hand from a worn label is unambiguous.
CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
CODE_LENGTH = 10


def generate_code():
    while True:
        code = ''.join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))
        if not SizeEntry.objects.filter(code=code).exists():
            return code


def picture_path(instance, filename):
    # Media is served without auth, so file names must not be guessable.
    return f'batches/{secrets.token_urlsafe(16)}{Path(filename).suffix.lower()}'


class Batch(models.Model):
    brand = models.CharField(_('brand'), max_length=120)
    bought_price = models.PositiveIntegerField(_('bought price'))
    picture = models.ImageField(_('picture'), upload_to=picture_path, blank=True)
    date_added = models.DateTimeField(_('date added'), auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-date_added']
        verbose_name = _('batch')
        verbose_name_plural = _('batches')

    def __str__(self):
        return f'{self.brand} ({self.bought_price})'


class SizeEntry(models.Model):
    batch = models.ForeignKey(Batch, on_delete=models.CASCADE, related_name='sizes', verbose_name=_('batch'))
    code = models.CharField(_('code'), max_length=16, unique=True, default=generate_code, editable=False)
    size = models.CharField(_('size'), max_length=10)
    quantity = models.PositiveIntegerField(_('quantity'))
    initial_quantity = models.PositiveIntegerField(_('initial quantity'))
    label_printed = models.BooleanField(_('label printed'), default=False)

    class Meta:
        ordering = ['-batch__date_added', 'size']
        verbose_name = _('size entry')
        verbose_name_plural = _('size entries')

    def __str__(self):
        return f'{self.batch.brand} {self.size} ({self.code})'

    def get_absolute_url(self):
        return reverse('inventory:entry', args=[self.code])

    @property
    def in_stock(self):
        return self.quantity > 0


class Sale(models.Model):
    size_entry = models.ForeignKey(SizeEntry, on_delete=models.PROTECT, related_name='sales', verbose_name=_('size entry'))
    sold_price = models.PositiveIntegerField(_('sold price'))
    sold_at = models.DateTimeField(_('sold at'), auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-sold_at']
        verbose_name = _('sale')
        verbose_name_plural = _('sales')

    def __str__(self):
        return f'{self.size_entry} - {self.sold_price}'

    @property
    def profit(self):
        return self.sold_price - self.size_entry.batch.bought_price


class Restock(models.Model):
    """Pairs received on a size line: the first delivery and every top-up."""

    size_entry = models.ForeignKey(SizeEntry, on_delete=models.CASCADE, related_name='restocks', verbose_name=_('size entry'))
    quantity = models.PositiveIntegerField(_('quantity'))
    received_at = models.DateTimeField(_('received at'), default=timezone.now, db_index=True)

    class Meta:
        ordering = ['-received_at']
        verbose_name = _('restock')
        verbose_name_plural = _('restocks')

    def __str__(self):
        return f'{self.size_entry} +{self.quantity}'
