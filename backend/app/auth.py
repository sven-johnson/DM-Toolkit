import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session as DBSession

load_dotenv(Path(__file__).parent.parent / ".env")

SECRET_KEY: str = os.environ["SECRET_KEY"]
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))

ph = PasswordHasher()
router = APIRouter()
security = HTTPBearer()


def seed_initial_user() -> None:
    """Create the first user account if the users table is empty.

    Called once at startup.  Reads INITIAL_USERNAME (default: "admin") and
    INITIAL_PASSWORD from the environment.  Raises RuntimeError if the table
    is empty and INITIAL_PASSWORD is not set — the app would be unloggable.
    """
    from .database import get_db  # local import avoids any module-load ordering issues
    from .models import User

    db = next(get_db())
    try:
        if db.query(User).count() > 0:
            return
        username = os.environ.get("INITIAL_USERNAME", "admin")
        password = os.environ.get("INITIAL_PASSWORD")
        if not password:
            raise RuntimeError(
                "Users table is empty and INITIAL_PASSWORD is not set. "
                "Set INITIAL_PASSWORD in the Railway dashboard (or backend/.env) "
                "to create the first account."
            )
        db.add(User(username=username, hashed_password=ph.hash(password)))
        db.commit()
        print(f"[dm-toolkit] Created initial user '{username}'")
    finally:
        db.close()


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode["exp"] = expire
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str | None = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return username
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


# ---------------------------------------------------------------------------
# Imports placed after function definitions to avoid circular-import issues
# ---------------------------------------------------------------------------

from .database import get_db  # noqa: E402
from .models import User  # noqa: E402
from .schemas import (  # noqa: E402
    LoginRequest,
    MeResponse,
    TokenResponse,
    UpdatePasswordRequest,
    UpdateUsernameRequest,
)


def _get_user(username: str, db: DBSession) -> "User":
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return user


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: DBSession = Depends(get_db)) -> TokenResponse:
    user = db.query(User).filter(User.username == body.username).first()
    # Deliberate: same error whether username or password is wrong (no enumeration)
    invalid = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user:
        raise invalid
    try:
        ph.verify(user.hashed_password, body.password)
    except VerifyMismatchError:
        raise invalid
    # Transparently upgrade hash if argon2 parameters have changed
    if ph.check_needs_rehash(user.hashed_password):
        user.hashed_password = ph.hash(body.password)
        db.commit()
    return TokenResponse(access_token=create_access_token({"sub": user.username}))


@router.get("/me", response_model=MeResponse)
def get_me(
    current_username: str = Depends(verify_token),
    db: DBSession = Depends(get_db),
) -> MeResponse:
    user = _get_user(current_username, db)
    return MeResponse(username=user.username)


@router.put("/username", response_model=MeResponse)
def update_username(
    body: UpdateUsernameRequest,
    current_username: str = Depends(verify_token),
    db: DBSession = Depends(get_db),
) -> MeResponse:
    user = _get_user(current_username, db)
    try:
        ph.verify(user.hashed_password, body.current_password)
    except VerifyMismatchError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    new = body.new_username.strip()
    if not new:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username cannot be empty")
    taken = db.query(User).filter(User.username == new).first()
    if taken and taken.id != user.id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already taken")
    user.username = new
    db.commit()
    return MeResponse(username=user.username)


@router.put("/password", status_code=status.HTTP_204_NO_CONTENT)
def update_password(
    body: UpdatePasswordRequest,
    current_username: str = Depends(verify_token),
    db: DBSession = Depends(get_db),
) -> None:
    user = _get_user(current_username, db)
    try:
        ph.verify(user.hashed_password, body.current_password)
    except VerifyMismatchError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    if not body.new_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password cannot be empty")
    if body.new_password != body.confirm_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New password and confirmation do not match")
    user.hashed_password = ph.hash(body.new_password)
    db.commit()
