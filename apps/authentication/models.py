from django.db import models
from django.contrib.auth.models import AbstractUser #user class, permission of the user, password handeling already hashed
from apps.common.models import BaseModel #manually created not a django library 

# Create your models here.

class User(AbstractUser, BaseModel):
    email = models.EmailField(unique=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ['username']

    def __str__(self):
        return self.email #for readability.w/o something ugly would come in printing user object or view in django admin