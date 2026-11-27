"""The database address, however the host writes it."""

from app.core.config import Settings


def test_a_hosts_postgres_address_uses_psycopg_3():
    for given in ("postgres://u:p@db.example.com:5432/kyc", "postgresql://u:p@db.example.com:5432/kyc"):
        assert Settings(DATABASE_URL=given).DATABASE_URL == "postgresql+psycopg://u:p@db.example.com:5432/kyc"


def test_an_address_naming_its_driver_is_kept():
    url = "postgresql+psycopg://u:p@localhost:5432/kyc"
    assert Settings(DATABASE_URL=url).DATABASE_URL == url
