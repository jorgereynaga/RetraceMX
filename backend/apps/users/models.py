from __future__ import annotations

from django.contrib.auth.models import AbstractUser, Permission
from django.db import models

from apps.core.models import UUIDTimeStampedModel


class User(AbstractUser, UUIDTimeStampedModel):
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=32, blank=True)

    def __str__(self) -> str:
        return self.get_username() or self.email


class Role(UUIDTimeStampedModel):
    code = models.SlugField(max_length=50, unique=True)
    name = models.CharField(max_length=120)
    permissions = models.ManyToManyField(Permission, blank=True, related_name="acopio_roles")
    is_active = models.BooleanField(default=True)

    def __str__(self) -> str:
        return self.name

