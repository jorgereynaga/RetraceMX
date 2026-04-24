from django.contrib import admin

from .models import PurchaseOperation, TicketItem

admin.site.register(PurchaseOperation)
admin.site.register(TicketItem)

