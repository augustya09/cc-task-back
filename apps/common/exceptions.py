from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context) #django default exception handeller library 

    if response is None:
        return Response(
            {"success": False, "message": "Internal server error.", "errors": {}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    if isinstance(response.data, dict) and "detail" in response.data:
        message = str(response.data["detail"])
        errors = {}
    else:
        message = "Validation Failed" if response.status_code == 400 else "Request failed."
        errors = response.data

    response.data = {"success": False, "message": message, "errors": errors}
    return response