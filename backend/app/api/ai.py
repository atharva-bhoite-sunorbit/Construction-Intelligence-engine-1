import json
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.database.connection import get_db
from backend.app.models.all_models import AIRecommendation, AIManagementSummary, Activity, User
from backend.app.schemas.all_schemas import (
    AIRecommendationResponse, RecommendationActionRequest,
    AIManagementSummaryResponse, AIChatRequest, AIChatResponse
)
from backend.app.services.ai_service import AIService
from backend.app.services.audit_service import AuditService
from backend.app.utils.security import get_current_user_optional

router = APIRouter(tags=["AI Reasoning & Assistant"])

@router.get("/api/projects/{project_id}/ai/recommendations", response_model=List[AIRecommendationResponse])
def get_ai_recommendations(project_id: int, db: Session = Depends(get_db)):
    """Fetches AI recommendations for manager review."""
    recs = (
        db.query(AIRecommendation)
        .filter(AIRecommendation.project_id == project_id)
        .order_by(AIRecommendation.created_at.desc())
        .all()
    )
    act_map = {a.id: a.name for a in db.query(Activity).filter(Activity.project_id == project_id).all()}

    results = []
    for r in recs:
        factors = json.loads(r.contributing_factors_json) if r.contributing_factors_json else []
        actions = json.loads(r.recommended_actions_json) if r.recommended_actions_json else []

        results.append({
            "id": r.id,
            "project_id": r.project_id,
            "activity_id": r.activity_id,
            "activity_name": act_map.get(r.activity_id),
            "risk_level": r.risk_level,
            "issue_summary": r.issue_summary,
            "contributing_factors": factors,
            "ai_explanation": r.ai_explanation,
            "recommended_actions": actions,
            "status": r.status,
            "manager_notes": r.manager_notes,
            "created_at": r.created_at
        })

    return results

@router.post("/api/ai/recommendations/{id}/action", response_model=AIRecommendationResponse)
def handle_recommendation_action(
    id: int,
    action_req: RecommendationActionRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Project Manager approval gate:
    Manager reviews, approves, modifies, or rejects the AI recommendation.
    Schedule is never automatically mutated without this manager approval.
    """
    rec = db.query(AIRecommendation).filter(AIRecommendation.id == id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")

    old_status = rec.status
    rec.status = action_req.status
    rec.manager_notes = action_req.manager_notes
    rec.reviewed_by_user_id = current_user.id if current_user else None
    rec.reviewed_at = datetime.utcnow()

    db.commit()
    db.refresh(rec)

    AuditService.log_action(
        db,
        action=f"RECOMMENDATION_{action_req.status}",
        entity_name="AIRecommendation",
        entity_id=str(id),
        old_values={"status": old_status},
        new_values={"status": rec.status, "manager_notes": rec.manager_notes},
        user_id=current_user.id if current_user else None
    )

    act = db.query(Activity).filter(Activity.id == rec.activity_id).first() if rec.activity_id else None

    return {
        "id": rec.id,
        "project_id": rec.project_id,
        "activity_id": rec.activity_id,
        "activity_name": act.name if act else None,
        "risk_level": rec.risk_level,
        "issue_summary": rec.issue_summary,
        "contributing_factors": json.loads(rec.contributing_factors_json) if rec.contributing_factors_json else [],
        "ai_explanation": rec.ai_explanation,
        "recommended_actions": json.loads(rec.recommended_actions_json) if rec.recommended_actions_json else [],
        "status": rec.status,
        "manager_notes": rec.manager_notes,
        "created_at": rec.created_at
    }

@router.post("/api/projects/{project_id}/ai/summary", response_model=AIManagementSummaryResponse)
def generate_project_summary(project_id: int, db: Session = Depends(get_db)):
    """Generates daily management brief summarizing progress, delayed activities, risks, and next-day actions."""
    summary = AIService.generate_daily_management_summary(db, project_id)
    return {
        "id": summary.id,
        "project_id": summary.project_id,
        "summary_date": summary.summary_date,
        "overall_progress": summary.overall_progress,
        "activities_completed": summary.activities_completed,
        "activities_delayed": summary.activities_delayed,
        "high_risk_activities": summary.high_risk_activities,
        "labour_shortage_count": summary.labour_shortage_count,
        "material_risk_count": summary.material_risk_count,
        "potential_slippage_days": summary.potential_slippage_days,
        "key_issues": json.loads(summary.key_issues_json) if summary.key_issues_json else [],
        "risk_explanation": summary.risk_explanation,
        "recommended_actions": json.loads(summary.recommended_actions_json) if summary.recommended_actions_json else [],
        "next_day_priorities": json.loads(summary.next_day_priorities_json) if summary.next_day_priorities_json else [],
        "created_at": summary.created_at
    }

@router.get("/api/projects/{project_id}/ai/summary", response_model=AIManagementSummaryResponse)
def get_latest_summary(project_id: int, db: Session = Depends(get_db)):
    summary = (
        db.query(AIManagementSummary)
        .filter(AIManagementSummary.project_id == project_id)
        .order_by(AIManagementSummary.id.desc())
        .first()
    )
    if not summary:
        # Generate initial summary
        return generate_project_summary(project_id, db)

    return {
        "id": summary.id,
        "project_id": summary.project_id,
        "summary_date": summary.summary_date,
        "overall_progress": summary.overall_progress,
        "activities_completed": summary.activities_completed,
        "activities_delayed": summary.activities_delayed,
        "high_risk_activities": summary.high_risk_activities,
        "labour_shortage_count": summary.labour_shortage_count,
        "material_risk_count": summary.material_risk_count,
        "potential_slippage_days": summary.potential_slippage_days,
        "key_issues": json.loads(summary.key_issues_json) if summary.key_issues_json else [],
        "risk_explanation": summary.risk_explanation,
        "recommended_actions": json.loads(summary.recommended_actions_json) if summary.recommended_actions_json else [],
        "next_day_priorities": json.loads(summary.next_day_priorities_json) if summary.next_day_priorities_json else [],
        "created_at": summary.created_at
    }

@router.post("/api/ai/chat", response_model=AIChatResponse)
def chat_with_assistant(chat_req: AIChatRequest, db: Session = Depends(get_db)):
    """AI Construction Assistant Chatbot responding with real database facts."""
    return AIService.answer_assistant_query(db, chat_req.query, chat_req.project_id)
