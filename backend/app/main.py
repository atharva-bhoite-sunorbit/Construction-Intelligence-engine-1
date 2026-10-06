import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.database.connection import engine, Base
from backend.app.models.all_models import *
from backend.app.api import (
    auth, projects, activities, dependencies, schedule,
    resources, progress, predictions, impact, forecasts, ai, reports, audit, environmental, geotechnical
)

# Initialize tables
Base.metadata.create_all(bind=engine)

# Self-healing migration for SQLite
try:
    from sqlalchemy import text
    with engine.connect() as conn:
        result = conn.execute(text("PRAGMA table_info(projects)")).fetchall()
        cols = [r[1] for r in result]
        if "stage_engineers_json" not in cols:
            conn.execute(text("ALTER TABLE projects ADD COLUMN stage_engineers_json TEXT"))
            conn.commit()

        # Check daily_progress validation columns
        prog_result = conn.execute(text("PRAGMA table_info(daily_progress)")).fetchall()
        prog_cols = [r[1] for r in prog_result]
        if "validation_status" not in prog_cols:
            conn.execute(text("ALTER TABLE daily_progress ADD COLUMN validation_status VARCHAR(50) DEFAULT 'PENDING'"))
        if "validated_by" not in prog_cols:
            conn.execute(text("ALTER TABLE daily_progress ADD COLUMN validated_by VARCHAR(255)"))
        if "validated_at" not in prog_cols:
            conn.execute(text("ALTER TABLE daily_progress ADD COLUMN validated_at DATETIME"))
        if "validation_checklist_json" not in prog_cols:
            conn.execute(text("ALTER TABLE daily_progress ADD COLUMN validation_checklist_json TEXT"))
        if "validation_notes" not in prog_cols:
            conn.execute(text("ALTER TABLE daily_progress ADD COLUMN validation_notes TEXT"))
        
        # Check site_environmental_logs geotechnical columns
        env_result = conn.execute(text("PRAGMA table_info(site_environmental_logs)")).fetchall()
        env_cols = [r[1] for r in env_result]
        if "geotechnical_details_json" not in env_cols:
            conn.execute(text("ALTER TABLE site_environmental_logs ADD COLUMN geotechnical_details_json TEXT"))

        # Check geotechnical_reports columns
        geo_result = conn.execute(text("PRAGMA table_info(geotechnical_reports)")).fetchall()
        geo_cols = [r[1] for r in geo_result]
        if "analysis_params_json" not in geo_cols:
            conn.execute(text("ALTER TABLE geotechnical_reports ADD COLUMN analysis_params_json TEXT"))
        if "summary_json" not in geo_cols:
            conn.execute(text("ALTER TABLE geotechnical_reports ADD COLUMN summary_json TEXT"))
        conn.commit()
except Exception as mig_err:
    print(f"Migration note: {mig_err}")

app = FastAPI(
    title="Construction Intelligence Platform API",
    description="Standalone AI/ML Construction Planning, Monitoring & Prediction System",
    version="1.0.0"
)

# Enable CORS for frontend Vite dev server & production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all API Routers
app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(activities.router)
app.include_router(dependencies.router)
app.include_router(schedule.router)
app.include_router(resources.router)
app.include_router(progress.router)
app.include_router(predictions.router)
app.include_router(impact.router)
app.include_router(forecasts.router)
app.include_router(ai.router)
app.include_router(reports.router)
app.include_router(audit.router)
app.include_router(environmental.router)
app.include_router(geotechnical.router)

@app.get("/")
def health_check():
    return {
        "status": "healthy",
        "system": "Construction Intelligence Platform",
        "version": "1.0.0",
        "mode": "Autonomous ML & Decision Support Engine"
    }

@app.get("/api/dashboard/stats")
def get_global_dashboard_stats(db_session = None):
    """Provides executive top KPI metrics across all projects."""
    from backend.app.database.connection import SessionLocal
    db = SessionLocal()
    try:
        projects = db.query(Project).all()
        total_projects = len(projects)
        active_projects = sum(1 for p in projects if p.status in ["IN_PROGRESS", "PLANNING"])

        all_acts = db.query(Activity).all()
        total_acts = len(all_acts)
        delayed_acts = sum(1 for a in all_acts if a.status == "DELAYED")
        avg_progress = round(sum(a.progress_percent for a in all_acts) / max(1, total_acts), 1) if total_acts > 0 else 0.0

        high_risk_acts = db.query(MLDelayPrediction).filter(MLDelayPrediction.risk_level.in_(["HIGH", "CRITICAL"])).count()

        # Cumulative shortages
        labour_res = db.query(Resource).filter(Resource.category == "Labour").all()
        total_labour_avail = sum(r.available_capacity for r in labour_res)

        return {
            "total_projects": total_projects,
            "active_projects": active_projects,
            "overall_progress": avg_progress,
            "delayed_activities": delayed_acts,
            "high_risk_activities": high_risk_acts,
            "total_labour_available": int(total_labour_avail),
            "critical_path_activities": sum(1 for a in all_acts if a.is_critical),
            "total_blockers_open": db.query(Blocker).filter(Blocker.status != "RESOLVED").count()
        }
    finally:
        db.close()
