from django.contrib import admin

from .models import Material, MaterialFamily, PriceList, PriceListItem

admin.site.register(MaterialFamily)
admin.site.register(Material)
admin.site.register(PriceList)
admin.site.register(PriceListItem)

