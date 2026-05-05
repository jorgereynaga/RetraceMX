from __future__ import annotations

from collections.abc import Iterable

from rest_framework.permissions import BasePermission, SAFE_METHODS


STANDARD_ACTION_PERMISSIONS = {
    "list": "view",
    "retrieve": "view",
    "create": "add",
    "update": "change",
    "partial_update": "change",
    "destroy": "delete",
}


class RolePermission(BasePermission):
    """
    Resolve DRF permissions from the model/action and the role-based grants
    seeded in the database.
    """

    message = "No tienes permiso para realizar esta acción."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True

        required_permissions = self.get_required_permissions(request, view)
        if not required_permissions:
            return True
        return any(user.has_perm(code) for code in required_permissions)

    def get_required_permissions(self, request, view) -> list[str]:
        action = getattr(view, "action", None)
        permission_map = getattr(view, "permission_action_map", {}) or {}
        codes = permission_map.get(action)
        if codes is None:
            app_label, model_name = self.get_model_meta(view)
            if not app_label or not model_name:
                if request.method in SAFE_METHODS:
                    return []
                return []
            verb = STANDARD_ACTION_PERMISSIONS.get(action)
            if verb:
                return [f"{app_label}.{verb}_{model_name}"]
            if request.method in SAFE_METHODS:
                return [f"{app_label}.view_{model_name}"]
            return [f"{app_label}.change_{model_name}"]

        if isinstance(codes, str):
            return [codes]
        return list(codes)

    @staticmethod
    def get_model_meta(view) -> tuple[str, str]:
        queryset = getattr(view, "queryset", None)
        if queryset is not None and hasattr(queryset, "model") and queryset.model is not None:
            meta = queryset.model._meta
            return meta.app_label, meta.model_name
        serializer_class = getattr(view, "serializer_class", None)
        if serializer_class is not None:
            model = getattr(getattr(serializer_class, "Meta", None), "model", None)
            if model is not None:
                meta = model._meta
                return meta.app_label, meta.model_name
        return "", ""
