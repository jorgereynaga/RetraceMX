from django.contrib.auth import authenticate
from rest_framework import serializers

from .models import Role, User


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=False)
    roles = serializers.PrimaryKeyRelatedField(queryset=Role.objects.all(), many=True, required=False)
    role_codes = serializers.SerializerMethodField()
    role_names = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "phone",
            "is_active",
            "is_staff",
            "is_superuser",
            "roles",
            "role_codes",
            "role_names",
            "password",
        ]
        read_only_fields = ["is_staff", "is_superuser"]

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        roles = validated_data.pop("roles", [])
        user = User(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()
        if roles:
            user.roles.set(roles)
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        roles = validated_data.pop("roles", None)
        user = super().update(instance, validated_data)
        if password:
            user.set_password(password)
            user.save(update_fields=["password"])
        if roles is not None:
            user.roles.set(roles)
        return user

    def get_role_names(self, obj):
        return [role.name for role in obj.roles.all()]

    def get_role_codes(self, obj):
        return [role.code for role in obj.roles.all()]


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ["id", "code", "name", "permissions", "is_active"]


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        login_value = attrs["username"]
        user = authenticate(username=login_value, password=attrs["password"])
        if not user and "@" in login_value:
            try:
                matched = User.objects.get(email__iexact=login_value)
            except User.DoesNotExist:
                matched = None
            if matched:
                user = authenticate(username=matched.username, password=attrs["password"])
        if not user:
            raise serializers.ValidationError("Credenciales inválidas.")
        attrs["user"] = user
        return attrs
