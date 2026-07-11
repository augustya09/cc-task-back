from django.db import connection
from rest_framework.response import Response
from rest_framework.views import APIView

#create your models here

class HealthView(APIView):

    authentication_classes = []
    permission_classes = []

    def get(self, request):

        try:

            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")

            return Response({
                "status": "healthy"
            })

        except Exception:

            return Response(
                {
                    "status": "unhealthy"
                },
                status=500
            )