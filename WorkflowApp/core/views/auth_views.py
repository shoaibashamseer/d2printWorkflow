from django.contrib.auth import authenticate
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):

    username = request.data.get("username")
    password = request.data.get("password")

    user = authenticate(
        username=username,
        password=password
    )

    if not user:
        return Response(
            {"error": "Invalid credentials"},
            status=400
        )

    token, _ = Token.objects.get_or_create(
        user=user
    )

    profile = getattr(
        user,
        "userprofile",
        None
    )

    role = None
    user_type = None
    must_change_password = False

    if profile:
        must_change_password = profile.must_change_password

        if profile.role:
            role = profile.role.name
            user_type = profile.role.user_type

    print(
        "LOGIN DEBUG:",
        "USER =", user.username,
        "PROFILE =", profile,
        "ROLE =", role,
        "USER TYPE =", user_type
    )

    return Response({
        "token": token.key,
        "user_id": user.id,
        "username": user.username,
        "role": role,
        "user_type": user_type,
        "must_change_password": must_change_password,
    })
