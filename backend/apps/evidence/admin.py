from django.contrib import admin

from .models import CustodyEvent, EvidenceFile, PrintLog

admin.site.register(CustodyEvent)
admin.site.register(EvidenceFile)
admin.site.register(PrintLog)

