import os

BILLO_DB_NAME = os.environ.get("BILLO_DB_NAME", "billo_db")
BILLO_DB_USER = os.environ.get("BILLO_DB_USER", "billo_user")
BILLO_DB_PASSWORD = os.environ.get("BILLO_DB_PASSWORD", "billo_password")
BILLO_DB_HOST = os.environ.get("BILLO_DB_HOST", "127.0.0.1")
BILLO_DB_PORT = os.environ.get("BILLO_DB_PORT", "3306")

BILLO_PASSWORD_RESET_TOKEN_EXPIRE_HOURS = int(
    os.environ.get("BILLO_PASSWORD_RESET_TOKEN_EXPIRE_HOURS", "1")
)
BILLO_FRONTEND_URL = os.environ.get("BILLO_FRONTEND_URL", "http://localhost:5173")


BILLO_FERNET_SECRET_KEY = os.environ.get(
    "BILLO_FERNET_SECRET_KEY", "kxmkv6vw7AMDx92BH9JSEZ7_PQqPyYsWZBAGzP0kXys="
)
""" Key used for encrypting. The default key is used for development purposes only. """

BILLO_REDIS_HOST = os.environ.get("BILLO_REDIS_HOST", "localhost")

# MinIO object storage
BILLO_MINIO_HOST = os.environ.get("BILLO_MINIO_HOST", "localhost")
_minio_port_raw = os.environ.get("BILLO_MINIO_PORT", "9000")
BILLO_MINIO_PORT: int | None = int(_minio_port_raw) if _minio_port_raw else None
"""MinIO/S3 port. Leave empty for standard HTTPS (TransIP Object Storage, etc.)."""
BILLO_MINIO_USER = os.environ.get("BILLO_MINIO_USER", "minioadmin")
BILLO_MINIO_PASSWORD = os.environ.get("BILLO_MINIO_PASSWORD", "minioadmin")
BILLO_MINIO_BUCKET = os.environ.get("BILLO_MINIO_BUCKET", "billo-dev")
BILLO_MINIO_SECURE = os.environ.get("BILLO_MINIO_SECURE", "False") == "True"
"""Whether to use HTTPS for MinIO connections. Set to True in production."""
BILLO_MINIO_REGION = os.environ.get("BILLO_MINIO_REGION", "EU")

BILLO_STORAGE_MAX_FILE_BYTES = int(
    os.environ.get("BILLO_STORAGE_MAX_FILE_BYTES", str(200 * 1024 * 1024))
)
"""Maximum upload size per file in bytes. Defaults to 200 MB."""

BILLO_STORAGE_DEFAULT_QUOTA_BYTES = int(
    os.environ.get("BILLO_STORAGE_DEFAULT_QUOTA_BYTES", str(10 * 1024 * 1024 * 1024))
)
"""Default storage quota per workspace in bytes. Defaults to 10 GB."""

BILLO_MOLLIE_API_KEY = os.environ.get("BILLO_MOLLIE_API_KEY", "test_xxxxx")
BILLO_API_URL = os.environ.get("BILLO_API_URL", "http://localhost:5000")


class BaseConfig:
    SECRET_KEY = os.environ.get("BILLO_SECRET_KEY", "secret_oohhhhhh")
    SQLALCHEMY_DATABASE_URI = (
        f"mysql://{BILLO_DB_USER}:{BILLO_DB_PASSWORD}@"
        f"{BILLO_DB_HOST}:{BILLO_DB_PORT}/"
        f"{BILLO_DB_NAME}"
    )

    MAIL_SERVER = os.environ.get("BILLO_MAIL_SERVER", "localhost")
    MAIL_PORT = int(os.environ.get("BILLO_MAIL_PORT", 1025))
    MAIL_USE_TLS = False
    MAIL_USE_SSL = os.environ.get("BILLO_MAIL_USE_SSL") == "True"
    MAIL_USERNAME = os.environ.get("BILLO_MAIL_USERNAME", "billo@mail.com")
    MAIL_PASSWORD = os.environ.get("BILLO_MAIL_PASSWORD", "12345678")
    MAIL_DEFAULT_SENDER = os.environ.get("BILLO_MAIL_DEFAULT_SENDER", "billo@mail.com")
    FILE_LOGGING = os.environ.get("BILLO_FILE_LOGGING", "False") == "True"

    # MinIO
    MINIO_HOST = BILLO_MINIO_HOST
    MINIO_PORT = BILLO_MINIO_PORT
    MINIO_USER = BILLO_MINIO_USER
    MINIO_PASSWORD = BILLO_MINIO_PASSWORD
    MINIO_BUCKET = BILLO_MINIO_BUCKET
    MINIO_SECURE = BILLO_MINIO_SECURE
    MINIO_REGION = BILLO_MINIO_REGION
    STORAGE_MAX_FILE_BYTES = BILLO_STORAGE_MAX_FILE_BYTES
    STORAGE_DEFAULT_QUOTA_BYTES = BILLO_STORAGE_DEFAULT_QUOTA_BYTES

    CELERY = {
        "broker_url": f"redis://{BILLO_REDIS_HOST}",
        "result_backend": f"redis://{BILLO_REDIS_HOST}",
        "task_ignore_result": True,
    }


class ProdConfig(BaseConfig):
    ENV = "prod"
    DEBUG = False
    SESSION_COOKIE_SAMESITE = "None"
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True


class DevConfig(BaseConfig):
    ENV = "dev"
    DEBUG = True


class TestConfig(BaseConfig):
    TESTING = True
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = "sqlite://"
