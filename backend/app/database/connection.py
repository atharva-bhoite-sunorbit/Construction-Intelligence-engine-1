import os
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./construction_intelligence.db")

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    echo=False
)

# Enable foreign keys for SQLite and perform self-healing column migrations
if DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        # Ensure intelligence_data_json column exists
        try:
            cursor.execute("PRAGMA table_info(geotechnical_reports)")
            cols = [row[1] for row in cursor.fetchall()]
            if cols and "intelligence_data_json" not in cols:
                cursor.execute("ALTER TABLE geotechnical_reports ADD COLUMN intelligence_data_json TEXT")
            if cols and "analysis_params_json" not in cols:
                cursor.execute("ALTER TABLE geotechnical_reports ADD COLUMN analysis_params_json TEXT")
            if cols and "summary_json" not in cols:
                cursor.execute("ALTER TABLE geotechnical_reports ADD COLUMN summary_json TEXT")
            if cols and "report_code" not in cols:
                cursor.execute("ALTER TABLE geotechnical_reports ADD COLUMN report_code VARCHAR(100)")
            if cols and "tenant_id" not in cols:
                cursor.execute("ALTER TABLE geotechnical_reports ADD COLUMN tenant_id VARCHAR(100) DEFAULT 'default'")
        except Exception:
            pass
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
