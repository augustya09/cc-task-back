from rest_framework.routers import DefaultRouter
from .views import TeamViewSet

#router auto genertaes url on custom @. no need to write indv. path

router = DefaultRouter()
router.register(r"teams", TeamViewSet, basename="team")

urlpatterns = router.urls