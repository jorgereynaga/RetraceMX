from django.contrib import admin

from .models import CommercialRole, CollectionCenter, Driver, PersonOrCompany, Vehicle


@admin.register(CommercialRole)
class CommercialRoleAdmin(admin.ModelAdmin):
    list_display = ("code", "name")


@admin.register(PersonOrCompany)
class PersonOrCompanyAdmin(admin.ModelAdmin):
    list_display = ("legal_name", "trade_name", "kind", "is_active")
    list_filter = ("kind", "is_active")
    search_fields = ("legal_name", "trade_name", "tax_id")


@admin.register(CollectionCenter)
class CollectionCenterAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "kind", "latitude", "longitude", "is_active")
    list_filter = ("kind", "is_active")
    search_fields = ("code", "name", "address")


@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = ("plate_number", "label", "expected_km_per_liter", "is_active")
    search_fields = ("plate_number", "label")


@admin.register(Driver)
class DriverAdmin(admin.ModelAdmin):
    list_display = ("person", "license_number", "is_active")
    search_fields = ("person__legal_name", "person__trade_name", "license_number")
