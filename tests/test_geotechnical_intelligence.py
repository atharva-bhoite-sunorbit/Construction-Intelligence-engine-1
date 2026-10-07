import pytest
import io
import json
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from backend.app.services.geotech_intel.extractor import GeotechnicalReportExtractor
from backend.app.services.geotech_intel.engine import GeotechnicalValidationEngine, GeotechnicalRiskEngine
from backend.app.services.geotech_intel.fields import is_found, val, NOT_IN_REPORT


REPORT_A_TEXT = """
PRELIMINARY GEOTECHNICAL INVESTIGATION REPORT
PROPOSED COMPOSITE BUILDING “SHREE GARESH SRA CHS”
FOR SUNSHINE BUILDERS
LOCATION: Vile Parle (W), Mumbai
The proposed building will consist Ground + 11 Upper Floors.
The work was completed in May 2026 by Geocon International Pvt. Ltd.

2.0 EXPLORATION PROGRAM
Five Boreholes (BH-01 to BH-05) were completed for the project.

LAYER I: FILL (0.0 to 1.5m)
LAYER II: RESIDUAL SOILS (grayish sandy clay, loose density)
LAYER III: COMPLETELY WEATHERED ROCK (CWR) at depths 1.5m to 4.5m
LAYER IV: HARD BASALT BEDROCK at depths 3.0m to 9.0m
Core Recoveries varied from 37% to 92%, RQD ranged from 8% to 92%.
Compressive strength of rock samples varied from 34.00 kg/cm2 to 128.21 kg/cm2.
Termination depth is 12.0m below ground surface.

2.3 GROUND WATER LEVELS
Groundwater was observed at depths of 1.5m to 2.5m below ground surface. Seasonal fluctuations expected.

3.0 FOUNDATION RECOMMENDATIONS
Spread foundations supported on completely weathered rock can be designed for a maximum net allowable bearing capacity of 50 t/m2.
TABLE A
DEPTHS TO CWR TO HARD ROCK
BH-01 1.50m 3.0m
BH-02 4.50m 9.0m
BH-03 1.50m 6.0m
BH-04 1.50m 6.0m
BH-05 4.50m 7.5m

Maximum settlement will be less than 12mm. Subgrade modulus of 4,100 t/m3.
Excavation sides sloped at a maximum slope of 2:1 or flatter.

3.1 FOUNDATION PROTECTION
Moderate exposure condition.
Type of Cement: OPC or PPC
Minimum Grade of Reinforced Concrete: M25
Minimum Cement Content: 300 kg/m3
Maximum Water Cement Ratio: 0.50
Minimum Cover to Reinforcement: 50mm
"""

REPORT_B_TEXT = """
GEOTECHNICAL INVESTIGATION REPORT
PROPOSED TECH PARK TOWER
FOR INFRA VENTURES
LOCATION: Whitefield, Bangalore
Eight Boreholes (BH-01 to BH-08) were completed.

Hard Granite Bedrock encountered.
Groundwater table observed at depth 5.0m below ground level.
Termination depth: 15.0m
Safe bearing capacity: 75 t/m2
"""

REPORT_C_TEXT = """
GEOTECHNICAL SOIL REPORT
PROPOSED LOW-RISE HOUSING
FOR CITY HOUSING
LOCATION: Ahmedabad, Gujarat
Two Boreholes (BH-01 and BH-02) were completed.
Soil consists of dense silty sand.
Groundwater observed at 4.0m below ground.
Termination at 8.0m in dense sand.
No bedrock encountered in the exploration depth.
Spread footings designed for 18 t/m2.
"""


