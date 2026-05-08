from cryptography.fernet import Fernet

from app.config import BILLO_FERNET_SECRET_KEY

fernet = Fernet(BILLO_FERNET_SECRET_KEY)


def encrypt(value: str):
    return fernet.encrypt(value.encode()).decode()


def decrypt(value: str):
    return fernet.decrypt(value.encode()).decode()
