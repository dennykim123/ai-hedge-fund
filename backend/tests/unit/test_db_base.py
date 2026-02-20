"""db/base - get_db 제너레이터 테스트"""

from app.db.base import get_db, Base


def test_get_db_yields_session():
    gen = get_db()
    db = next(gen)
    assert db is not None
    # 정상 종료 (finally에서 close 호출)
    try:
        next(gen)
    except StopIteration:
        pass


def test_get_db_closes_on_exit():
    from unittest.mock import patch, MagicMock

    mock_session = MagicMock()
    with patch("app.db.base.SessionLocal", return_value=mock_session):
        gen = get_db()
        db = next(gen)
        try:
            next(gen)
        except StopIteration:
            pass
        mock_session.close.assert_called_once()


def test_base_is_declarative_base():
    from sqlalchemy.orm import DeclarativeBase
    assert issubclass(Base, DeclarativeBase)