def test_shree_garesh_benchmark_report():
    extractor = GeotechnicalReportExtractor(REPORT_A_TEXT, [REPORT_A_TEXT])
    res = extractor.extract_all()

    proj = res["project_information"]
    assert "SHREE GARESH" in str(proj["project_name"]["display"]).upper()
    assert "SUNSHINE BUILDERS" in str(proj["client"]["display"]).upper()
    assert "VILE PARLE" in str(proj["location"]["display"]).upper()
    assert "11" in str(proj["number_of_floors"]["display"])

    inv = res["investigation_information"]
    assert inv["number_of_boreholes"]["value"] == 5

    bhs = res["boreholes"]
    assert len(bhs) == 5
    # Verify individual boreholes are not merged:
    bh_map = {b["borehole_id"]: b for b in bhs}
    assert bh_map["BH-01"]["cwr_depth"] == 1.5
    assert bh_map["BH-01"]["hard_rock_depth"] == 3.0
    assert bh_map["BH-02"]["cwr_depth"] == 4.5
    assert bh_map["BH-02"]["hard_rock_depth"] == 9.0
    assert bh_map["BH-05"]["cwr_depth"] == 4.5
    assert bh_map["BH-05"]["hard_rock_depth"] == 7.5

    rock = res["rock_analysis"]
    assert "Basalt" in str(rock["rock_type"]["display"])
    assert "37" in str(rock["core_recovery"]["display"]) and "92%" in str(rock["core_recovery"]["display"])
    assert "8" in str(rock["rqd"]["display"]) and "92%" in str(rock["rqd"]["display"])
    assert "34.00" in str(rock["compressive_strength"]["display"]) and "128.21" in str(rock["compressive_strength"]["display"])
    # Verify calculated MPa conversion exists and is marked CALCULATED
    assert rock["compressive_strength_mpa_equivalent"]["source_type"] == "CALCULATED"

    found = res["foundation_recommendations"]
    assert "Spread" in str(found["foundation_type"]["display"])
    assert "50" in str(found["net_allowable_bearing_capacity"]["display"])
    assert "12" in str(found["maximum_settlement"]["display"])

    conc = res["concrete_protection"]
    assert "M25" in str(conc["concrete_grade"]["display"])
    assert "300" in str(conc["minimum_cement"]["display"])
    assert "50" in str(conc["minimum_cover"]["display"])


def test_anti_bias_across_reports():
    """
    Test 36: Strict multi-report test for zero cross-contamination / bias.
    Report A has Basalt & 5 boreholes.
    Report B has Granite & 8 boreholes.
    Report C has NO rock -> Output MUST NOT be Basalt!
    """
    # 1. Process Report A
    res_a = GeotechnicalReportExtractor(REPORT_A_TEXT, [REPORT_A_TEXT]).extract_all()
    assert "Basalt" in res_a["rock_analysis"]["rock_type"]["display"]
    assert res_a["investigation_information"]["number_of_boreholes"]["value"] == 5

    # 2. Process Report B
    res_b = GeotechnicalReportExtractor(REPORT_B_TEXT, [REPORT_B_TEXT]).extract_all()
    assert "Granite" in res_b["rock_analysis"]["rock_type"]["display"]
    assert res_b["investigation_information"]["number_of_boreholes"]["value"] == 8

    # 3. Process Report C (No rock)
    res_c = GeotechnicalReportExtractor(REPORT_C_TEXT, [REPORT_C_TEXT]).extract_all()
    rock_display = res_c["rock_analysis"]["rock_type"]["display"]
    # MUST NOT hallucinate Basalt or Granite
    assert "Basalt" not in rock_display
    assert "Granite" not in rock_display
    assert rock_display in ["Bedrock", NOT_IN_REPORT]
    assert res_c["investigation_information"]["number_of_boreholes"]["value"] == 2


def test_validation_and_risk_engines():
    res_a = GeotechnicalReportExtractor(REPORT_A_TEXT, [REPORT_A_TEXT]).extract_all()
    val_out = GeotechnicalValidationEngine.validate(res_a)
    assert val_out["is_valid"] is True
    assert len(val_out["passed_checks"]) > 0

    risks = GeotechnicalRiskEngine.evaluate_risks(res_a)
    assert len(risks) > 0
    # Every risk must be source_type = AI_INTERPRETATION
    for r in risks:
        assert r["source_type"] == "AI_INTERPRETATION"
        assert r["severity"] in ["HIGH", "MEDIUM", "LOW"]
