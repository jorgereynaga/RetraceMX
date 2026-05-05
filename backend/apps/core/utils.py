from __future__ import annotations

from collections import Counter

from django.utils import timezone


def protected_delete_message(instance_label: str, protected_objects) -> dict:
    counts = Counter(obj._meta.verbose_name for obj in protected_objects)
    dependencies = ", ".join(f"{count} {label}" if count > 1 else label for label, count in counts.items())
    if not dependencies:
        dependencies = "registros relacionados"
    return {
        "detail": f"No se puede eliminar {instance_label} porque tiene registros relacionados: {dependencies}.",
        "dependencies": [
            {"model": str(label), "count": count}
            for label, count in counts.items()
        ],
    }


def generate_folio(prefix: str) -> str:
    stamp = timezone.localtime(timezone.now()).strftime("%Y%m%d%H%M%S%f")
    return f"{prefix}-{stamp}"
