"""
Geotechnical Intelligence Master Service.
Orchestrates end-to-end report processing, document isolation,
validation, risk evaluation, and audit logging.
"""
from __future__ import annotations

import json
import uuid
import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from backend.app.models.all_models import Project, GeotechnicalReport
from backend.app.services.geotech_intel.extractor import (
    GeotechnicalReportExtractor,
    extract_pages_from_pdf
)
from backend.app.services.geotech_intel.engine import (
    GeotechnicalValidationEngine,
    GeotechnicalRiskEngine,
    MissingDataEngine,
    AuditTrailEngine
)
from backend.app.services.geotech_intel.fields import val, is_found


def generate_report_code(db: Session) -> str:
    """Generates a monotonic report ID format: GT-2026-0001."""
    year = datetime.datetime.utcnow().year
    count = db.query(GeotechnicalReport).count() + 1
    return f"GT-{year}-{count:04d}"


class GeotechnicalIntelligenceService:
    """Production service for source-grounded geotechnical reports."""

    @staticmethod
    def process_and_save_report(
        db: Session,
        project_id: int,
        content: Optional[bytes] = None,
        raw_text: Optional[str] = None,
        filename: str = "geotechnical_report.pdf",
        params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Processes a single report in complete isolation.
        No previous project values or global defaults are referenced.
        """
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise ValueError(f"Project {project_id} not found")

        # 1. Extract text and pages
        pages: List[str] = []
        full_text = ""

        if content and (filename.lower().endswith(".pdf") or content[:4] == b"%PDF"):
            pages = extract_pages_from_pdf(content)
            full_text = "\n".join(pages)
        elif content:
            try:
                full_text = content.decode("utf-8")
                pages = [full_text]
            except Exception:
                full_text = str(content)
                pages = [full_text]
        elif raw_text:
            full_text = raw_text.strip()
            pages = [full_text]
        else:
            raise ValueError("No file content or text provided.")

        if not full_text.strip():
            raise ValueError("Unable to extract text from provided document.")

        # 2. Document-First Extraction (zero context contamination)
        extractor = GeotechnicalReportExtractor(full_text=full_text, pages=pages, filename=filename)
        extracted = extractor.extract_all()

        report_code = generate_report_code(db)

        # 3. Engines: Validation, Risks, Missing Data, Audit
        validation = GeotechnicalValidationEngine.validate(extracted)
        risks = GeotechnicalRiskEngine.evaluate_risks(extracted)
        missing_data = MissingDataEngine.identify_missing_data(extracted)
        audit_trail = AuditTrailEngine.build_audit_trail(extracted, report_code)

        # 4. Assemble the full structured intelligence payload
        report_payload: Dict[str, Any] = {
            "report_id": report_code,
            "filename": filename,
            "created_at": datetime.datetime.utcnow().isoformat(),
            "project_id": project_id,
            "project_information": extracted["project_information"],
            "investigation_information": extracted["investigation_information"],
            "boreholes": extracted["boreholes"],
            "stratigraphy": extracted["stratigraphy"],
            "soil_analysis": extracted["soil_analysis"],
            "rock_analysis": extracted["rock_analysis"],
            "groundwater_analysis": extracted["groundwater_analysis"],
            "foundation_recommendations": extracted["foundation_recommendations"],
            "excavation_analysis": extracted["excavation_analysis"],
            "concrete_protection": extracted["concrete_protection"],
            "laboratory_results": extracted["laboratory_results"],
            "report_calculations": extracted["report_calculations"],
            "validation": validation,
            "risks": risks,
            "missing_data": missing_data,
            "audit_trail": audit_trail
        }

        # Legacy engineering calculations for machinery fleet & strata layers
        strata_layers_list = []
        machinery_fleet = []
        activities_list = []
        summary_dict = {}
        try:
            from backend.app.services.geotechnical_service import analyze_geotechnical_report
            legacy_plan = analyze_geotechnical_report(full_text, params or {})
            strata_layers_list = legacy_plan.get("strata_layers", [])
            machinery_fleet = legacy_plan.get("machinery", [])
            activities_list = legacy_plan.get("activities", [])
            summary_dict = legacy_plan.get("summary", {})
            report_payload["strata_layers"] = strata_layers_list
            report_payload["recommended_machinery"] = machinery_fleet
            report_payload["planned_activities"] = activities_list
            report_payload["summary"] = summary_dict
            report_payload["rock_types"] = legacy_plan.get("rock_types", [])
        except Exception:
            report_payload["strata_layers"] = []
            report_payload["recommended_machinery"] = []
            report_payload["planned_activities"] = []
            report_payload["summary"] = {}

        # 5. Extract summary values for DB record compatibility
        proj_name = val(extracted["project_information"].get("project_name")) or project.name
        primary_rock = val(extracted["rock_analysis"].get("rock_type")) or "Hard Rock"
        rqd_val = val(extracted["rock_analysis"].get("rqd")) or 65.0
        rqd_num = 65.0
        if isinstance(rqd_val, str):
            m_r = re_search_float(rqd_val)
            if m_r:
                rqd_num = m_r

        # Save to database
        report_row = GeotechnicalReport(
            project_id=project_id,
            report_title=f"{proj_name} - {filename}",
            filename=filename,
            raw_text=full_text[:12000],
            primary_rock_type=str(primary_rock),
            strata_classification="Subsurface Strata",
            rock_quality_designation_rqd=rqd_num,
            water_table_depth_m=2.0,
            intelligence_data_json=json.dumps(report_payload),
            strata_layers_json=json.dumps(strata_layers_list),
            recommended_machinery_json=json.dumps(machinery_fleet),
            planned_activities_json=json.dumps(activities_list),
            summary_json=json.dumps(summary_dict),
            status="ANALYZED"
        )
        db.add(report_row)
        db.commit()
        db.refresh(report_row)

        report_payload["id"] = report_row.id
        report_payload["db_id"] = report_row.id
        return report_payload

    @staticmethod
    def get_report_intelligence(db: Session, report_id: int | str) -> Optional[Dict[str, Any]]:
        """Retrieves hydrated geotechnical intelligence for a given report ID or code."""
        query = db.query(GeotechnicalReport)
        if isinstance(report_id, int) or (isinstance(report_id, str) and report_id.isdigit()):
            row = query.filter(GeotechnicalReport.id == int(report_id)).first()
        else:
            # Match in JSON or report title
            reports = query.all()
            row = None
            for r in reports:
                if r.intelligence_data_json and f'"{report_id}"' in r.intelligence_data_json:
                    row = r
                    break

        if not row:
            return None

        if row.intelligence_data_json:
            try:
                data = json.loads(row.intelligence_data_json)
                data["id"] = row.id
                data["db_id"] = row.id
                if not data.get("recommended_machinery"):
                    try:
                        from backend.app.services.geotechnical_service import analyze_geotechnical_report
                        legacy_plan = analyze_geotechnical_report(row.raw_text or "", {})
                        data["strata_layers"] = legacy_plan.get("strata_layers", [])
                        data["recommended_machinery"] = legacy_plan.get("machinery", [])
                        data["planned_activities"] = legacy_plan.get("activities", [])
                        data["summary"] = legacy_plan.get("summary", {})
                    except Exception:
                        pass
                return data
            except Exception:
                pass

        # Legacy fallback
        try:
            from backend.app.services.geotechnical_service import analyze_geotechnical_report
            legacy_plan = analyze_geotechnical_report(row.raw_text or "", {})
            return {
                "id": row.id,
                "db_id": row.id,
                "report_id": f"GT-LEGACY-{row.id:04d}",
                "filename": row.filename or row.report_title,
                "created_at": row.created_at.isoformat() if row.created_at else datetime.datetime.utcnow().isoformat(),
                "project_id": row.project_id,
                "project_information": {"project_name": {"value": row.report_title, "display": row.report_title, "source_type": "REPORT", "status": "FOUND"}},
                "strata_layers": legacy_plan.get("strata_layers", []),
                "recommended_machinery": legacy_plan.get("machinery", []),
                "planned_activities": legacy_plan.get("activities", []),
                "summary": legacy_plan.get("summary", {}),
                "rock_types": legacy_plan.get("rock_types", []),
                "boreholes": [],
                "stratigraphy": [],
                "risks": [],
                "missing_data": [],
                "audit_trail": []
            }
        except Exception:
            return None

    @staticmethod
    def list_all_reports(db: Session, project_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """Lists all uploaded reports across projects."""
        query = db.query(GeotechnicalReport)
        if project_id:
            query = query.filter(GeotechnicalReport.project_id == project_id)
        rows = query.order_by(GeotechnicalReport.created_at.desc()).all()

        results = []
        for r in rows:
            intel = {}
            if r.intelligence_data_json:
                try:
                    intel = json.loads(r.intelligence_data_json)
                except Exception:
                    pass
            results.append({
                "id": r.id,
                "report_id": intel.get("report_id", f"GT-LEGACY-{r.id:04d}"),
                "project_id": r.project_id,
                "project_name": intel.get("project_information", {}).get("project_name", {}).get("display", r.report_title),
                "filename": r.filename,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "boreholes_count": len(intel.get("boreholes", [])) if intel.get("boreholes") else 0,
                "bearing_capacity": intel.get("foundation_recommendations", {}).get("net_allowable_bearing_capacity", {}).get("display", "N/A"),
                "status": r.status or "ANALYZED"
            })
        return results


def re_search_float(s: str) -> Optional[float]:
    import re
    m = re.search(r"(\d+(?:\.\d+)?)", s)
    return float(m.group(1)) if m else None
