"""Business rules: restocking, selling, and rendering barcodes/labels."""
import io
import re
from dataclasses import dataclass
from pathlib import Path

import barcode
from barcode.writer import ImageWriter, SVGWriter
from django.db import transaction
from django.db.models import F
from PIL import Image, ImageDraw, ImageFont

from .models import Batch, Restock, Sale, SizeEntry

FONT_DIR = Path(__file__).resolve().parent / 'fonts'
FONT_REGULAR = FONT_DIR / 'DejaVuSans.ttf'
FONT_BOLD = FONT_DIR / 'DejaVuSans-Bold.ttf'


class OutOfStock(Exception):
    pass


def normalize_brand(brand):
    return re.sub(r'\s+', ' ', brand).strip()


def canonical_brand(brand, exclude=None):
    """One spelling per brand: "skechers  go walk" becomes the existing "Skechers Go Walk".

    `exclude` is the delivery being renamed, so it doesn't match its own old spelling.
    """
    brand = normalize_brand(brand)
    known = Batch.objects.filter(brand__iexact=brand)
    if exclude is not None:
        known = known.exclude(pk=exclude.pk)
    return known.order_by('date_added').values_list('brand', flat=True).first() or brand


def normalize_size(size):
    return size.strip().replace(',', '.')


@dataclass
class RestockLine:
    entry: SizeEntry
    added: int
    merged: bool


@dataclass
class RestockResult:
    batch: Batch | None
    lines: list[RestockLine]


@transaction.atomic
def add_stock(brand, bought_price, rows, picture=None):
    """Add a delivery of one brand at one price across several sizes.

    A size already in stock for the same brand at the same bought price is
    topped up on its existing line (keeping its barcode). Anything else
    becomes a new size line with a new code, so stock bought at different
    prices never shares a line and profit stays accurate.
    """
    brand = canonical_brand(brand)
    totals = {}
    for size, quantity in rows:
        size = normalize_size(size)
        totals[size] = totals.get(size, 0) + quantity

    lines, new_rows = [], []
    for size, quantity in totals.items():
        existing = (
            SizeEntry.objects.select_for_update()
            .filter(batch__brand__iexact=brand, batch__bought_price=bought_price, size=size, quantity__gt=0)
            .order_by('-batch__date_added')
            .first()
        )
        if existing:
            SizeEntry.objects.filter(pk=existing.pk).update(
                quantity=F('quantity') + quantity,
                initial_quantity=F('initial_quantity') + quantity,
            )
            existing.refresh_from_db()
            lines.append(RestockLine(entry=existing, added=quantity, merged=True))
        else:
            new_rows.append((size, quantity))

    batch = None
    if new_rows:
        batch = Batch.objects.create(brand=brand, bought_price=bought_price, picture=picture or '')
        for size, quantity in new_rows:
            entry = SizeEntry.objects.create(batch=batch, size=size, quantity=quantity, initial_quantity=quantity)
            lines.append(RestockLine(entry=entry, added=quantity, merged=False))
    elif picture:
        target = lines[0].entry.batch
        if not target.picture:
            target.picture = picture
            target.save(update_fields=['picture'])

    Restock.objects.bulk_create(Restock(size_entry=line.entry, quantity=line.added) for line in lines)
    return RestockResult(batch=batch, lines=lines)


def _delete_file_later(field_file):
    """Remove a replaced photo from disk, but only once the database change has really been saved."""
    if field_file:
        storage, name = field_file.storage, field_file.name
        transaction.on_commit(lambda: storage.delete(name))


@transaction.atomic
def edit_entry(entry, changes):
    """Fix a mistake on one product.

    Size and pair count belong to this line only. Brand, price and photo belong
    to the whole delivery, so every size bought with it changes too. Size and
    brand are printed on the label, so changed lines go back on the to-print list.
    """
    entry = SizeEntry.objects.select_for_update().select_related('batch').get(pk=entry.pk)
    batch = entry.batch

    batch_fields = []
    if 'brand' in changes and changes['brand'] != batch.brand:
        batch.brand = changes['brand']
        batch_fields.append('brand')
        batch.sizes.update(label_printed=False)
        entry.label_printed = False
    if 'bought_price' in changes and changes['bought_price'] != batch.bought_price:
        batch.bought_price = changes['bought_price']
        batch_fields.append('bought_price')
    if 'picture' in changes:
        _delete_file_later(batch.picture)
        batch.picture = changes['picture'] or ''
        batch_fields.append('picture')
    if batch_fields:
        batch.save(update_fields=batch_fields)

    entry_fields = []
    if 'quantity' in changes:
        # Correcting the count (a lost or miscounted pair) must not look like a sale.
        delta = changes['quantity'] - entry.quantity
        entry.quantity = changes['quantity']
        entry.initial_quantity = max(0, entry.initial_quantity + delta)
        entry_fields += ['quantity', 'initial_quantity']
    if 'size' in changes and changes['size'] != entry.size:
        entry.size = changes['size']
        entry.label_printed = False
        entry_fields += ['size', 'label_printed']
    if entry_fields:
        entry.save(update_fields=entry_fields)
    return entry


@transaction.atomic
def delete_entry(entry):
    """Delete a product with no sales. A delivery left with no sizes goes too, photo included.

    Raises ProtectedError if the line has sales.
    """
    batch = entry.batch
    entry.delete()
    if not batch.sizes.exists():
        _delete_file_later(batch.picture)
        batch.delete()


