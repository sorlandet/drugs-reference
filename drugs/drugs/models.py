from sqlalchemy import create_engine, Column, Integer, String, TIMESTAMP, text, UniqueConstraint, Unicode
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.engine.url import URL

import settings

DeclarativeBase = declarative_base()


def db_connect():
    """Performs database connection using database settings from settings.py.
    Returns sqlalchemy engine instance.
    """
    return create_engine(URL(**settings.DATABASE))


def create_deals_table(engine):
    """"""
    DeclarativeBase.metadata.create_all(engine)


class Drug(DeclarativeBase):
    """SqlAlchemy pages model"""
    __tablename__ = "drug"
    __table_args__ = (
        UniqueConstraint('latname', 'atc_code', name='_latc_uc'),
        {'mysql_engine': 'MyISAM'}
    )

    id = Column(Integer, primary_key=True)
    page_url = Column('page_url', String(200), nullable=True)

    rusname = Column('rusname', String(250), nullable=True)
    latname = Column('latname', String(250), nullable=True)
    active_component = Column('active_component', String(250), nullable=True)
    atc_code = Column('atc_code', String(50), nullable=True)
    tn_content = Column('tn_content', String(10), nullable=True)

    status = Column(String(10), unique=False, nullable=True)

    created_at = Column('created_at', TIMESTAMP,
                        server_default=text('CURRENT_TIMESTAMP'))