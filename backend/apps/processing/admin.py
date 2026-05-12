from django.contrib import admin

from .models import MaterialProcess, MaterialProcessInput, MaterialProcessOutput, MaterialProcessWaste, ProcessType


@admin.register(ProcessType)
class ProcessTypeAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "active", "created_at")
    search_fields = ("code", "name")
    list_filter = ("active",)


class MaterialProcessInputInline(admin.TabularInline):
    model = MaterialProcessInput
    extra = 0


class MaterialProcessOutputInline(admin.TabularInline):
    model = MaterialProcessOutput
    extra = 0


class MaterialProcessWasteInline(admin.TabularInline):
    model = MaterialProcessWaste
    extra = 0


@admin.register(MaterialProcess)
class MaterialProcessAdmin(admin.ModelAdmin):
    list_display = ("folio", "process_type", "collection_center", "status", "process_date", "created_at")
    list_filter = ("status", "process_type", "collection_center")
    search_fields = ("folio", "notes")
    inlines = [MaterialProcessInputInline, MaterialProcessOutputInline, MaterialProcessWasteInline]
