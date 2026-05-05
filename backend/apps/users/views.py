from rest_framework import viewsets
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Role, User
from .serializers import LoginSerializer, RoleSerializer, UserSerializer


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {
                "token": token.key,
                "user": UserSerializer(user).data,
            }
        )


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.prefetch_related("roles").all().order_by("username")
    serializer_class = UserSerializer
    permission_classes = [IsAdminUser]


class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all().order_by("code")
    serializer_class = RoleSerializer
    permission_classes = [IsAdminUser]
