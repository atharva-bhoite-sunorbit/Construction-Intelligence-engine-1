"""
Comprehensive Pytest Test Suite for Universal Geotechnical Intelligence & Construction Pipeline.

Validates:
1. Universal Extraction of all 16 Parameter Categories across varied soil/rock conditions.
2. Zero-Hallucination validation (unbiased extraction without hardcoded regional assumptions).
3. 5-Layer Construction Intelligence Structure (Site & Boreholes, Soil Profile, Foundation Parameters, Construction Risks, Project Intelligence).
4. Standard Root JSON matching user schema.
5. Construction Intelligence Pipeline Engine (Foundation Validation, Geotechnical BOQ items, CPM schedule sequence, Delay predictions).
6. Rich Risk Engine flags (flag, potential_impact, affected_activities, schedule_impact, cost_impact).
7. FastAPI endpoints for 5 layers, 16 parameters, standard JSON, pipeline, and BOQ synchronization.
"""

import os
import sys
import json
from datetime import date
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.main import app
from backend.app.database.connection import SessionLocal, Base, engine
from backend.app.models.all_models import Project, GeotechnicalReport, BOQItem
from backend.app.services.geotech_intel.extractor import GeotechnicalReportExtractor
from backend.app.services.geotech_intel.engine import (
    GeotechnicalValidationEngine,
    GeotechnicalRiskEngine,
    GeotechnicalPipelineEngine
)
from backend.app.services.geotech_intel.fields import is_found, val, NOT_IN_REPORT

client = TestClient(app)

REPORT_ROCK_TEXT = """
GEOTECHNICAL INVESTIGATION REPORT
FOR PROPOSED RESIDENTIAL TOWER (G + 30 FLOORS)
PROJECT: SUNRISE RESIDENCY
LOCATION: Sector 18, Kharghar, Navi Mumbai
Plot Area: 2500 sq.m
Client: Sunrise Infrastructure Pvt. Ltd.
Consultant: TerraTech Geoconsultants Pvt. Ltd.
Applicable Codes: IS 1892, IS 2131, IS 1498, IS 456, IS 1893, IS 6403, IS 2911

1.0 FIELD INVESTIGATION
Six Boreholes (BH-01 to BH-06) were drilled using rotary drilling method.
Boreholes terminated at depths up to 30.0 m.
Ground RL at BH-01: 102.50 m.

SOIL STRATIFICATION (BH-01):
0.0m to 1.5m: Filling / Top soil
1.5m to 5.0m: Silty Sand (SPT N = 12, loose to medium dense)
5.0m to 12.0m: Dense Sand (SPT N = 32, dense granular stratum)
12.0m to 18.0m: Completely Weathered Rock (CWR)
18.0m to 30.0m: Hard Basalt Bedrock

Core recoveries in hard rock ranged from 45% to 92%, RQD ranged from 25% to 88%.
UCS compressive strength of rock samples varied from 45.0 kg/cm2 to 142.5 kg/cm2.

2.0 GROUNDWATER
Groundwater was observed at BH-01 at 7.2 m below ground level.
Groundwater at BH-02 observed at 6.8 m.
Groundwater at BH-03 was not encountered within explored depth.

3.0 SPT TESTING DATA
BH-01 at depth 1.5m: SPT N = 10
BH-01 at depth 4.5m: SPT N = 12
BH-01 at depth 6.0m: SPT N = 32
BH-01 at depth 9.0m: SPT N = 40
BH-01 at depth 14.0m: SPT N = 55 (Refusal)

4.0 SOIL CLASSIFICATION & PROPERTIES
USCS Classification: SM (Silty Sand) / SP
Gravel: 15%, Sand: 55%, Silt: 22%, Clay: 8%, Fines: 30%
Liquid Limit LL = 32%, Plastic Limit PL = 20%, Plasticity Index PI = 12%
Effective Cohesion c' = 5 kPa, Friction Angle phi = 34 degrees.
Bulk density = 19.5 kN/m3, Submerged density = 9.8 kN/m3.
Modulus of Elasticity E = 9,250 t/m2. Poisson's ratio = 0.30.

5.0 FOUNDATION RECOMMENDATIONS
Solid Raft Foundation resting on dense stratum or weathered rock.
Allowable safe bearing capacity = 180 kN/m2 (or 50 t/m2 on weathered rock).
Estimated foundation settlement = 25 mm.
Subgrade reaction modulus ks = 4,100 t/m3.
Foundation depth D = 2.0 m, Foundation width B = 2.0 m.
Factor of Safety = 3.0 as per IS 6403.

6.0 EXCAVATION & SEISMIC
Excavation sides sloped at 1.5H : 1V or supported by contiguous shoring.
Seismic Zone: Zone III as per IS 1893 (Part 1): 2016. Site Class: Type II (Medium Soil).
Liquefaction potential is low due to high relative density.

7.0 CHEMICAL & CONCRETE PROTECTION
pH = 7.79, Sulphates = 33.87 mg/l, Chlorides = 106.97 mg/l.
Class 1 exposure per IS 456 Table 4. Recommended cement: OPC or PPC. Concrete grade M25 minimum.
Clear cover 50 mm.

8.0 CONSTRUCTION RECOMMENDATIONS
Subgrade compaction to 95% MDD per IS 2720 Part 8.
Provide 100 mm thick M15 PCC mud-mat.
Peripheral sump dewatering during basement excavation.
"""

