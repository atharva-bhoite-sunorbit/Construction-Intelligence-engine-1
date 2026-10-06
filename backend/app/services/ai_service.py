import json
import os
from typing import Dict, Any, List, Optional
from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.app.models.all_models import (
    Project, Activity, ActivityDependency, DailyProgress, Blocker,
    MLDelayPrediction, MLDurationPrediction, ProjectCompletionForecast,
    AIRecommendation, AIManagementSummary, Resource
)
from backend.app.services.dependency_engine import DependencyEngine

class AIService:
    @staticmethod
    def generate_recommendations_for_project(db: Session, project_id: int) -> List[AIRecommendation]:
        """
        Analyzes high-risk and delayed activities in the database.
        Synthesizes causal factors and generates actionable management recommendations.
        Does NOT modify schedule automatically; creates PENDING recommendations for manager review.
        """
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            return []

        # Find high-risk or delayed activities
        high_risk_preds = (
            db.query(MLDelayPrediction)
            .filter(
                MLDelayPrediction.project_id == project_id,
                MLDelayPrediction.risk_level.in_(["HIGH", "CRITICAL"])
            )
            .all()
        )

        created_recs = []

        for pred in high_risk_preds:
            act = db.query(Activity).filter(Activity.id == pred.activity_id).first()
            if not act or act.status == "COMPLETED":
                continue

            # Check if active recommendation already exists
            existing = (
                db.query(AIRecommendation)
                .filter(
                    AIRecommendation.project_id == project_id,
                    AIRecommendation.activity_id == act.id,
                    AIRecommendation.status == "PENDING"
                )
                .first()
            )
            if existing:
                created_recs.append(existing)
                continue

            # Identify contributing factors from data
            factors = []
            actions = []

            # 1. Blocker inspection
            blockers = db.query(Blocker).filter(Blocker.activity_id == act.id, Blocker.status != "RESOLVED").all()
            if blockers:
                b_descs = [b.category for b in blockers]
                factors.append(f"Active blockers present: {', '.join(b_descs)}")
                actions.append(f"Expedite resolution of open blockers with site subcontractors.")

            # 2. Progress inspection
            latest_prog = (
                db.query(DailyProgress)
                .filter(DailyProgress.activity_id == act.id)
                .order_by(DailyProgress.report_date.desc())
                .first()
            )
            if latest_prog:
                if latest_prog.labour_shortage > 0:
                    factors.append(f"Labour shortage of {latest_prog.labour_shortage} workers on site.")
                    actions.append(f"Reallocate {latest_prog.labour_shortage} workers from non-critical activities or mobilize supplementary trade crew.")
                if latest_prog.material_availability_percent < 85.0:
                    factors.append(f"Material availability constrained at {latest_prog.material_availability_percent}%.")
                    actions.append(f"Verify store inventory and fast-track supplier delivery for {act.required_material or 'primary materials'}.")
                if latest_prog.progress_variance_percent < -10:
                    factors.append(f"Progress variance is {latest_prog.progress_variance_percent}%, trailing baseline.")
                    actions.append("Conduct work-front accessibility audit and review gang composition for next shift.")
            else:
                factors.append("Predicted high risk due to upcoming dependency chain and critical path status.")
                actions.append("Prioritize formwork/rebar inspection and pre-order concrete batching slots.")

            if act.is_critical:
                factors.append("Activity resides on the Project Critical Path (Zero Total Float).")
                actions.append("Implement daily shift briefings and dual-shift execution if feasible to prevent overall completion slippage.")

            explanation = (
                f"The activity '{act.name}' is currently at {pred.risk_level} delay risk with a predicted delay "
                f"of {pred.predicted_delay_days} days (Delay Probability: {int(pred.delay_probability * 100)}%). "
                f"Root drivers: {'; '.join(factors)}. Downstream activities will inherit slippage if unaddressed."
            )

            rec = AIRecommendation(
                project_id=project_id,
                activity_id=act.id,
                risk_level=pred.risk_level,
                issue_summary=f"Delay Risk on {act.name} ({pred.predicted_delay_days}d predicted slip)",
                contributing_factors_json=json.dumps(factors),
                ai_explanation=explanation,
                recommended_actions_json=json.dumps(actions),
                status="PENDING"
            )
            db.add(rec)
            created_recs.append(rec)

        db.commit()
        return created_recs

    @staticmethod
    def generate_daily_management_summary(db: Session, project_id: int) -> AIManagementSummary:
        """Generates comprehensive end-of-day executive intelligence summary based on actual database facts."""
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise ValueError(f"Project {project_id} not found")

        activities = db.query(Activity).filter(Activity.project_id == project_id).all()
        total_acts = len(activities)
        completed_acts = sum(1 for a in activities if a.status == "COMPLETED")
        delayed_acts = sum(1 for a in activities if a.status == "DELAYED")

        # Progress calculation
        overall_progress = round(
            sum(a.progress_percent for a in activities) / max(1, total_acts), 1
        ) if total_acts > 0 else 0.0

        # High risk predictions
        high_risk_count = (
            db.query(MLDelayPrediction)
            .filter(MLDelayPrediction.project_id == project_id, MLDelayPrediction.risk_level.in_(["HIGH", "CRITICAL"]))
            .count()
        )

        # Recent shortages
        today = date.today()
        recent_progs = (
            db.query(DailyProgress)
            .filter(DailyProgress.project_id == project_id)
            .order_by(DailyProgress.report_date.desc())
            .limit(15)
            .all()
        )
        total_labour_short = sum(p.labour_shortage for p in recent_progs)
        mat_risks = sum(1 for p in recent_progs if p.material_availability_percent < 85.0)

        # Forecast slippage
        forecast = (
            db.query(ProjectCompletionForecast)
            .filter(ProjectCompletionForecast.project_id == project_id)
            .order_by(ProjectCompletionForecast.id.desc())
            .first()
        )
        slippage_days = forecast.slippage_days if forecast else 0

        # Synthesize Key Issues
        key_issues = []
        if delayed_acts > 0:
            key_issues.append(f"{delayed_acts} construction activities currently lagging behind baseline schedule.")
        if total_labour_short > 0:
            key_issues.append(f"Cumulative manpower deficit of {total_labour_short} workers recorded across active work-fronts.")
        if mat_risks > 0:
            key_issues.append(f"{mat_risks} activities report material supply bottlenecks.")
        if slippage_days > 0:
            key_issues.append(f"Dynamic critical path model forecasts {slippage_days} days overall project completion slippage.")

        if not key_issues:
            key_issues.append("Site operations proceeding within baseline schedule thresholds.")

        risk_explanation = (
            f"Project {project.name} has achieved {overall_progress}% cumulative progress with {completed_acts}/{total_acts} "
            f"activities completed. The scheduling engine predicts {slippage_days} days potential finish slippage. "
            f"Primary vulnerability is concentrated in {high_risk_count} high-risk activities where trade coordination and "
            f"material lead times directly influence the critical path."
        )

        recommended_actions = [
            "Review daily labour allocations during morning supervisor briefing.",
            "Verify supplier delivery confirmations for upcoming concrete batch pours and rebar consignments.",
            "Inspect site scaffolding and clearance on active structural floors.",
            "Assess potential fast-tracking on non-critical parallel work packages."
        ]

        next_day_priorities = [
            "Target zero lost hours by ensuring material laydown zones are unblocked by 07:30 AM.",
            "Conduct safety audit on external hoist and tower crane lifting schedules.",
            "Sign-off inspection checklists for completed shuttering to authorize concrete pour."
        ]

        summary = AIManagementSummary(
            project_id=project_id,
            summary_date=today,
            overall_progress=overall_progress,
            activities_completed=completed_acts,
            activities_delayed=delayed_acts,
            high_risk_activities=high_risk_count,
            labour_shortage_count=total_labour_short,
            material_risk_count=mat_risks,
            potential_slippage_days=slippage_days,
            key_issues_json=json.dumps(key_issues),
            risk_explanation=risk_explanation,
            recommended_actions_json=json.dumps(recommended_actions),
            next_day_priorities_json=json.dumps(next_day_priorities)
        )
        db.add(summary)
        db.commit()
        db.refresh(summary)
        return summary

    @staticmethod
    def answer_assistant_query(db: Session, query: str, project_id: Optional[int] = None) -> Dict[str, Any]:
        """
        AI Construction Assistant Query Engine.
        Answers user queries by retrieving actual facts from database:
        - Which activities are delayed?
        - Why is the project delayed?
        - Which activities are at high risk?
        - What can affect project completion?
        - Which activities can run in parallel?
        - How many workers are required?
        - Which materials may become short?
        - What is the predicted completion date?
        - Which activities are on the critical path?
        - What happened at the site today?
        - What should the project manager investigate?
        """
        q = query.lower()

        # Context gathering
        projects = db.query(Project).all()
        if not project_id and projects:
            project_id = projects[0].id

        project = db.query(Project).filter(Project.id == project_id).first() if project_id else None
        p_name = project.name if project else "Active Project"

        activities = db.query(Activity).filter(Activity.project_id == project_id).all() if project_id else []
        critical_acts = [a for a in activities if a.is_critical]
        delayed_acts = [a for a in activities if a.status == "DELAYED"]
        in_progress_acts = [a for a in activities if a.status == "IN_PROGRESS"]

        high_risk_preds = (
            db.query(MLDelayPrediction)
            .filter(MLDelayPrediction.project_id == project_id, MLDelayPrediction.risk_level.in_(["HIGH", "CRITICAL"]))
            .all()
        ) if project_id else []

        forecast = (
            db.query(ProjectCompletionForecast)
            .filter(ProjectCompletionForecast.project_id == project_id)
            .order_by(ProjectCompletionForecast.id.desc())
            .first()
        ) if project_id else None

        resources = db.query(Resource).filter(Resource.project_id == project_id).all() if project_id else []

        suggested = [
            "Which activities are delayed?",
            "Which activities are at high risk?",
            "What is the predicted completion date?",
            "Which activities are on the critical path?",
            "How many workers are required?"
        ]

        # 1. Delayed activities
        if "delayed" in q:
            if not delayed_acts:
                res_text = f"Great news! There are currently no activities flagged with DELAYED status in {p_name}."
            else:
                names = [f"• {a.name} (Progress: {a.progress_percent}%, Variance: {round(a.progress_percent - 100, 1)}%)" for a in delayed_acts]
                res_text = (
                    f"In {p_name}, there are {len(delayed_acts)} delayed activities:\n"
                    + "\n".join(names)
                    + f"\n\nImpact: These delays may cascade to downstream dependencies unless fast-tracked."
                )
            return {"query": query, "response": res_text, "suggested_questions": suggested}

        # 2. Critical path
        if "critical path" in q or "critical" in q:
            if not critical_acts:
                res_text = f"There are no critical path activities recorded. Please generate the baseline schedule first."
            else:
                names = [f"• {a.name} (Duration: {a.planned_duration}d, Total Float: 0d)" for a in critical_acts[:8]]
                res_text = (
                    f"The Critical Path for {p_name} contains {len(critical_acts)} activities with zero total float. "
                    f"Any delay in these activities directly pushes the overall completion date:\n"
                    + "\n".join(names)
                    + (f"\n...and {len(critical_acts) - 8} more." if len(critical_acts) > 8 else "")
                )
            return {"query": query, "response": res_text, "suggested_questions": suggested}

        # 3. High risk
        if "risk" in q or "high risk" in q:
            if not high_risk_preds:
                res_text = f"No activities currently exceed the high-risk threshold in {p_name}."
            else:
                act_map = {a.id: a.name for a in activities}
                items = [f"• {act_map.get(p.activity_id, 'Activity')}: Delay Probability {int(p.delay_probability * 100)}%, Risk: {p.risk_level}, Slip: {p.predicted_delay_days}d" for p in high_risk_preds[:6]]
                res_text = (
                    f"Found {len(high_risk_preds)} activities with elevated delay probability:\n"
                    + "\n".join(items)
                    + "\n\nRecommendation: Check manpower numbers and open blockers in the AI Risk Center."
                )
            return {"query": query, "response": res_text, "suggested_questions": suggested}

        # 4. Predicted completion date
        if "completion" in q or "finish" in q or "predicted date" in q or "slippage" in q:
            if not forecast:
                res_text = f"Completion forecast has not been computed yet. Trigger Schedule Calculation or Forecast Run."
            else:
                res_text = (
                    f"📊 **Project Completion Forecast for {p_name}**:\n"
                    f"• Baseline Target Date: {forecast.baseline_completion_date.strftime('%d %B %Y')}\n"
                    f"• ML Predicted Completion Date: {forecast.predicted_completion_date.strftime('%d %B %Y')}\n"
                    f"• Forecast Slippage: {forecast.slippage_days} days\n"
                    f"• Schedule Health Score: {forecast.schedule_health_score}/100\n"
                    f"• Confidence Interval: ±{forecast.confidence_interval_days} days\n"
                    f"• Methodology: {forecast.methodology_notes}"
                )
            return {"query": query, "response": res_text, "suggested_questions": suggested}

        # 5. Workers / Labour
        if "worker" in q or "labour" in q or "manpower" in q:
            total_req = sum(a.required_labour for a in in_progress_acts) if in_progress_acts else 45
            res_text = (
                f"👷 **Labour Requirements for {p_name}**:\n"
                f"• Active In-Progress Activities: {len(in_progress_acts)}\n"
                f"• Minimum Concurrent Workers Required: {total_req} tradespeople\n"
                f"• Key Trades: Masons, Carpenters, Steel Fixers, Electricians, and Crane Operators.\n"
                f"• Recommendation: Inspect daily muster roll to verify availability meets required gang sizes."
            )
            return {"query": query, "response": res_text, "suggested_questions": suggested}

        # 6. Materials
        if "material" in q or "shortage" in q or "cement" in q or "steel" in q:
            mat_res = [r for r in resources if r.category.lower().startswith("mat")]
            items = [f"• {m.type_name}: Available {m.available_capacity} {m.unit}" for m in mat_res[:6]]
            res_text = (
                f"📦 **Material Inventory & Forecast for {p_name}**:\n"
                + "\n".join(items)
                + "\n\nUpcoming bulk concrete pours and structural rebar require confirmed batch delivery 48h in advance."
            )
            return {"query": query, "response": res_text, "suggested_questions": suggested}

        # 7. Parallel activities
        if "parallel" in q or "concurrent" in q:
            deps = db.query(ActivityDependency).filter(ActivityDependency.project_id == project_id).all()
            parallel_groups = DependencyEngine.find_parallel_activities(activities, deps)
            if not parallel_groups:
                res_text = "Activities are currently structured predominantly sequentially."
            else:
                act_map = {a.id: a.name for a in activities}
                group_strs = []
                for idx, grp in enumerate(parallel_groups[:3], 1):
                    names = [act_map.get(i, f"Activity {i}") for i in grp[:3]]
                    group_strs.append(f"• Set {idx}: {', '.join(names)}")
                res_text = (
                    f"Identified {len(parallel_groups)} candidate parallel activity groups that can run concurrently without dependency conflicts:\n"
                    + "\n".join(group_strs)
                )
            return {"query": query, "response": res_text, "suggested_questions": suggested}

        # 8. What should PM investigate?
        if "investigate" in q or "why" in q or "recommend" in q:
            res_text = (
                f"🔍 **Key Items Project Manager Should Investigate in {p_name}**:\n"
                f"1. **Critical Path Activities**: Verify shuttering and rebar progress on zero-float structural milestones.\n"
                f"2. **Open Site Blockers**: Check resolution status on material and access clearances.\n"
                f"3. **Gang Productivity**: Compare daily vs cumulative output across trade crews.\n"
                f"4. **AI Recommendations**: Review and approve pending mitigation plans in the AI Recommendations tab."
            )
            return {"query": query, "response": res_text, "suggested_questions": suggested}

        # Default Intelligent Synthesis
        res_text = (
            f"Here is the current live intelligence for **{p_name}**:\n"
            f"• **Total Activities**: {len(activities)} ({len(critical_acts)} on Critical Path)\n"
            f"• **In Progress**: {len(in_progress_acts)} | **Completed**: {sum(1 for a in activities if a.status == 'COMPLETED')}\n"
            f"• **High Delay Risk**: {len(high_risk_preds)} activities identified by ML models\n"
            f"• **Forecast Slippage**: {forecast.slippage_days if forecast else 0} days\n\n"
            f"You can ask me specific questions like: 'Which activities are delayed?', 'What is the predicted completion date?', or 'What should the project manager investigate?'"
        )
        return {"query": query, "response": res_text, "suggested_questions": suggested}
