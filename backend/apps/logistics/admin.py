from django.contrib import admin

from .models import CollectionTrip, CollectionTripIncident, CollectionTripStop, CollectionTripTelemetryPoint, Route

admin.site.register(Route)
admin.site.register(CollectionTrip)
admin.site.register(CollectionTripStop)
admin.site.register(CollectionTripIncident)
admin.site.register(CollectionTripTelemetryPoint)
