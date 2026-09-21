from django.apps import AppConfig


class InventoryConfig(AppConfig):
    name = 'inventory'

    def ready(self):
        from django.contrib.auth import get_user_model
        from django.db.models.signals import pre_save

        from .security import revoke_tokens_on_password_change

        pre_save.connect(revoke_tokens_on_password_change, sender=get_user_model(), dispatch_uid='revoke-tokens-on-password-change')
