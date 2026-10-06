import sys
import os
import shutil
import json
import datetime as dt

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__))))

from backend.app.database.connection import SessionLocal, engine, Base
from backend.app.models.all_models import *
from backend.app.utils.security import get_password_hash
from backend.app.services.cpm_engine import CPMEngine

def parse_d(val):
    if not val:
        return None
    if isinstance(val, (dt.date, dt.datetime)):
        return val if isinstance(val, dt.date) else val.date()
    return dt.datetime.strptime(str(val).strip(), "%Y-%m-%d").date()

def main():
    print("==================================================")
    print("  IMPORTING USER DATA INTO CONSTRUCTION PLATFORM  ")
    print("==================================================")

    # 1. Backup DB if exists
    db_path = "construction_intelligence.db"
    backup_path = "construction_intelligence.db.backup"
    if os.path.exists(db_path):
        print(f"Creating database backup at {backup_path}...")
        shutil.copyfile(db_path, backup_path)
        try:
            os.remove(db_path)
            print("Removed old database file to rebuild fresh schema...")
        except Exception as e:
            print(f"Could not remove old db file: {e}")

    # 2. Re-create all tables
    print("Creating/Verifying tables in database...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # Preserve or create users
        users = [
            ("admin@construction.ai", "admin123", "Alexander Vance (Admin)", "Admin"),
            ("pm@construction.ai", "pm123", "Marcus Brody (Project Manager)", "Project Manager"),
            ("sm@construction.ai", "sm123", "Elena Rostova (Site Manager)", "Site Manager"),
            ("eng@construction.ai", "eng123", "Liam Chen (Lead Structural Engineer)", "Engineer"),
        ]
        for email, pwd, name, role in users:
            u = db.query(User).filter(User.email == email).first()
            if not u:
                db.add(User(
                    email=email,
                    hashed_password=get_password_hash(pwd),
                    full_name=name,
                    role=role
                ))
        db.commit()

        # Clear existing construction project data
        print("Clearing prior project data for clean import...")
        db.query(AuditLog).delete()
        db.query(AIManagementSummary).delete()
        db.query(AIRecommendation).delete()
        db.query(ProjectCompletionForecast).delete()
        db.query(ImpactAnalysis).delete()
        db.query(MLMaterialPrediction).delete()
        db.query(MLProductivityPrediction).delete()
        db.query(MLLabourPrediction).delete()
        db.query(MLDurationPrediction).delete()
        db.query(MLDelayPrediction).delete()
        db.query(MLActivityFeatures).delete()
        db.query(Blocker).delete()
        db.query(SiteObservation).delete()
        db.query(DailyProgress).delete()
        db.query(ActivityResourcePlan).delete()
        db.query(ActivityDependency).delete()
        db.query(Activity).delete()
        db.query(Resource).delete()
        db.query(BOQItem).delete()
        db.query(Project).delete()
        db.commit()

        # --- 1. PROJECTS ---
        print("Importing 4 Projects...")
        projects_data = [
            (1, 'PRJ-001', 'Krisala Heights', 'Residential High-Rise', 'Pune', 25, 450000.0, '2027-01-01', '2028-03-31', '2028-04-07', 'Active'),
            (2, 'PRJ-002', 'TechPark One', 'Commercial Office', 'Pune', 12, 310000.0, '2027-02-15', '2028-01-20', '2028-01-20', 'Active'),
            (3, 'PRJ-003', 'GreenField Factory', 'Industrial Factory', 'Chhatrapati Sambhajinagar', 2, 185000.0, '2027-03-01', '2027-12-15', '2027-12-22', 'Active'),
            (4, 'PRJ-004', 'Riverside Mall', 'Commercial Mall', 'Nashik', 5, 520000.0, '2027-01-20', '2028-06-30', '2028-07-05', 'Planning')
        ]
        for pid, code, name, c_type, loc, floors, area, s_date, b_end, f_end, status in projects_data:
            st = "IN_PROGRESS" if status == "Active" else ("PLANNING" if status == "Planning" else status)
            proj = Project(
                id=pid,
                code=code,
                name=name,
                construction_type=c_type,
                location=loc,
                num_floors=floors,
                num_towers=1,
                built_up_area=area,
                plot_area=area * 1.5,
                planned_start_date=parse_d(s_date),
                target_completion_date=parse_d(b_end),
                project_manager="Project Lead",
                site_manager="Site Lead",
                contractor="Lead Infra Partners",
                status=st
            )
            db.add(proj)
        db.commit()

        # --- 2. BOQ ITEMS ---
        print("Importing 16 BOQ items...")
        boq_data = [
            (1,1,'CON-001','Concrete','RCC concrete','m3',1250.0,3.0,1287.5),
            (2,1,'STL-001','Steel','TMT reinforcement steel','kg',165000.0,5.0,173250.0),
            (3,1,'BRK-001','Masonry','AAC blockwork','m2',18500.0,5.0,19425.0),
            (4,1,'PLS-001','Finishing','Internal plaster','m2',32000.0,5.0,33600.0),
            (5,1,'TIL-001','Finishing','Floor tiles','m2',12400.0,7.0,13268.0),
            (6,1,'PNT-001','Finishing','Interior paint','m2',35000.0,5.0,36750.0),
            (7,2,'CON-002','Concrete','RCC concrete','m3',920.0,3.0,947.6),
            (8,2,'STL-002','Steel','TMT reinforcement steel','kg',118000.0,5.0,123900.0),
            (9,2,'GLS-002','Facade','Curtain wall glazing','m2',14500.0,3.0,14935.0),
            (10,2,'MEP-002','MEP','Electrical and plumbing package','LS',1.0,0.0,1.0),
            (11,3,'CON-003','Concrete','Factory RCC concrete','m3',780.0,3.0,803.4),
            (12,3,'STL-003','Steel','Structural steel and reinforcement','kg',210000.0,4.0,218400.0),
            (13,3,'FLR-003','Finishing','Industrial flooring','m2',21000.0,5.0,22050.0),
            (14,4,'CON-004','Concrete','Mall RCC concrete','m3',2100.0,3.0,2163.0),
            (15,4,'STL-004','Steel','TMT reinforcement steel','kg',285000.0,5.0,299250.0),
            (16,4,'TIL-004','Finishing','Floor and wall tiles','m2',42000.0,7.0,44940.0)
        ]
        for bid, pid, icode, cat, desc, unit, qty, wast, fqty in boq_data:
            db.add(BOQItem(
                id=bid,
                project_id=pid,
                item_code=icode,
                category=cat,
                description=desc,
                unit=unit,
                quantity=qty,
                wastage_pct=wast,
                final_quantity=fqty
            ))
        db.commit()

        # --- 3. RESOURCES ---
        print("Importing 13 Resources...")
        res_data = [
            (1,1,'Labour','Masons','workers',35.0,900.0,'Available'),
            (2,1,'Labour','Carpenters','workers',25.0,1000.0,'Available'),
            (3,1,'Labour','Steel Fixers','workers',22.0,1100.0,'Available'),
            (4,1,'Labour','Electricians','workers',12.0,1200.0,'Available'),
            (5,1,'Material','Cement','bags',8500.0,0.0,'Available'),
            (6,1,'Material','TMT Steel','kg',95000.0,0.0,'Available'),
            (7,1,'Material','AAC Blocks','m2',12000.0,0.0,'Available'),
            (8,1,'Equipment','Concrete Pump','unit',2.0,7500.0,'Available'),
            (9,2,'Labour','Structural Crew','workers',28.0,1100.0,'Available'),
            (10,2,'Material','Glazing Panels','m2',7000.0,0.0,'Delayed'),
            (11,3,'Labour','Fabrication Crew','workers',30.0,1200.0,'Available'),
            (12,3,'Equipment','EOT Crane','unit',2.0,8000.0,'Available'),
            (13,4,'Labour','Civil Crew','workers',45.0,1000.0,'Available')
        ]
        for rid, pid, cat, rname, unit, cap, rate, st in res_data:
            db.add(Resource(
                id=rid,
                project_id=pid,
                category=cat,
                type_name=rname,
                unit=unit,
                available_capacity=cap,
                standard_rate=rate,
                notes=f"Status: {st}"
            ))
        db.commit()

        # --- 4. ACTIVITIES ---
        print("Importing 21 Activities...")
        act_data = [
            (1,1,'A-001','Site Preparation','Civil',0,1,5000.0,'m3',15.0,'2027-01-01','2027-01-15','2027-01-01','2027-01-14','Completed',1),
            (2,1,'A-002','Foundation','Civil',0,1,1250.0,'m3',20.0,'2027-01-16','2027-02-04','2027-01-15',None,'In Progress',1),
            (3,1,'A-003','Column Reinforcement','Structural',1,2,22000.0,'kg',12.0,'2027-02-05','2027-02-16','2027-02-05',None,'In Progress',1),
            (4,1,'A-004','Column Formwork & Concrete','Structural',1,1,220.0,'m3',15.0,'2027-02-17','2027-03-03',None,None,'Planned',1),
            (5,1,'A-005','Slab Formwork','Structural',1,1,10000.0,'sqft',7.0,'2027-03-04','2027-03-10',None,None,'Planned',1),
            (6,1,'A-006','MEP Sleeves','MEP',1,10,1.0,'LS',5.0,'2027-03-11','2027-03-15',None,None,'Planned',0),
            (7,1,'A-007','Slab Concrete','Structural',1,1,180.0,'m3',5.0,'2027-03-16','2027-03-20',None,None,'Planned',1),
            (8,1,'A-008','Brickwork','Masonry',1,3,18500.0,'m2',35.0,'2027-03-21','2027-04-24',None,None,'Planned',0),
            (9,1,'A-009','Internal Plaster','Finishing',1,4,32000.0,'m2',30.0,'2027-04-25','2027-05-24',None,None,'Planned',0),
            (10,1,'A-010','Flooring','Finishing',1,5,12400.0,'m2',20.0,'2027-05-25','2027-06-13',None,None,'Planned',0),
            (11,1,'A-011','Painting','Finishing',1,6,35000.0,'m2',25.0,'2027-06-14','2027-07-08',None,None,'Planned',0),
            (12,2,'B-001','Foundation','Civil',0,7,920.0,'m3',18.0,'2027-02-15','2027-03-04','2027-02-15','2027-03-03','Completed',1),
            (13,2,'B-002','Structural Frame','Structural',1,7,700.0,'m3',30.0,'2027-03-05','2027-04-03','2027-03-04',None,'In Progress',1),
            (14,2,'B-003','Facade','Facade',1,9,14500.0,'m2',45.0,'2027-04-04','2027-05-18',None,None,'Planned',0),
            (15,2,'B-004','MEP Installation','MEP',1,10,1.0,'LS',60.0,'2027-04-20','2027-06-18',None,None,'Planned',0),
            (16,3,'C-001','Factory Foundation','Civil',0,11,780.0,'m3',20.0,'2027-03-01','2027-03-20','2027-03-01',None,'In Progress',1),
            (17,3,'C-002','Structural Steel','Structural',1,12,210000.0,'kg',45.0,'2027-03-21','2027-05-04',None,None,'Planned',1),
            (18,3,'C-003','Industrial Flooring','Finishing',1,13,21000.0,'m2',30.0,'2027-05-05','2027-06-03',None,None,'Planned',0),
            (19,4,'D-001','Foundation','Civil',0,14,2100.0,'m3',30.0,'2027-01-20','2027-02-18',None,None,'Planned',1),
            (20,4,'D-002','Mall Structure','Structural',1,15,2100.0,'m3',90.0,'2027-02-19','2027-05-19',None,None,'Planned',1),
            (21,4,'D-003','Finishing','Finishing',1,16,42000.0,'m2',60.0,'2027-05-20','2027-07-18',None,None,'Planned',0)
        ]

        # Activity 5 has active daily progress records (80% executed)
        progress_defaults = {
            1: 100.0, 2: 44.0, 3: 35.0, 5: 80.0, 12: 100.0, 13: 45.0, 16: 23.0
        }

        for aid, pid, code, aname, cat, flr, bid, qty, unit, dur, pstart, pend, astart, aend, st, crit in act_data:
            status_map = {
                'Completed': 'COMPLETED',
                'In Progress': 'IN_PROGRESS',
                'Planned': 'IN_PROGRESS' if aid == 5 else 'NOT_STARTED'
            }
            db_status = status_map.get(st, 'NOT_STARTED')
            prog = progress_defaults.get(aid, 0.0)

            act = Activity(
                id=aid,
                project_id=pid,
                code=code,
                name=aname,
                category=cat,
                work_package=cat,
                phase="Substructure" if flr == 0 else "Superstructure",
                floor=flr,
                boq_item_id=bid,
                quantity=qty,
                unit=unit,
                planned_duration=int(dur),
                start_date=parse_d(pstart),
                end_date=parse_d(pend),
                actual_start_date=parse_d(astart) if astart else (parse_d(pstart) if aid == 5 else None),
                actual_end_date=parse_d(aend),
                status=db_status,
                progress_percent=prog,
                is_critical=bool(crit),
                required_labour=15 if cat in ['Civil', 'Structural'] else 10
            )
            db.add(act)
        db.commit()

        # --- 5. ACTIVITY DEPENDENCIES ---
        print("Importing 17 Dependencies...")
        dep_data = [
            (1,1,1,2,'FS',0.0),
            (2,1,2,3,'FS',0.0),
            (3,1,3,4,'FS',0.0),
            (4,1,4,5,'FS',0.0),
            (5,1,5,6,'FS',0.0),
            (6,1,5,7,'FS',0.0),
            (7,1,7,8,'FS',0.0),
            (8,1,8,9,'FS',0.0),
            (9,1,9,10,'FS',0.0),
            (10,1,10,11,'FS',0.0),
            (11,2,12,13,'FS',0.0),
            (12,2,13,14,'SS',10.0),
            (13,2,13,15,'SS',15.0),
            (14,3,16,17,'FS',0.0),
            (15,3,17,18,'FS',0.0),
            (16,4,19,20,'FS',0.0),
            (17,4,20,21,'FS',0.0)
        ]
        for did, pid, pred, succ, dtype, lag in dep_data:
            db.add(ActivityDependency(
                id=did,
                project_id=pid,
                predecessor_id=pred,
                successor_id=succ,
                dependency_type=dtype,
                lag_days=int(lag)
            ))
        db.commit()

        # --- 6. ACTIVITY RESOURCE PLAN ---
        print("Importing 14 Activity Resource Plans...")
        arp_data = [
            (1,2,1,25.0),
            (2,2,5,5000.0),
            (3,3,3,18.0),
            (4,4,2,20.0),
            (5,5,2,22.0),
            (6,6,4,10.0),
            (7,7,8,1.0),
            (8,8,1,30.0),
            (9,13,9,28.0),
            (10,14,10,14500.0),
            (11,16,13,35.0),
            (12,17,11,30.0),
            (13,17,12,1.0),
            (14,19,13,45.0)
        ]
        for pl_id, aid, rid, pqty in arp_data:
            db.add(ActivityResourcePlan(
                id=pl_id,
                activity_id=aid,
                resource_id=rid,
                required_qty=pqty,
                allocated_qty=pqty
            ))
        db.commit()

        # --- 7. DAILY PROGRESS ---
        print("Importing 9 Daily Progress reports...")
        dp_data = [
            (1,5,'2027-03-04',2500.0,1800.0,1800.0,18,15,9.0,78.0,92.0,1,'Shuttering material delayed'),
            (2,5,'2027-03-05',2500.0,2100.0,3900.0,18,15,9.0,80.0,94.0,0,'Productivity improving'),
            (3,5,'2027-03-06',2500.0,1900.0,5800.0,18,14,8.0,74.0,90.0,1,'Two workers absent'),
            (4,5,'2027-03-07',2500.0,2200.0,8000.0,18,16,9.0,88.0,95.0,0,'Additional carpenters added'),
            (5,2,'2027-02-01',300.0,280.0,280.0,25,25,9.0,96.0,98.0,0,'Normal progress'),
            (6,2,'2027-02-02',300.0,270.0,550.0,25,24,9.0,94.0,98.0,0,'Normal progress'),
            (7,13,'2027-03-20',700.0,650.0,650.0,28,27,9.0,96.0,98.0,0,'Normal progress'),
            (8,13,'2027-03-21',700.0,620.0,1270.0,28,25,8.0,92.0,96.0,1,'Steel delivery slightly delayed'),
            (9,16,'2027-03-10',195.0,180.0,180.0,35,33,9.0,97.0,96.0,0,'Normal progress')
        ]
        for prog_id, aid, pdate, pqty, aqty, cum_qty, w_avail, w_ass, whours, mat_pct, eq_pct, issues, remarks in dp_data:
            act = db.query(Activity).filter(Activity.id == aid).first()
            p_id = act.project_id if act else 1
            prod = round(aqty / max(1.0, w_ass * whours), 2)
            db.add(DailyProgress(
                id=prog_id,
                project_id=p_id,
                activity_id=aid,
                report_date=parse_d(pdate),
                planned_quantity=pqty,
                actual_quantity=aqty,
                workers_available=w_avail,
                workers_assigned=w_ass,
                working_hours=whours,
                material_availability_percent=mat_pct,
                equipment_availability_percent=eq_pct,
                daily_productivity=prod,
                cumulative_productivity=cum_qty,
                planned_progress_percent=round(pqty / max(1.0, act.quantity if act else 1.0) * 100, 1),
                actual_progress_percent=round(cum_qty / max(1.0, act.quantity if act else 1.0) * 100, 1),
                progress_variance_percent=round((aqty - pqty) / max(1.0, pqty) * 100, 1),
                labour_shortage=max(0, w_avail - w_ass),
                issues=f"{issues} open blocker(s)" if issues > 0 else None,
                remarks=remarks,
                weather="Clear"
            ))
        db.commit()

        # --- 8. BLOCKERS ---
        print("Importing 4 Blockers...")
        block_data = [
            (1,1,5,'Material','Shuttering material delivery delayed by supplier','High','2027-03-04',None,'Open'),
            (2,1,5,'Labour','Two carpenters absent','Medium','2027-03-06','2027-03-07','Resolved'),
            (3,2,14,'Material','Curtain wall glazing delivery pending','High','2027-04-10',None,'Open'),
            (4,3,17,'Material','Structural steel batch inspection pending','Medium','2027-03-25',None,'Open')
        ]
        for bid, pid, aid, btype, desc, sev, odate, rdate, st in block_data:
            db.add(Blocker(
                id=bid,
                project_id=pid,
                activity_id=aid,
                category=btype,
                description=desc,
                severity=sev.upper(),
                opened_date=parse_d(odate),
                resolved_date=parse_d(rdate) if rdate else None,
                status=st.upper()
            ))
        db.commit()

        # --- 9. SITE OBSERVATIONS ---
        print("Importing 4 Site Observations...")
        obs_data = [
            (1,1,5,'2027-03-04','DPR','Slab formwork progressed slower than planned due to shuttering material shortage.','Verified'),
            (2,1,5,'2027-03-06','Site Note','Two carpenters were unavailable; productivity dropped.','Verified'),
            (3,2,14,'2027-04-10','DPR','Facade work cannot reach planned pace until glazing panels arrive.','Pending'),
            (4,3,17,'2027-03-25','Inspection Note','Steel batch awaiting inspection clearance.','Pending')
        ]
        for oid, pid, aid, odate, otype, text, vstat in obs_data:
            db.add(SiteObservation(
                id=oid,
                project_id=pid,
                activity_id=aid,
                date=parse_d(odate),
                photo_url="/assets/observation_demo.jpg",
                photo_caption=f"{otype}: {text[:40]}...",
                category=otype,
                description=text,
                verification_status="VERIFIED" if vstat == "Verified" else "PENDING_REVIEW"
            ))
        db.commit()

        # --- 10. IMPACT ANALYSIS ---
        print("Importing 4 Impact Analysis records...")
        imp_data = [
            (1,1,5,6,2.0,'High','MEP sleeves are dependent on slab formwork readiness.','2027-03-07'),
            (2,1,5,7,3.0,'High','Slab concrete cannot proceed until formwork and embedded MEP work are ready.','2027-03-07'),
            (3,1,7,8,3.0,'Medium','Brickwork sequence follows slab completion.','2027-03-07'),
            (4,2,14,15,5.0,'Medium','Facade delay may affect handover readiness.','2027-04-10')
        ]
        for imid, pid, src, aff, idays, ilev, reason, adate in imp_data:
            db.add(ImpactAnalysis(
                id=imid,
                project_id=pid,
                source_activity_id=src,
                affected_activity_id=aff,
                impact_days=idays,
                impact_level=ilev.upper(),
                reason=reason,
                created_at=dt.datetime.combine(parse_d(adate), dt.time.min)
            ))
        db.commit()

        # --- 11. ML ACTIVITY FEATURES ---
        print("Importing 4 ML Activity Features...")
        feat_data = [
            (1,5,'2027-03-07',80.0,80.0,0.0,18,16,2,9.0,88.0,95.0,650.0,611.0,1,0.0,1,0.92,2000.0,7.0,4.0,1),
            (2,2,'2027-02-02',55.0,52.0,-3.0,25,24,1,9.0,94.0,98.0,16.0,15.0,0,0.0,1,0.96,700.0,20.0,20.0,0),
            (3,13,'2027-03-21',45.0,41.0,-4.0,28,25,3,8.0,92.0,96.0,23.0,22.0,1,1.0,1,0.94,830.0,30.0,30.0,0),
            (4,16,'2027-03-10',50.0,46.0,-4.0,35,33,2,9.0,97.0,96.0,10.0,9.2,0,0.0,1,0.97,600.0,20.0,20.0,0)
        ]
        for fid, aid, fdate, pp, ap, pv, wavail, wass, lshort, wh, mat, eq, prevp, curp, blk, depd, cp, wth, rq, td, ad, dflag in feat_data:
            act = db.query(Activity).filter(Activity.id == aid).first()
            p_id = act.project_id if act else 1
            f_dict = {
                "planned_progress_pct": pp, "actual_progress_pct": ap, "progress_variance_pct": pv,
                "workers_available": wavail, "workers_assigned": wass, "labour_shortage": lshort,
                "working_hours": wh, "material_availability_pct": mat, "equipment_availability_pct": eq,
                "previous_productivity": prevp, "current_productivity": curp, "open_blocker_count": blk,
                "dependency_delay_days": depd, "critical_path_flag": cp, "weather_score": wth,
                "remaining_quantity": rq, "target_duration_days": td, "actual_duration_days": ad,
                "delayed_flag": dflag
            }
            db.add(MLActivityFeatures(
                id=fid,
                project_id=p_id,
                activity_id=aid,
                calculation_date=parse_d(fdate),
                features_json=json.dumps(f_dict)
            ))
        db.commit()

        # --- 12. ML DELAY PREDICTIONS ---
        print("Importing 4 Delay Predictions...")
        del_data = [
            (1,5,'2027-03-07','XGBoost Classifier','v0.1',0.82,'High',2.4),
            (2,2,'2027-02-02','XGBoost Classifier','v0.1',0.21,'Low',0.0),
            (3,13,'2027-03-21','XGBoost Classifier','v0.1',0.48,'Medium',1.0),
            (4,16,'2027-03-10','XGBoost Classifier','v0.1',0.39,'Medium',0.7)
        ]
        for pred_id, aid, pdate, mname, mver, prob, rlev, pdays in del_data:
            act = db.query(Activity).filter(Activity.id == aid).first()
            p_id = act.project_id if act else 1
            db.add(MLDelayPrediction(
                id=pred_id,
                project_id=p_id,
                activity_id=aid,
                prediction_date=parse_d(pdate),
                delay_probability=prob,
                risk_level=rlev.upper(),
                predicted_delay_days=pdays,
                confidence_score=0.88,
                model_version=f"{mname} {mver}",
                prediction_mode="ML"
            ))
        db.commit()

        # --- 13. ML DURATION PREDICTIONS ---
        print("Importing 4 Duration Predictions...")
        dur_data = [
            (1,5,'2027-03-07','XGBoost Regressor',9.4,0.81),
            (2,2,'2027-02-02','XGBoost Regressor',20.6,0.78),
            (3,13,'2027-03-21','XGBoost Regressor',32.0,0.76),
            (4,16,'2027-03-10','XGBoost Regressor',21.2,0.74)
        ]
        for pred_id, aid, pdate, mname, pdur, conf in dur_data:
            act = db.query(Activity).filter(Activity.id == aid).first()
            p_id = act.project_id if act else 1
            db.add(MLDurationPrediction(
                id=pred_id,
                project_id=p_id,
                activity_id=aid,
                prediction_date=parse_d(pdate),
                predicted_duration=pdur,
                interval_lower=max(1.0, pdur - 1.5),
                interval_upper=pdur + 2.0,
                confidence_score=conf,
                model_version=mname,
                prediction_mode="ML"
            ))
        db.commit()

        # --- 14. ML LABOUR PREDICTIONS ---
        print("Importing 4 Labour Predictions...")
        lab_data = [
            (1,5,'2027-03-07','XGBoost Regressor',19,16,3),
            (2,2,'2027-02-02','XGBoost Regressor',24,24,0),
            (3,13,'2027-03-21','XGBoost Regressor',28,25,3),
            (4,16,'2027-03-10','XGBoost Regressor',35,33,2)
        ]
        for pred_id, aid, pdate, mname, preq, cwork, short in lab_data:
            act = db.query(Activity).filter(Activity.id == aid).first()
            p_id = act.project_id if act else 1
            db.add(MLLabourPrediction(
                id=pred_id,
                project_id=p_id,
                activity_id=aid,
                prediction_date=parse_d(pdate),
                predicted_workers_required=preq,
                confidence_score=0.85,
                model_version=mname,
                prediction_mode="ML"
            ))
        db.commit()

        # --- 15. ML MATERIAL PREDICTIONS ---
        print("Importing 4 Material Predictions...")
        mat_data = [
            (1,1,1,'2027-03-07',7,420.0,350.0,70.0),
            (2,1,2,'2027-03-07',14,18000.0,12000.0,6000.0),
            (3,1,7,'2027-03-07',14,6000.0,5200.0,800.0),
            (4,2,9,'2027-04-10',14,5200.0,3500.0,1700.0)
        ]
        for pred_id, pid, bid, pdate, horiz, req, stock, short in mat_data:
            db.add(MLMaterialPrediction(
                id=pred_id,
                project_id=pid,
                boq_item_id=bid,
                prediction_date=parse_d(pdate),
                forecast_horizon_days=horiz,
                expected_consumption=req,
                current_stock=stock,
                predicted_shortage=short,
                shortage_probability=round(short / max(1.0, req), 2),
                model_version="ML Forecast",
                prediction_mode="ML"
            ))
        db.commit()

        # --- 16. ML PRODUCTIVITY PREDICTIONS ---
        print("Importing 4 Productivity Predictions...")
        prod_data = [
            (1,5,'2027-03-07','XGBoost Regressor',610.0,'sqft/day',0.82),
            (2,2,'2027-02-02','XGBoost Regressor',15.0,'m3/day',0.79),
            (3,13,'2027-03-21','XGBoost Regressor',22.0,'t/day',0.76),
            (4,16,'2027-03-10','XGBoost Regressor',9.1,'m3/day',0.73)
        ]
        for pred_id, aid, pdate, mname, pprod, unit, conf in prod_data:
            act = db.query(Activity).filter(Activity.id == aid).first()
            p_id = act.project_id if act else 1
            db.add(MLProductivityPrediction(
                id=pred_id,
                project_id=p_id,
                activity_id=aid,
                prediction_date=parse_d(pdate),
                predicted_daily_productivity=pprod,
                unit=unit,
                confidence_score=conf,
                model_version=mname,
                prediction_mode="ML"
            ))
        db.commit()

        # --- 17. PROJECT COMPLETION FORECASTS ---
        print("Importing 3 Project Completion Forecasts...")
        comp_data = [
            (1,1,'2027-03-07','2028-03-31','2028-04-07',7.0,0.78,'Activity ML + dependency graph + critical path'),
            (2,2,'2027-04-10','2028-01-20','2028-01-20',0.0,0.82,'Activity ML + dependency graph + critical path'),
            (3,3,'2027-03-25','2027-12-15','2027-12-22',7.0,0.75,'Activity ML + dependency graph + critical path')
        ]
        for fid, pid, fdate, bdate, pdate, slip, conf, meth in comp_data:
            db.add(ProjectCompletionForecast(
                id=fid,
                project_id=pid,
                forecast_date=parse_d(fdate),
                baseline_completion_date=parse_d(bdate),
                predicted_completion_date=parse_d(pdate),
                slippage_days=int(slip),
                schedule_health_score=round(conf * 100.0, 1),
                critical_path_length_days=180,
                confidence_interval_days=5,
                methodology_notes=meth
            ))
        db.commit()

        # --- 18. AI RECOMMENDATIONS ---
        print("Importing 4 AI Recommendations...")
        rec_data = [
            (1,1,5,'2027-03-07','High','Slab formwork has elevated delay risk with material and labour constraints.','Confirm shuttering delivery, add approximately 3 carpenters if available, and re-check productivity after the next shift.','Reduce formwork delay and protect concrete start date.','Pending'),
            (2,1,5,'2027-03-07','Medium','Current productivity is below the baseline rate.','Review work-front access and material staging before increasing crew size.','Potential productivity recovery.','Pending'),
            (3,2,14,'2027-04-10','High','Glazing material shortage may slow facade installation.','Expedite supplier confirmation and update the facade work package schedule.','Reduce facade slippage.','Pending'),
            (4,3,17,'2027-03-25','Medium','Structural steel inspection is pending.','Complete inspection/approval before the planned erection window.','Protect structural sequence.','Pending')
        ]
        for rid, pid, aid, rdate, prio, isum, rec, impact, app in rec_data:
            db.add(AIRecommendation(
                id=rid,
                project_id=pid,
                activity_id=aid,
                risk_level=prio.upper(),
                issue_summary=isum,
                contributing_factors_json=json.dumps([prio, isum]),
                ai_explanation=rec,
                recommended_actions_json=json.dumps([rec, f"Expected Impact: {impact}"]),
                status=app.upper()
            ))
        db.commit()

        # --- 19. AI MANAGEMENT SUMMARIES ---
        print("Importing 3 AI Management Summaries...")
        sum_data = [
            (1,1,'2027-03-07','At Risk','Project is progressing, but slab formwork has elevated delay risk caused by material availability and labour constraints. Current forecast indicates approximately 7 days of potential project slippage.','Slab formwork delay; shuttering shortage; labour shortage','Confirm shuttering supply; review labour allocation; monitor slab productivity daily'),
            (2,2,'2027-04-10','On Track','Structural work is progressing, but facade glazing availability requires monitoring.','Glazing material delivery','Confirm supplier delivery and update facade schedule'),
            (3,3,'2027-03-25','At Risk','Factory structural steel work has an inspection dependency that could affect the erection sequence.','Steel inspection pending','Close inspection action and monitor erection readiness')
        ]
        for sid, pid, sdate, stat, text, risks, actions in sum_data:
            r_list = [r.strip() for r in risks.split(';') if r.strip()]
            a_list = [a.strip() for a in actions.split(';') if a.strip()]
            db.add(AIManagementSummary(
                id=sid,
                project_id=pid,
                summary_date=parse_d(sdate),
                overall_progress=35.0 if pid == 1 else (40.0 if pid == 2 else 20.0),
                activities_completed=1,
                activities_delayed=1 if stat == 'At Risk' else 0,
                high_risk_activities=1 if stat == 'At Risk' else 0,
                labour_shortage_count=1,
                material_risk_count=1,
                potential_slippage_days=7 if stat == 'At Risk' else 0,
                key_issues_json=json.dumps(r_list),
                risk_explanation=text,
                recommended_actions_json=json.dumps(a_list),
                next_day_priorities_json=json.dumps(a_list[:2])
            ))
        db.commit()

        # --- 20. Run CPM Schedule Calculation on all 4 projects ---
        print("Calculating Critical Path & Schedule float on all projects...")
        for p in db.query(Project).all():
            acts = db.query(Activity).filter(Activity.project_id == p.id).order_by(Activity.start_date).all()
            deps = db.query(ActivityDependency).filter(ActivityDependency.project_id == p.id).all()
            if acts:
                try:
                    cpm = CPMEngine.calculate_cpm(acts, deps, p.planned_start_date)
                    updates = cpm["activity_updates"]
                    crit_ids = set(cpm["critical_activity_ids"])
                    for a in acts:
                        if a.id in updates:
                            u = updates[a.id]
                            a.early_start = u["early_start"]
                            a.early_finish = u["early_finish"]
                            a.late_start = u["late_start"]
                            a.late_finish = u["late_finish"]
                            a.total_float = u["total_float"]
                            a.free_float = u["free_float"]
                            a.is_critical = a.id in crit_ids or a.is_critical
                except Exception as ex:
                    print(f"  Note on CPM for project {p.id}: {ex}")
        db.commit()

        print("\nSUCCESS! All user data has been imported seamlessly.")
        print(f"Projects count: {db.query(Project).count()}")
        print(f"BOQ items count: {db.query(BOQItem).count()}")
        print(f"Activities count: {db.query(Activity).count()}")
        print(f"Dependencies count: {db.query(ActivityDependency).count()}")
        print(f"Resources count: {db.query(Resource).count()}")
        print(f"Daily progress entries: {db.query(DailyProgress).count()}")
        print(f"Blockers count: {db.query(Blocker).count()}")
        print(f"Site observations count: {db.query(SiteObservation).count()}")
        print(f"AI Recommendations count: {db.query(AIRecommendation).count()}")
        print(f"ML Delay Predictions count: {db.query(MLDelayPrediction).count()}")

    finally:
        db.close()

if __name__ == "__main__":
    main()