REPORT_SOIL_ONLY_TEXT = """
GEOTECHNICAL INVESTIGATION REPORT
PROPOSED LOW-RISE RESIDENTIAL COMMUNITY (G+3)
LOCATION: Yamuna Floodplains, Greater Noida, UP
Applicable Codes: IS 1892, IS 2131, IS 1498, IS 6403

1.0 SUBSURFACE CONDITIONS
Four Boreholes (BH-01 to BH-04) drilled to a termination depth of 20.0 m.
No bedrock encountered in the exploration depth.

STRATIGRAPHY:
0.0m to 2.0m: Loose Sandy Silt (SPT N = 6)
2.0m to 8.0m: Medium Dense Silty Sand (SPT N = 18)
8.0m to 20.0m: Dense Fine Sand (SPT N = 35)

2.0 GROUNDWATER
Groundwater encountered at shallow depth of 1.2 m BGL across all boreholes.

3.0 BEARING CAPACITY & FOUNDATION
Isolated footings or strip footings at 1.5 m depth.
Safe bearing capacity is 120 kN/m2.
Maximum permissible settlement is 40 mm.

4.0 SEISMIC & LIQUEFACTION
Seismic Zone IV. Saturated loose sandy silt above 2.0 m is susceptible to liquefaction under design shaking.
Ground improvement or deepening foundation below 2.5 m recommended.
"""


@pytest.fixture(scope="module")
def db():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    yield session
    session.close()


def test_universal_extractor_16_parameters_rock_report():
    """Validates that all 16 parameter categories are thoroughly extracted from a rock-bearing report."""
    extractor = GeotechnicalReportExtractor(REPORT_ROCK_TEXT, [REPORT_ROCK_TEXT])
    params = extractor.extract_all_16_parameters()

    # 1. Project & Site Information
    p1 = params["project_site_info"]
    assert "SUNRISE" in str(val(p1["project_name"])).upper()
    assert "KHARGHAR" in str(val(p1["site_location"])).upper() or "MUMBAI" in str(val(p1["site_location"])).upper()
    assert "RESIDENTIAL" in str(val(p1["building_type"])).upper()
    assert "30" in str(val(p1["proposed_floors"]))
    assert "IS 1892" in val(p1["applicable_is_codes"])

    # 2. Borehole Information (independent boreholes, not merged)
    bhs = params["borehole_information"]
    assert len(bhs) >= 1
    bh1 = bhs[0]
    assert bh1["borehole_id"] == "BH-01"
    assert bh1["ground_rl_m"] == 102.5
    assert bh1["borehole_depth_m"] == 30.0

    # 3. Soil Stratification
    strat = params["soil_stratification"]
    assert len(strat) >= 2
    assert any("Sand" in l.get("material", "") or "Sand" in l.get("soil_description", "") for l in strat)

    # 4. SPT / N-Value Data & Relative Density
    spt = params["spt_n_data"]
    assert len(spt) >= 1
    spt_32 = next((s for s in spt if s.get("spt_n") == 32 or s.get("depth_m") == 6.0), None)
    assert spt_32 is not None
    assert "Dense" in spt_32.get("relative_density", "")

    # 5. Soil Classification
    s_class = params["soil_classification"]
    assert "SM" in val(s_class["uscs_classification"])
    assert s_class["gradation"]["sand_percentage"] == 55
    assert "32" in str(val(s_class["liquid_limit"]))

    # 6. Engineering Properties
    eng = params["engineering_properties"]
    assert "34" in val(eng["friction_angle"])
    assert "19.5" in val(eng["bulk_density"])

    # 7. Bearing Capacity (Dedicated, zero-hallucination)
    bc = params["bearing_capacity"]
    assert is_found(bc["safe_bearing_capacity"]) or is_found(bc["allowable_bearing_capacity"])
    assert val(bc["safety_factor"]) == 3.0

    # 8. Settlement Parameters
    settle = params["settlement_parameters"]
    assert "25" in str(val(settle["total_settlement"]))

    # 9. Groundwater (preserved per borehole)
    gw = params["groundwater"]
    assert is_found(gw["observed_depth"])
    assert "7.2" in str(val(gw["observed_depth"])) or "6.8" in str(val(gw["observed_depth"]))

    # 10. Rock Information
    rock = params["rock_information"]
    assert "Basalt" in val(rock["rock_type"]) or "Bedrock" in val(rock["rock_type"])
    assert is_found(rock["core_recovery"])
    assert is_found(rock["rqd"])

    # 11. Foundation Recommendations
    found = params["foundation_recommendations"]
    assert "Raft" in val(found["recommended_type"])

    # 12. Excavation Information
    exc = params["excavation_information"]
    assert is_found(exc["maximum_slope"])

    # 13. Seismic Parameters
    seismic = params["seismic_parameters"]
    assert "III" in val(seismic["seismic_zone"])

    # 14. Liquefaction Assessment
    liq = params["liquefaction_assessment"]
    assert is_found(liq["liquefaction_susceptibility"])

    # 15. Chemical Tests
    chem = params["chemical_tests"]
    assert val(chem["ph"]) == 7.79

    # 16. Construction Recommendations
    rec = params["construction_recommendations"]
    assert "95%" in val(rec["compaction_percentage"])


