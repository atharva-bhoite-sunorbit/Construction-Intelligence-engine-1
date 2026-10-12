from datetime import date
from types import SimpleNamespace

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.models.all_models import Activity, Project
from backend.app.schemas.all_schemas import ActivityResponse
from backend.app.database.connection import Base
from scripts import import_zoy_pdf_baseline as baseline_import


def test_parse_pdf_rows_maps_wings_and_undated_rows(monkeypatch, tmp_path):
    page = SimpleNamespace(
        extract_text=lambda: "\n".join(
            [
                "1",
                "41 ZOY Tue 07/01/25 Wed 11/29/28",
                "2",
                "A-WING Tue 07/01/25 Wed 11/29/28",
                "3",
                "Foundation Fri 08/01/25 Sat 08/02/25",
                "4",
                "B-WING Tue 07/01/25 Wed 11/29/28",
                "5",
                "ADVANCE FOR ALUFORM NA NA",
                "6",
                "External Development Tue 07/01/25 Wed 11/29/28",
            ]
        )
    )
    monkeypatch.setattr(
        baseline_import,
        "PdfReader",
        lambda *args, **kwargs: SimpleNamespace(pages=[page]),
    )

    tasks = baseline_import.parse_pdf_rows(tmp_path / "baseline.pdf")

    assert len(tasks) == 6
    assert tasks[0].tower == "Common"
    assert tasks[2].tower == "Tower A"
    assert tasks[4].tower == "Tower B"
    assert tasks[4].name == "ADVANCE FOR ALUFORM"
    assert tasks[4].start_date is None
    assert tasks[5].tower == "External / Infra"
    assert tasks[0].start_date == date(2025, 7, 1)
    assert tasks[0].end_date == date(2028, 11, 29)


def test_baseline_import_is_idempotent_and_preserves_live_activity(monkeypatch, tmp_path):
    test_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    monkeypatch.setattr(baseline_import, "engine", test_engine)
    monkeypatch.setattr(
        baseline_import,
        "SessionLocal",
        sessionmaker(autocommit=False, autoflush=False, bind=test_engine),
    )
    Base.metadata.create_all(bind=test_engine)

    db = baseline_import.SessionLocal()
    project = Project(
        name="41 ZOY",
        code="PRJ-41ZOY",
        construction_type="Residential",
        location="Test",
        built_up_area=1000,
        planned_start_date=date(2025, 7, 1),
        target_completion_date=date(2028, 11, 29),
        status="IN_PROGRESS",
    )
    db.add(project)
    db.flush()
    root = Activity(
        project_id=project.id,
        name="41 ZOY",
        tower="Common",
        start_date=date(2025, 7, 1),
        end_date=date(2028, 11, 29),
    )
    live_activity = Activity(
        project_id=project.id,
        name="Foundation",
        tower="Tower A",
        start_date=date(2025, 8, 5),
        end_date=date(2025, 8, 15),
        actual_start_date=date(2025, 8, 6),
        planned_duration=11,
        status="IN_PROGRESS",
        progress_percent=42.5,
        validation_status="APPROVED",
        validation_notes="Approved previously",
        stage1_status="APPROVED",
        final_recorded=True,
    )
    db.add_all([root, live_activity])
    db.commit()
    live_activity_id = live_activity.id
    db.close()

    tasks = [
        baseline_import.BaselineTask(
            task_id=1,
            name="41 ZOY",
            tower="Common",
            start_date=date(2025, 7, 1),
            end_date=date(2028, 11, 29),
        ),
        baseline_import.BaselineTask(
            task_id=3,
            name="Foundation",
            tower="Tower A",
            start_date=date(2025, 8, 1),
            end_date=date(2025, 8, 12),
        ),
    ]
    monkeypatch.setattr(baseline_import, "parse_pdf_rows", lambda _path: tasks)
    pdf_path = tmp_path / "41-zoy-baseline.pdf"

    first_result = baseline_import.import_baseline(pdf_path, apply_changes=True)
    second_result = baseline_import.import_baseline(pdf_path, apply_changes=True)

    db = baseline_import.SessionLocal()
    saved_activity = db.query(Activity).filter(Activity.id == live_activity_id).one()
    response = ActivityResponse.model_validate(saved_activity, from_attributes=True)

    assert first_result == second_result
    assert saved_activity.baseline_task_id == 3
    assert saved_activity.baseline_start_date == date(2025, 8, 1)
    assert saved_activity.baseline_end_date == date(2025, 8, 12)
    assert saved_activity.baseline_source_file == pdf_path.name
    assert saved_activity.start_date == date(2025, 8, 5)
    assert saved_activity.end_date == date(2025, 8, 15)
    assert saved_activity.actual_start_date == date(2025, 8, 6)
    assert saved_activity.status == "IN_PROGRESS"
    assert saved_activity.progress_percent == 42.5
    assert saved_activity.validation_status == "APPROVED"
    assert saved_activity.validation_notes == "Approved previously"
    assert saved_activity.stage1_status == "APPROVED"
    assert saved_activity.final_recorded is True
    assert response.baseline_start_date == date(2025, 8, 1)
    assert response.baseline_source_file == pdf_path.name
    db.close()
    test_engine.dispose()
