from django.db import models
import uuid  #universally unique identifiers

# Create your models here.
class BaseModel(models.Model):

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False) #never entered nby user, system genereated, hidden in forms
    created_at = models.DateTimeField(auto_now_add=True) #auto creates and never touches
    updated_at = models.DateField(auto_now=True) #overwrites every time .save() is called

    class Meta: # tells django not to create a common_BaseModel useless table
        abstract = True