from django.contrib import admin

from .models import ScaleReading, WeighingSession

admin.site.register(WeighingSession)
admin.site.register(ScaleReading)

