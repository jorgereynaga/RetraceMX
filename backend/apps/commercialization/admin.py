from django.contrib import admin

from .models import SaleItem, SaleOrder

admin.site.register(SaleOrder)
admin.site.register(SaleItem)

