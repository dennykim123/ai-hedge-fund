import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.base import Base, get_db
from app.main import app

# Import all models to register them with Base
from app.models.pm import PM  # noqa: F401
from app.models.position import Position  # noqa: F401
from app.models.trade import Trade  # noqa: F401
from app.models.nav_history import NAVHistory  # noqa: F401
from app.models.signal import Signal  # noqa: F401

TEST_DB_URL = "sqlite:///./test.db"
test_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestSession = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=test_engine)
    app.dependency_overrides[get_db] = override_get_db

    # Seed PMs
    db = TestSession()
    from app.db.seed import seed_pms
    seed_pms(db)
    db.close()

    yield

    Base.metadata.drop_all(bind=test_engine)
    app.dependency_overrides.clear()
