from __future__ import annotations

from django.utils import timezone


def generate_folio(prefix: str) -> str:
    stamp = timezone.localtime(timezone.now()).strftime("%Y%m%d%H%M%S%f")
    return f"{prefix}-{stamp}"
