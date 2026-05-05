from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import Role, User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    fieldsets = DjangoUserAdmin.fieldsets + (("Datos de negocio", {"fields": ("phone", "roles")}),)
    list_display = ("username", "email", "first_name", "last_name", "is_staff", "is_active")
    filter_horizontal = (*DjangoUserAdmin.filter_horizontal, "roles")


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "is_active")
    search_fields = ("code", "name")
