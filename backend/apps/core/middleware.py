from __future__ import annotations

from django.conf import settings
from django.http import HttpResponse


class SimpleCORSMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        origin = request.headers.get("Origin")
        if request.method == "OPTIONS" and self._is_allowed_origin(origin):
            response = HttpResponse(status=200)
            self._apply_cors_headers(response, origin)
            return response

        response = self.get_response(request)
        if self._is_allowed_origin(origin):
            self._apply_cors_headers(response, origin)
        return response

    def _is_allowed_origin(self, origin: str | None) -> bool:
        return bool(origin) and origin in getattr(settings, "CORS_ALLOWED_ORIGINS", [])

    def _apply_cors_headers(self, response, origin: str) -> None:
        response["Access-Control-Allow-Origin"] = origin
        vary = response.get("Vary")
        response["Vary"] = f"{vary}, Origin" if vary and "Origin" not in vary else "Origin"
        response["Access-Control-Allow-Credentials"] = "true"
        response["Access-Control-Allow-Headers"] = "Authorization, Content-Type, X-CSRFToken, X-Requested-With, Accept, Origin"
        response["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        response["Access-Control-Expose-Headers"] = "Content-Disposition"
