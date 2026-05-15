import base64
import hashlib
from datetime import datetime, timedelta, timezone
import bcrypt
from jose import jwt
from app.core.config import settings


PASSWORD_HASH_PREFIX = "bcrypt_sha256$"


def _password_digest(password: str) -> bytes:
    digest = hashlib.sha256(password.encode("utf-8")).digest()
    return base64.b64encode(digest)


def hash_password(password: str) -> str:
    hashed = bcrypt.hashpw(_password_digest(password), bcrypt.gensalt())
    return PASSWORD_HASH_PREFIX + hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if hashed_password.startswith(PASSWORD_HASH_PREFIX):
        stored_hash = hashed_password.removeprefix(PASSWORD_HASH_PREFIX).encode("utf-8")
        return bcrypt.checkpw(_password_digest(plain_password), stored_hash)

    return bcrypt.checkpw(
        plain_password.encode("utf-8")[:72],
        hashed_password.encode("utf-8"),
    )


def create_access_token(data: dict) -> str:
    to_encode = data.copy()

    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )

    to_encode.update({"exp": expire})

    return jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )
