import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.models.user import User
from app.schemas.user import (
    EmailVerificationResend,
    MessageResponse,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserResponse,
)
from app.services.email_service import send_verification_email


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)


def _hash_verification_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _new_verification_token() -> tuple[str, str, datetime]:
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(
        hours=settings.EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS
    )
    return token, _hash_verification_token(token), expires_at


def _verification_url(request: Request, token: str) -> str:
    if settings.PUBLIC_BACKEND_URL:
        base_url = settings.PUBLIC_BACKEND_URL.rstrip("/")
    else:
        base_url = str(request.base_url).rstrip("/")
    return f"{base_url}/auth/verify-email?token={token}"


@router.post("/register", response_model=UserResponse)
def register_user(
    payload: UserCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    existing_email = db.query(User).filter(User.email == payload.email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    existing_username = db.query(User).filter(User.username == payload.username).first()
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )

    token = None
    token_hash = None
    expires_at = None
    if settings.EMAIL_VERIFICATION_ENABLED:
        token, token_hash, expires_at = _new_verification_token()

    new_user = User(
        email=payload.email,
        username=payload.username,
        password_hash=hash_password(payload.password),
        chess_level=payload.chess_level,
        target_rating=payload.target_rating,
        is_email_verified=not settings.EMAIL_VERIFICATION_ENABLED,
        email_verification_token_hash=token_hash,
        email_verification_expires_at=expires_at,
    )

    db.add(new_user)

    if settings.EMAIL_VERIFICATION_ENABLED:
        try:
            send_verification_email(
                new_user.email,
                new_user.username,
                _verification_url(request, token),
            )
        except RuntimeError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=str(exc),
            ) from exc
        except Exception as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Account was not created because the confirmation email could not be sent",
            ) from exc

    db.commit()
    db.refresh(new_user)

    return new_user


@router.get("/verify-email", response_model=MessageResponse)
def verify_email(token: str, db: Session = Depends(get_db)):
    token_hash = _hash_verification_token(token)
    user = (
        db.query(User)
        .filter(User.email_verification_token_hash == token_hash)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification link"
        )

    expires_at = user.email_verification_expires_at
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at and expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification link has expired"
        )

    user.is_email_verified = True
    user.email_verification_token_hash = None
    user.email_verification_expires_at = None
    db.commit()

    return {"detail": "Email verified. You can now log in."}


@router.post("/resend-verification", response_model=MessageResponse)
def resend_verification_email(
    payload: EmailVerificationResend,
    request: Request,
    db: Session = Depends(get_db)
):
    if not settings.EMAIL_VERIFICATION_ENABLED:
        return {"detail": "Email verification is not enabled."}

    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        return {"detail": "If an account exists, a confirmation email has been sent."}

    if user.is_email_verified:
        return {"detail": "Email is already verified."}

    token, token_hash, expires_at = _new_verification_token()
    user.email_verification_token_hash = token_hash
    user.email_verification_expires_at = expires_at

    try:
        send_verification_email(
            user.email,
            user.username,
            _verification_url(request, token),
        )
    except RuntimeError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Confirmation email could not be sent",
        ) from exc

    db.commit()
    return {"detail": "Confirmation email sent."}


@router.post("/login", response_model=TokenResponse)
def login_user(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    if settings.EMAIL_VERIFICATION_ENABLED and not user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please confirm your email before logging in"
        )

    token = create_access_token(
        data={
            "sub": str(user.id),
            "email": user.email
        }
    )

    return {
        "access_token": token,
        "token_type": "bearer"
    }