def test_non_biased_pure_granular_report_no_bedrock():
    """Validates that for reports stating 'No bedrock encountered', rock is not hallucinated."""
    extractor = GeotechnicalReportExtractor(REPORT_SOIL_ONLY_TEXT, [REPORT_SOIL_ONLY_TEXT])
    params = extractor.extract_all_16_parameters()

    # Rock should NOT be hallucinated
    rock = params["rock_information"]
    assert not is_found(rock["rock_type"]) or "not encountered" in str(val(rock["rock_type"])).lower() or "not applicable" in str(val(rock["rock_type"])).lower()

    # Soil stratification should be purely soil
    strat = params["soil_stratification"]
    assert len(strat) >= 1
    for layer in strat:
        assert "basalt" not in layer.get("material", "").lower()

    # Liquefaction should be flagged for loose saturated sands
    liq = params["liquefaction_assessment"]
    assert is_found(liq["liquefaction_susceptibility"])


def test_five_intelligence_layers_construction():
    """Validates that data is structured into the exact 5 Intelligence Layers."""
    extractor = GeotechnicalReportExtractor(REPORT_ROCK_TEXT, [REPORT_ROCK_TEXT])
    intel = extractor.extract_complete_intelligence()
    layers = intel["five_intelligence_layers"]

    assert "layer_1_site_boreholes" in layers
    assert "layer_2_soil_profile" in layers
    assert "layer_3_foundation_parameters" in layers
    assert "layer_4_construction_risks" in layers
    assert "layer_5_project_intelligence" in layers

    l1 = layers["layer_1_site_boreholes"]
    assert "SUNRISE" in l1["project_name"].upper()
    assert len(l1["boreholes"]) >= 1

    l3 = layers["layer_3_foundation_parameters"]
    assert "180" in str(l3["safe_bearing_capacity"]) or "50" in str(l3["safe_bearing_capacity"])

    l5 = layers["layer_5_project_intelligence"]
    assert "affected_activity_sequence" in l5
    assert "required_boq_items" in l5


def test_standard_root_json_schema():
    """Validates the standard root JSON matching the exact schema requested by the user."""
    extractor = GeotechnicalReportExtractor(REPORT_ROCK_TEXT, [REPORT_ROCK_TEXT])
    intel = extractor.extract_complete_intelligence()
    std = intel["standard_json"]

    assert "project" in std
    assert "investigation" in std
    assert "boreholes" in std
    assert "foundation" in std
    assert "risks" in std

    assert std["project"]["building_type"].upper() == "RESIDENTIAL"
    assert std["project"]["floors"] == 30
    assert len(std["boreholes"]) >= 1
    assert "id" in std["boreholes"][0]
    assert "soil_layers" in std["boreholes"][0]
    assert "recommended_type" in std["foundation"]
    assert isinstance(std["risks"], list)


def test_geotechnical_pipeline_engine():
    """Validates the Construction Intelligence Pipeline Engine end-to-end integration."""
    extractor = GeotechnicalReportExtractor(REPORT_ROCK_TEXT, [REPORT_ROCK_TEXT])
    intel = extractor.extract_complete_intelligence()

    pipeline_result = GeotechnicalPipelineEngine.run_pipeline(intel)

    # 1. Foundation Validation
    val_res = pipeline_result["foundation_validation"]
    assert "estimated_contact_pressure_kpa" in val_res
    assert "allowable_bearing_pressure_kpa" in val_res
    assert "validation_verdict" in val_res
    assert "recommended_foundation_system" in val_res

    # 2. Geotechnical BOQ Items
    boq = pipeline_result["geotechnical_boq_items"]
    assert len(boq) >= 3
    item_codes = [it["item_code"] for it in boq]
    assert "GEO-BOQ-01" in item_codes

    # 3. Construction Schedule Activities
    seq = pipeline_result["construction_sequence"]
    assert len(seq) >= 4
    step_names = [s["activity_name"] for s in seq]
    assert any("Excavation" in name for name in step_names)

    # 4. Delay Predictions
    delays = pipeline_result["delay_prediction"]
    assert "delay_risk_level" in delays
    assert "recommended_schedule_buffer_days" in delays
    assert delays["recommended_schedule_buffer_days"] > 0