@transaction.atomic
def sell_one(entry, sold_price, payment=Sale.CASH):
    updated = SizeEntry.objects.filter(pk=entry.pk, quantity__gt=0).update(quantity=F('quantity') - 1)
    if not updated:
        raise OutOfStock
    sale = Sale.objects.create(size_entry=entry, sold_price=sold_price, payment=payment)
    entry.refresh_from_db(fields=['quantity'])
    return sale


def barcode_svg(code):
    """Inline SVG of the Code128 barcode, without the human-readable text."""
    out = io.BytesIO()
    barcode.get('code128', code, writer=SVGWriter()).write(
        out, options={'write_text': False, 'module_height': 12, 'quiet_zone': 2, 'module_width': 0.3},
    )
    svg = out.getvalue().decode()
    svg = svg[svg.index('<svg'):]
    # python-barcode sizes the SVG in mm with no viewBox, so it can't be scaled by CSS.
    # Children use mm too; 1mm = 96/25.4 user units, so express the viewBox in those.
    size = re.search(r'width="([\d.]+)mm" height="([\d.]+)mm"', svg)
    if size:
        width, height = (float(value) * 96 / 25.4 for value in size.groups())
        svg = svg.replace(size.group(0), f'viewBox="0 0 {width:.2f} {height:.2f}" preserveAspectRatio="none"', 1)
    return svg


def _truncate(text, fits):
    """Shorten text with an ellipsis until fits(text) is true."""
    if fits(text):
        return text
    while len(text) > 1 and not fits(text + '…'):
        text = text[:-1]
    return text.rstrip() + '…'


def label_png(entry):
    """A 60x30mm label at 300dpi: brand and size on top, barcode, code below."""
    width, height = 709, 354
    pad = 28
    label = Image.new('RGB', (width, height), 'white')
    draw = ImageDraw.Draw(label)

    size_font = ImageFont.truetype(str(FONT_BOLD), 66)
    size_w = draw.textlength(entry.size, font=size_font)
    draw.text((width - pad - size_w, pad - 6), entry.size, font=size_font, fill='black')

    brand_font = ImageFont.truetype(str(FONT_BOLD), 34)
    room = width - 2 * pad - size_w - 24
    brand = _truncate(entry.batch.brand, lambda t: draw.textlength(t, font=brand_font) <= room)
    draw.text((pad, pad + 14), brand, font=brand_font, fill='black')

    # Quiet zone of ~10 modules each side is built into the rendered image.
    bars = barcode.get('code128', entry.code, writer=ImageWriter()).render(
        {'write_text': False, 'module_height': 12, 'module_width': 0.3, 'quiet_zone': 3, 'dpi': 300},
    )
    bars.thumbnail((width - 2 * pad, 180))
    label.paste(bars, ((width - bars.width) // 2, 100))

    code_font = ImageFont.truetype(str(FONT_REGULAR), 30)
    code_w = draw.textlength(entry.code, font=code_font)
    draw.text(((width - code_w) / 2, height - pad - 30), entry.code, font=code_font, fill='black')

    out = io.BytesIO()
    label.save(out, format='PNG', dpi=(300, 300))
    return out.getvalue()


LABEL_COLS, LABEL_ROWS = 3, 9


def labels_pdf(entries):
    """A4 sheets of 60x30mm labels (3 x 9 per page) with light cut outlines."""
    from reportlab.graphics.barcode.code128 import Code128
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.pdfgen import canvas

    for name, path in (('DejaVu', FONT_REGULAR), ('DejaVu-Bold', FONT_BOLD)):
        if name not in pdfmetrics.getRegisteredFontNames():
            pdfmetrics.registerFont(TTFont(name, str(path)))

    page_w, page_h = A4
    label_w, label_h, gap = 60 * mm, 30 * mm, 2 * mm
    pad = 3 * mm
    quiet = 4 * mm
    per_page = LABEL_COLS * LABEL_ROWS
    left = (page_w - LABEL_COLS * label_w - (LABEL_COLS - 1) * gap) / 2
    top = (page_h - LABEL_ROWS * label_h - (LABEL_ROWS - 1) * gap) / 2

    out = io.BytesIO()
    pdf = canvas.Canvas(out, pagesize=A4)
    pdf.setTitle('Labels')
    for index, entry in enumerate(entries):
        if index and index % per_page == 0:
            pdf.showPage()
        slot = index % per_page
        row, col = divmod(slot, LABEL_COLS)
        x = left + col * (label_w + gap)
        y = page_h - top - (row + 1) * label_h - row * gap

        pdf.setStrokeColorRGB(0.8, 0.8, 0.8)
        pdf.setLineWidth(0.3)
        pdf.rect(x, y, label_w, label_h)

        size_w = pdfmetrics.stringWidth(entry.size, 'DejaVu-Bold', 15)
        pdf.setFont('DejaVu-Bold', 15)
        pdf.drawString(x + label_w - pad - size_w, y + label_h - pad - 11, entry.size)

        room = label_w - 2 * pad - size_w - 3 * mm
        brand = _truncate(entry.batch.brand, lambda t: pdfmetrics.stringWidth(t, 'DejaVu-Bold', 9) <= room)
        pdf.setFont('DejaVu-Bold', 9)
        pdf.drawString(x + pad, y + label_h - pad - 9, brand)

        probe = Code128(entry.code, barWidth=1, quiet=False)
        bar_width = min(0.33 * mm, (label_w - 2 * quiet) / probe.width)
        bars = Code128(entry.code, barHeight=11 * mm, barWidth=bar_width, quiet=False)
        bars.drawOn(pdf, x + (label_w - bars.width) / 2, y + 6.5 * mm)

        pdf.setFont('DejaVu', 7)
        pdf.drawCentredString(x + label_w / 2, y + 2.5 * mm, entry.code)
    pdf.save()
    return out.getvalue()
