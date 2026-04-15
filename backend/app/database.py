import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv(Path(__file__).parent.parent / ".env")


class Base(DeclarativeBase):
    pass


_engine = None
_SessionLocal = None


def _normalize_url(url: str) -> str:
    """Ensure MySQL URLs use the pymysql driver, not the missing MySQLdb driver."""
    if url.startswith("mysql://"):
        url = url.replace("mysql://", "mysql+pymysql://", 1)
    return url


def _get_engine():
    global _engine, _SessionLocal
    if _engine is None:
        url = os.environ.get("DATABASE_URL")
        if not url:
            raise RuntimeError(
                "DATABASE_URL environment variable is not set. "
                "Copy backend/.env.example to backend/.env and fill in values."
            )
        url = _normalize_url(url)
        _engine = create_engine(url, pool_pre_ping=True)
        _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)
    return _engine, _SessionLocal


def get_db():
    _, session_factory = _get_engine()
    db = session_factory()
    try:
        yield db
    finally:
        db.close()
