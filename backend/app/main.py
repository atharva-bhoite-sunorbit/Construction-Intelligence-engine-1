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
        if "intelligence_data_json" not in geo_cols:
            conn.execute(text("ALTER TABLE geotechnical_reports ADD COLUMN intelligence_data_json TEXT"))
        if "report_code" not in geo_cols:
            conn.execute(text("ALTER TABLE geotechnical_reports ADD COLUMN report_code VARCHAR(100)"))
        if "tenant_id" not in geo_cols:
            conn.execute(text("ALTER TABLE geotechnical_reports ADD COLUMN tenant_id VARCHAR(100) DEFAULT 'default'"))

        # Check blockers hindrance columns
        blk_result = conn.execute(text("PRAGMA table_info(blockers)")).fetchall()
        blk_cols = [r[1] for r in blk_result]
        if "hindrance_state" not in blk_cols:
            conn.execute(text("ALTER TABLE blockers ADD COLUMN hindrance_state VARCHAR(50) DEFAULT 'ACTIVE_HINDRANCE'"))
        if "delay_impact_days" not in blk_cols:
            conn.execute(text("ALTER TABLE blockers ADD COLUMN delay_impact_days FLOAT DEFAULT 0.0"))
        if "difficulty_cause" not in blk_cols:
            conn.execute(text("ALTER TABLE blockers ADD COLUMN difficulty_cause VARCHAR(255)"))

        # Check activities governance columns
        act_result = conn.execute(text("PRAGMA table_info(activities)")).fetchall()
        act_cols = [r[1] for r in act_result]
        if "assigned_role" not in act_cols:
            conn.execute(text("ALTER TABLE activities ADD COLUMN assigned_role VARCHAR(50) DEFAULT 'Site Manager'"))
        if "stage1_status" not in act_cols:
            conn.execute(text("ALTER TABLE activities ADD COLUMN stage1_status VARCHAR(50) DEFAULT 'PENDING'"))
        if "stage1_validated_by" not in act_cols:
            conn.execute(text("ALTER TABLE activities ADD COLUMN stage1_validated_by VARCHAR(255)"))
        if "stage1_validated_at" not in act_cols:
            conn.execute(text("ALTER TABLE activities ADD COLUMN stage1_validated_at DATETIME"))
        if "stage1_notes" not in act_cols:
            conn.execute(text("ALTER TABLE activities ADD COLUMN stage1_notes TEXT"))
        if "pm_verification_status" not in act_cols:
            conn.execute(text("ALTER TABLE activities ADD COLUMN pm_verification_status VARCHAR(50) DEFAULT 'PENDING'"))
        if "pm_verified_by" not in act_cols:
            conn.execute(text("ALTER TABLE activities ADD COLUMN pm_verified_by VARCHAR(255)"))
        if "pm_verified_at" not in act_cols:
            conn.execute(text("ALTER TABLE activities ADD COLUMN pm_verified_at DATETIME"))
        if "pm_verification_notes" not in act_cols:
            conn.execute(text("ALTER TABLE activities ADD COLUMN pm_verification_notes TEXT"))
        if "final_recorded" not in act_cols:
            conn.execute(text("ALTER TABLE activities ADD COLUMN final_recorded BOOLEAN DEFAULT 0"))

        # Partition activities into the 3 roles: Admin, Project Manager, Site Manager
        conn.execute(text("""
            UPDATE activities
            SET assigned_role = 'Admin'
            WHERE (
                LOWER(phase) LIKE '%handover%' OR
                LOWER(work_package) LIKE '%survey%' OR
                LOWER(name) LIKE '%survey%' OR
                LOWER(name) LIKE '%fencing%' OR
                LOWER(work_package) LIKE '%mobilization%' OR
                LOWER(work_package) LIKE '%testing%' OR
                LOWER(name) LIKE '%commissioning%' OR
                LOWER(name) LIKE '%compliance%' OR
                LOWER(name) LIKE '%cleaning%'
            )
        """))

        conn.execute(text("""
            UPDATE activities
            SET assigned_role = 'Project Manager'
            WHERE (assigned_role IS NULL OR assigned_role != 'Admin') AND (
                is_critical = 1 OR
                LOWER(work_package) LIKE '%foundation%' OR
                LOWER(work_package) LIKE '%structure%' OR
                LOWER(work_package) LIKE '%structural steel%' OR
                LOWER(name) LIKE '%footing%' OR
                LOWER(name) LIKE '%plinth%' OR
                LOWER(name) LIKE '%column%' OR
                LOWER(name) LIKE '%slab%' OR
                LOWER(name) LIKE '%beam%' OR
                LOWER(name) LIKE '%crane%'
            )
        """))

        conn.execute(text("""
            UPDATE activities
            SET assigned_role = 'Site Manager'
            WHERE assigned_role IS NULL OR (assigned_role != 'Admin' AND assigned_role != 'Project Manager')
        """))

        # Harmonize already-approved activities (if any approved previously)
        conn.execute(text("""
            UPDATE activities
            SET stage1_status = 'APPROVED',
                pm_verification_status = 'VERIFIED',
                final_recorded = 1
            WHERE validation_status = 'APPROVED'
        """))
        conn.commit()
except Exception as mig_err:
    print(f"Migration note: {mig_err}")

app = FastAPI(
    title="Construction Intelligence Platform API",
    description="Enterprise Autonomous AI/ML Construction Planning, CPM Scheduling & Geotechnical Intelligence Engine",
    version="1.0.0"
)

# Enable CORS for frontend Vite dev server & external systems
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def enforce_external_api_key_boundary(request, call_next):
    """
    Guarantees strict module isolation:
    External API keys (geo_live_* / geo_test_*) are strictly permitted ONLY
    under /api/v1/geotechnical/. Any attempt to access internal modules
    (/civil, /electrical, /plumbing, /boq, /financial, /admin, /users, etc.)
    is immediately denied with HTTP 403 Forbidden.
    """
    auth_header = request.headers.get("authorization", "")
    api_key_header = request.headers.get("x-api-key", "")
    is_external_key = (
        "geo_live_" in auth_header or "geo_test_" in auth_header
        or "geo_live_" in api_key_header or "geo_test_" in api_key_header
    )

    if is_external_key:
        path = request.url.path
        if not path.startswith("/api/v1/geotechnical") and path not in ["/docs", "/openapi.json"]:
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=403,
                content={
                    "error": "Forbidden",
                    "detail": "Geotechnical API keys are strictly confined to /api/v1/geotechnical/ endpoints and cannot access internal platform modules (/civil, /electrical, /plumbing, /boq, /financial, /admin, /users)."
                }
            )

    return await call_next(request)


# Include all API Routers
from backend.app.api import geotechnical_external_v1

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
app.include_router(geotechnical_external_v1.router)


@app.get("/")
@app.get("/health")
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