def test_rich_risk_flags_structure():
    """Validates rich risk flags with affected activities and schedule/cost impacts."""
    extracted = {
        "groundwater_analysis": {
            "observed_depth": {"display": "1.8 m BGL", "value": "1.8 m", "source_type": "EXTRACTED"}
        },
        "boreholes": [
            {"borehole_id": "BH-01", "groundwater_depth_m": 1.8, "cwr_depth": 3.0, "hard_rock_depth": 6.0},
            {"borehole_id": "BH-02", "groundwater_depth_m": 1.8, "cwr_depth": 3.0, "hard_rock_depth": 9.5}
        ]
    }
    risks = GeotechnicalRiskEngine.evaluate_risks(extracted)

    assert len(risks) >= 1
    for r in risks:
        assert "flag" in r
        assert "potential_impact" in r
        assert "affected_activities" in r
        assert "schedule_impact" in r
        assert "cost_impact" in r
        assert "⚠️" in r["flag"]


def test_api_endpoints_and_boq_sync(db):
    """Validates the FastAPI REST endpoints for the 5 layers and BOQ synchronization."""
    # 1. Create a test project and report in DB
    import uuid
    uniq = uuid.uuid4().hex[:6]
    proj = Project(
        name=f"Pipeline Test Tower {uniq}",
        code=f"PIPE-{uniq}",
        construction_type="Residential",
        location="Navi Mumbai",
        built_up_area=25000.0,
        planned_start_date=date(2026, 10, 1),
        target_completion_date=date(2028, 10, 1)
    )
    db.add(proj)
    db.commit()
    db.refresh(proj)

    extractor = GeotechnicalReportExtractor(REPORT_ROCK_TEXT, [REPORT_ROCK_TEXT])
    complete_intel = extractor.extract_complete_intelligence()
    pipeline_res = GeotechnicalPipelineEngine.run_pipeline(complete_intel)
    complete_intel["pipeline_intelligence"] = pipeline_res

    rep = GeotechnicalReport(
        project_id=proj.id,
        report_code=f"GT-TEST-{uniq}",
        report_title="Geotechnical Study - Sunrise Residency",
        intelligence_data_json=json.dumps(complete_intel),
        status="ANALYZED"
    )
    db.add(rep)
    db.commit()
    db.refresh(rep)

    rep_id = str(rep.id)

    # Test 1: GET /api/geotechnical/{report_id}/five-layers
    res_layers = client.get(f"/api/geotechnical/{rep_id}/five-layers")
    assert res_layers.status_code == 200
    layers_data = res_layers.json()
    assert "layer_1_site_boreholes" in layers_data
    assert "layer_5_project_intelligence" in layers_data

    # Test 2: GET /api/geotechnical/{report_id}/sixteen-parameters
    res_16 = client.get(f"/api/geotechnical/{rep_id}/sixteen-parameters")
    assert res_16.status_code == 200
    params_data = res_16.json()
    assert "project_site_info" in params_data
    assert "spt_n_data" in params_data
    assert "bearing_capacity" in params_data

    # Test 3: GET /api/geotechnical/{report_id}/standard-json
    res_std = client.get(f"/api/geotechnical/{rep_id}/standard-json")
    assert res_std.status_code == 200
    std_data = res_std.json()
    assert "project" in std_data
    assert "boreholes" in std_data
    assert "foundation" in std_data

    # Test 4: GET /api/geotechnical/{report_id}/pipeline
    res_pipe = client.get(f"/api/geotechnical/{rep_id}/pipeline")
    assert res_pipe.status_code == 200
    pipe_data = res_pipe.json()
    assert "foundation_validation" in pipe_data
    assert "geotechnical_boq_items" in pipe_data

    # Test 5: POST /api/geotechnical/{report_id}/sync-boq
    res_sync = client.post(f"/api/geotechnical/{rep_id}/sync-boq")
    assert res_sync.status_code == 200
    sync_data = res_sync.json()
    assert sync_data["status"] == "success"
    assert sync_data["synced_items_count"] >= 3

    # Verify BOQItem rows created in database
    boq_items = db.query(BOQItem).filter(BOQItem.project_id == proj.id).all()
    assert len(boq_items) >= 3
    codes = [b.item_code for b in boq_items]
    assert "GEO-BOQ-01" in codes
