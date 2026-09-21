"""Protections that sit around the app rather than inside one feature."""
from django.contrib import admin
from django.core.cache import cache
from django.http import HttpResponse
from django.utils.translation import gettext as _
from rest_framework.throttling import BaseThrottle

ADMIN_LOGIN_ATTEMPTS = 5
ADMIN_LOCK_SECONDS = 15 * 60


def client_ident(request):
    """The visitor's IP, read the same way as DRF's login throttle (NUM_PROXIES aware)."""
    return BaseThrottle().get_ident(request)


def admin_login(request, extra_context=None):
    """Django admin's login page, locked for 15 minutes after 5 wrong passwords from one address."""
    key = f'admin-login-failures:{client_ident(request)}'
    if request.method == 'POST' and cache.get(key, 0) >= ADMIN_LOGIN_ATTEMPTS:
        return HttpResponse(_('Too many failed logins. Try again in 15 minutes.'), status=429)

    response = admin.site.login(request, extra_context)
    if request.method == 'POST':
        if request.user.is_authenticated:
            cache.delete(key)
        else:
            cache.add(key, 0, ADMIN_LOCK_SECONDS)
            cache.incr(key)
    return response


def excel_safe(value):
    """Stop spreadsheet apps from running text that starts like a formula (=, +, -, @)."""
    if isinstance(value, str) and value[:1] in ('=', '+', '-', '@', '\t', '\r'):
        return "'" + value
    return value


def revoke_tokens_on_password_change(sender, instance, **kwargs):
    """A new password logs the user out everywhere: every refresh token they hold stops working."""
    from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

    if not instance.pk:
        return
    old = sender.objects.filter(pk=instance.pk).values_list('password', flat=True).first()
    if old is not None and old != instance.password:
        for token in OutstandingToken.objects.filter(user_id=instance.pk):
            BlacklistedToken.objects.get_or_create(token=token)
