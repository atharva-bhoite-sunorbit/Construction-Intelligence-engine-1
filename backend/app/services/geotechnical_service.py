"""
Geotechnical Report Intelligence Engine
=======================================

Turns an uploaded geotechnical / borelog report (PDF, DOCX, XLSX, TXT, CSV) into:

1. Strata profile  - soil & rock layers with depth ranges, UCS, RQD, weathering.
2. Rock-type summary - every soil/rock type found within the excavation depth.
3. Excavability classification (Class I-V) per layer.
4. Machinery selection - JCB / excavator / breaker / drill rig / tipper fleet,
   with counts sized from quantities and productivity norms.
5. Detailed, time-phased activity plan - every activity with duration, start/end
   working day, calendar dates, predecessors (FS/SS/FF + lag), crew, machinery,
   quantity, daily output, and CPM critical path.

The productivity norms are typical Indian site norms for planning purposes and
should be validated against the contractor's actual fleet performance.
"""
import io
import re
import html
import math
import zipfile
from datetime import date, timedelta
from typing import Any, Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# Knowledge base
# ---------------------------------------------------------------------------

# Ordered by match priority: specific rock names first, then generic rock,
# then mixed/dense soils, then ordinary soils.
MATERIAL_LIBRARY: List[Dict[str, Any]] = [
    {"key": "quartzite", "name": "Quartzite", "category": "Hard Rock", "patterns": [r"quartzite"], "ucs": 200, "rqd": 70, "bulking": 1.60, "base_class": 5, "color": "#94a3b8",
     "description": "Extremely hard, abrasive metamorphic rock. High bit and breaker-tool wear."},
    {"key": "dolerite", "name": "Dolerite / Diabase", "category": "Hard Rock", "patterns": [r"doler", r"diabase"], "ucs": 180, "rqd": 70, "bulking": 1.60, "base_class": 5, "color": "#1e293b",
     "description": "Very strong, dense igneous intrusive rock."},
    {"key": "granite", "name": "Granite", "category": "Hard Rock", "patterns": [r"granit"], "ucs": 160, "rqd": 75, "bulking": 1.60, "base_class": 5, "color": "#9f7aea",
     "description": "Massive, very strong crystalline igneous rock."},
    {"key": "basalt", "name": "Basalt", "category": "Hard Rock", "patterns": [r"basalt", r"deccan\s*trap", r"\btrap\s*rock"], "ucs": 140, "rqd": 70, "bulking": 1.55, "base_class": 5, "color": "#334155",
     "description": "Strong, fine-grained volcanic rock (Deccan Trap). Often jointed; vesicular/amygdaloidal varieties are weaker."},
    {"key": "gneiss", "name": "Gneiss", "category": "Hard Rock", "patterns": [r"gneiss", r"charnockite"], "ucs": 130, "rqd": 65, "bulking": 1.55, "base_class": 5, "color": "#6b7280",
     "description": "Banded metamorphic rock; strength varies along foliation."},
    {"key": "limestone", "name": "Limestone", "category": "Medium Rock", "patterns": [r"lime\s*stone"], "ucs": 80, "rqd": 60, "bulking": 1.55, "base_class": 4, "color": "#c9c08f",
     "description": "Sedimentary carbonate rock. Check for solution cavities / karst."},
    {"key": "dolomite", "name": "Dolomite", "category": "Medium Rock", "patterns": [r"dolomit"], "ucs": 90, "rqd": 60, "bulking": 1.55, "base_class": 4, "color": "#a3b18a",
     "description": "Carbonate rock, generally stronger than limestone."},
    {"key": "marble", "name": "Marble", "category": "Medium Rock", "patterns": [r"marble"], "ucs": 90, "rqd": 65, "bulking": 1.55, "base_class": 4, "color": "#cbd5e1",
     "description": "Metamorphosed carbonate rock."},
    {"key": "sandstone", "name": "Sandstone", "category": "Medium Rock", "patterns": [r"sand\s*stone"], "ucs": 50, "rqd": 55, "bulking": 1.50, "base_class": 4, "color": "#d97706",
     "description": "Clastic sedimentary rock; strength depends on cementation."},
    {"key": "schist", "name": "Schist / Phyllite / Slate", "category": "Medium Rock", "patterns": [r"schist", r"phyllite", r"\bslate"], "ucs": 45, "rqd": 45, "bulking": 1.50, "base_class": 4, "color": "#64748b",
     "description": "Foliated metamorphic rock; splits along planes of weakness."},
    {"key": "shale", "name": "Shale / Mudstone", "category": "Soft Rock", "patterns": [r"\bshale", r"mud\s*stone", r"silt\s*stone", r"clay\s*stone"], "ucs": 20, "rqd": 35, "bulking": 1.45, "base_class": 3, "color": "#57534e",
     "description": "Laminated fine-grained sedimentary rock. Slakes and softens on exposure to water."},
    {"key": "laterite_rock", "name": "Laterite Rock", "category": "Soft Rock", "patterns": [r"laterit\w*\s+rock", r"hard\s+laterit", r"lateritic\s+crust"], "ucs": 8, "rqd": 30, "bulking": 1.40, "base_class": 3, "color": "#9a3412",
     "description": "Indurated iron-rich residual rock; hard crust over softer lithomarge."},
    {"key": "hard_rock", "name": "Hard Rock (Unclassified)", "category": "Hard Rock", "patterns": [r"hard\s*rock", r"fresh\s*rock", r"bed\s*rock", r"massive\s*rock"], "ucs": 100, "rqd": 65, "bulking": 1.55, "base_class": 5, "color": "#475569",
     "description": "Competent fresh rock - type not specified in report."},
    {"key": "weathered_rock", "name": "Soft / Weathered Rock (SDR)", "category": "Soft Rock", "patterns": [r"soft\s*disintegrated\s*rock", r"\bs\.?d\.?r\b", r"weathered\s*rock", r"soft\s*rock", r"disintegrated\s*rock", r"fractured\s*rock", r"\bhwr\b", r"\bmwr\b"], "ucs": 10, "rqd": 15, "bulking": 1.40, "base_class": 3, "color": "#a16207",
     "description": "Highly to completely weathered / disintegrated rock. Rippable; may contain hard core-stones."},
    {"key": "boulders", "name": "Soil with Boulders", "category": "Mixed", "patterns": [r"boulder", r"cobbles?\s+and\s+boulders", r"core\s*stones?"], "ucs": 60, "rqd": None, "bulking": 1.35, "base_class": 3, "color": "#78716c",
     "description": "Soil matrix with large rock boulders requiring intermittent breaking."},
    {"key": "murrum", "name": "Murrum (Moorum)", "category": "Dense Soil", "patterns": [r"m[ou]+r+[ou]*m", r"murrum", r"moorum"], "ucs": 1, "rqd": None, "bulking": 1.25, "base_class": 2, "color": "#c2410c",
     "description": "Weathered gravelly residual soil (decomposed rock). Dense to very dense; hard digging."},
    {"key": "laterite", "name": "Lateritic Soil", "category": "Dense Soil", "patterns": [r"laterit"], "ucs": 1, "rqd": None, "bulking": 1.25, "base_class": 2, "color": "#ea580c",
     "description": "Iron/aluminium-rich residual soil; hardens on exposure."},
    {"key": "gravel", "name": "Sandy Gravel", "category": "Dense Soil", "patterns": [r"gravel", r"pebble", r"\bgw\b", r"\bgp\b", r"\bgm\b", r"\bgc\b"], "ucs": 0.5, "rqd": None, "bulking": 1.15, "base_class": 2, "color": "#9ca3af",
     "description": "Granular coarse soil. Free-draining; unstable side slopes below water table."},
    {"key": "black_cotton", "name": "Black Cotton Soil (Expansive Clay)", "category": "Soil", "patterns": [r"black\s*cotton", r"expansive\s*(?:clay|soil)", r"\bbc\s*soil"], "ucs": 0.1, "rqd": None, "bulking": 1.30, "base_class": 1, "color": "#292524",
     "description": "Highly expansive montmorillonite clay. Sticky when wet; swells/shrinks with moisture."},
    {"key": "clay", "name": "Clay", "category": "Soil", "patterns": [r"clay", r"\bc[hil]\b"], "ucs": 0.1, "rqd": None, "bulking": 1.30, "base_class": 1, "color": "#b45309",
     "description": "Cohesive fine-grained soil. Plastic and sticky when wet."},
    {"key": "silt", "name": "Silt", "category": "Soil", "patterns": [r"\bsilt", r"\bm[hil]\b"], "ucs": 0.05, "rqd": None, "bulking": 1.20, "base_class": 1, "color": "#d6a96b",
     "description": "Fine non-plastic to low-plastic soil; loses strength when saturated."},
    {"key": "sand", "name": "Sand", "category": "Soil", "patterns": [r"\bsand(?!\s*stone)", r"\bsandy", r"\bs[wpmc]\b"], "ucs": 0.0, "rqd": None, "bulking": 1.15, "base_class": 1, "color": "#eab308",
     "description": "Granular soil. Side slopes ravel; quick condition possible below water table."},
    {"key": "topsoil", "name": "Topsoil / Organic Soil", "category": "Soil", "patterns": [r"top\s*soil", r"vegetat", r"organic"], "ucs": 0.0, "rqd": None, "bulking": 1.25, "base_class": 1, "color": "#4d7c0f",
     "description": "Surface organic layer; strip and stockpile separately."},
    {"key": "fill", "name": "Fill / Made Ground", "category": "Soil", "patterns": [r"\bfill(?:ed)?\b", r"made\s*(?:up\s*)?ground", r"debris", r"rubble"], "ucs": 0.0, "rqd": None, "bulking": 1.15, "base_class": 1, "color": "#a8a29e",
     "description": "Previously placed / reclaimed material of variable composition."},
]
MATERIAL_BY_KEY = {m["key"]: m for m in MATERIAL_LIBRARY}
ROCK_CATEGORIES = {"Hard Rock", "Medium Rock", "Soft Rock"}

EXCAVABILITY_CLASSES: Dict[int, Dict[str, str]] = {
    1: {"code": "Class I", "label": "Class I - Soft Dig", "method": "Direct bucket excavation",
        "description": "Loose to medium soils. Dug directly with backhoe loader or excavator bucket."},
    2: {"code": "Class II", "label": "Class II - Hard Dig", "method": "Heavy-duty / rock-bucket excavation",
        "description": "Dense soils, murrum, gravel. Excavator with heavy-duty rock bucket and penetration teeth."},
    3: {"code": "Class III", "label": "Class III - Rippable Soft Rock", "method": "Ripping + excavation",
        "description": "Weathered / soft rock (UCS 5-25 MPa) or highly fractured rock. Ripper tooth then bucket."},
    4: {"code": "Class IV", "label": "Class IV - Hydraulic Rock Breaking", "method": "Hydraulic breaker + mucking",
        "description": "Medium-strong rock (UCS 25-70 MPa) or jointed hard rock. Excavator-mounted hydraulic hammer."},
    5: {"code": "Class V", "label": "Class V - Drilling & Controlled Blasting", "method": "Drill & blast + mucking",
        "description": "Strong to very strong massive rock (UCS > 70 MPa, RQD > 50%). Drilling and controlled blasting."},
}

EQUIPMENT_CATALOG: Dict[str, Dict[str, str]] = {
    "backhoe": {"name": "Backhoe Loader", "models": "JCB 3DX Super / 3DX Xtra / 4DX",
                "spec": "0.26 m3 backhoe bucket, 1.1 m3 front loader, 76 hp",
                "role": "Small-area soft-soil excavation, trimming, loading and site clearance"},
    "excavator_20t": {"name": "20-22 t Hydraulic Excavator", "models": "JCB JS205 / Tata Hitachi EX210 / Komatsu PC210",
                      "spec": "1.0-1.2 m3 GP bucket, 6.5 m max dig depth",
                      "role": "Bulk excavation and loading of soil and broken rock"},
    "excavator_rock": {"name": "20-22 t Excavator with Rock Bucket", "models": "JCB JS205 / Tata Hitachi EX210 with HD rock bucket",
                       "spec": "0.9 m3 heavy-duty rock bucket with penetration teeth",
                       "role": "Hard digging in dense murrum, gravel and lateritic soils"},
    "excavator_ripper": {"name": "30-36 t Excavator with Ripper Tooth", "models": "JCB JS305 / Komatsu PC350 / CAT 336",
                         "spec": "Single-shank ripper attachment, 250+ hp",
                         "role": "Ripping weathered / soft disintegrated rock before loading"},
    "dozer_ripper": {"name": "Crawler Dozer with Ripper", "models": "BEML BD155 / CAT D8 / Komatsu D155",
                     "spec": "Single-shank rear ripper, 300+ hp",
                     "role": "Large-area ripping of soft rock (open excavations > 3000 m2)"},
    "breaker": {"name": "Excavator-mounted Hydraulic Rock Breaker", "models": "JCB JS205 / Tata Hitachi EX210 carrier + JCB HM1560 / Soosan SB81 / Furukawa F22",
                "spec": "1.5-2.2 t breaker, 1500-2500 J impact energy",
                "role": "Breaking medium-strong and jointed rock; secondary breaking of boulders"},
    "heavy_breaker": {"name": "Heavy Hydraulic Breaker on 30 t Carrier", "models": "JCB JS305 / Komatsu PC300 + Soosan SB121 / Epiroc HB 3100",
                      "spec": "3.0-3.5 t breaker, 5000+ J impact energy",
                      "role": "Breaking massive hard rock where blasting is not permitted"},
    "drill_rig": {"name": "Crawler DTH / Top-hammer Drill Rig", "models": "Epiroc ROC D7 / Sandvik DX800 / Indian crawler drill (Revathi / KCT)",
                  "spec": "89-115 mm blast-hole drilling, up to 15 m depth",
                  "role": "Drilling blast holes in strong massive rock"},
    "compressor": {"name": "Portable Air Compressor", "models": "ELGi PG 600-215 / Atlas Copco XAHS 447",
                   "spec": "450-600 CFM at 10-17 bar",
                   "role": "Air supply to DTH drill rig and pneumatic jack hammers"},
    "jackhammer": {"name": "Pneumatic Jack Hammer Drills", "models": "Atlas Copco RH 658 / Toku TJ-20",
                   "spec": "32-38 mm button bits",
                   "role": "Trimming, presplit line drilling and secondary breaking near founding level"},
    "rock_splitter": {"name": "Hydraulic Rock Splitter / Expansive Mortar", "models": "Darda C12 splitter / Bustar non-explosive demolition agent",
                      "spec": "Non-explosive, vibration-free",
                      "role": "Rock breaking close to existing structures where blasting is prohibited"},
    "tipper": {"name": "Tipper / Dumper Truck", "models": "Tata Signa 2823.K / Ashok Leyland 2820 / BharatBenz 2828C",
               "spec": "16-18 m3 body, approx. 12 m3 loose payload",
               "role": "Haulage of excavated muck to dump yard"},
    "dewatering_pump": {"name": "Dewatering Pumps", "models": "Kirloskar / Grundfos submersible slurry pumps",
                        "spec": "5-10 hp, 50 mm-100 mm discharge, with standby",
                        "role": "Sump / wellpoint dewatering below groundwater table"},
    "water_tanker": {"name": "Water Tanker (Dust Suppression)", "models": "Tractor-trolley / 10 kL tanker",
                     "spec": "10,000 L",
                     "role": "Dust suppression on haul roads and rock-breaking faces"},
    "plate_compactor": {"name": "Vibratory Plate Compactor", "models": "Wacker Neuson / Ajax plate compactor",
                        "spec": "90-120 kg",
                        "role": "Compaction of soil founding level before PCC"},
}

# Job efficiency (50-min hour, operator & site factors)
JOB_EFFICIENCY = 0.75


def _ceil(x: float) -> int:
    return max(1, int(math.ceil(x - 1e-9)))


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


# ---------------------------------------------------------------------------
# Text extraction
# ---------------------------------------------------------------------------

def extract_text_from_file(content: bytes, filename: str) -> Tuple[str, List[str]]:
    """Extracts plain text from PDF / DOCX / XLSX / TXT / CSV uploads."""
    warnings: List[str] = []
    name = (filename or "").lower()
    text = ""

    try:
        if name.endswith(".pdf") or content[:5] == b"%PDF-":
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(content))
            pages = []
            for page in reader.pages:
                try:
                    pages.append(page.extract_text() or "")
                except Exception:
                    pages.append("")
            text = "\n".join(pages)
            if len(text.strip()) < 60:
                warnings.append(
                    "Very little text could be extracted from this PDF - it is probably a scanned image. "
                    "Paste the borelog text manually for accurate strata detection."
                )
        elif name.endswith(".docx"):
            with zipfile.ZipFile(io.BytesIO(content)) as zf:
                xml = zf.read("word/document.xml").decode("utf-8", errors="ignore")
            xml = re.sub(r"</w:p>", "\n", xml)
            xml = re.sub(r"<w:tab/>", "\t", xml)
            text = html.unescape(re.sub(r"<[^>]+>", "", xml))
        elif name.endswith((".xlsx", ".xlsm")):
            import openpyxl
            wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True, read_only=True)
            lines = []
            for ws in wb.worksheets:
                for row in ws.iter_rows(values_only=True):
                    cells = [str(c) for c in row if c is not None and str(c).strip()]
                    if cells:
                        lines.append(" | ".join(cells))
            text = "\n".join(lines)
        else:
            for enc in ("utf-8", "utf-16", "latin-1"):
                try:
                    text = content.decode(enc)
                    break
                except UnicodeDecodeError:
                    continue
    except Exception as exc:  # pragma: no cover - defensive
        warnings.append(f"Could not fully read the file ({exc}). Results are based on partially extracted text.")

    return text, warnings


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------

_DEPTH_RANGE = re.compile(
    r"(?<![\d.])(\d{1,2}(?:\.\d{1,2})?)\s*(?:m(?:trs?|eters?|etres?)?\.?)?\s*(?:-|–|—|to|\|)\s*(\d{1,2}(?:\.\d{1,2})?)\s*(?:m(?:trs?|eters?|etres?)?\b\.?)?",
    re.IGNORECASE,
)
_RQD = re.compile(r"\brqd\b[^\d\n]{0,15}(\d{1,3}(?:\.\d+)?)\s*%?", re.IGNORECASE)
_CR = re.compile(r"(?:core\s*recovery|\btcr\b|\bcr\b)[^\d\n]{0,15}(\d{1,3}(?:\.\d+)?)\s*%?", re.IGNORECASE)
_UCS = re.compile(
    r"(?:\bucs\b|unconfined\s+compressive\s+strength|compressive\s+strength|point\s+load\s+index\s+equivalent\s+ucs)"
    r"[^\d\n]{0,25}(\d{1,4}(?:\.\d+)?)\s*(mpa|n/mm2|n/mm²|kg/cm2|kg/cm²|kn/m2|kpa)?",
    re.IGNORECASE,
)
_SPT = re.compile(r"(?:\bspt\b|\bn[\s-]*value\b|\bn\s*=)[^\d\n]{0,12}(>?\s*\d{1,3})", re.IGNORECASE)
_WATER_TABLE = re.compile(
    r"(?:water\s*table|ground\s*water(?:\s*table|\s*level)?|\bgwl\b|\bgwt\b)[^\d\n]{0,40}?(\d{1,2}(?:\.\d{1,2})?)\s*(?:m\b|mtr|meter|metre)",
    re.IGNORECASE,
)
_WATER_NOT_FOUND = re.compile(
    r"(?:water\s*table|ground\s*water)[^\n]{0,40}(?:not\s+(?:met|encountered|found|observed)|absent|nil)",
    re.IGNORECASE,
)
_BOREHOLE_ID = re.compile(r"\b(?:bh|borehole|bore\s*hole|pit|tp|trial\s*pit)\s*(?:no\.?|number|#)?\s*[-:.]?\s*(\d{1,3})\b", re.IGNORECASE)


def _detect_material(text: str) -> Optional[Dict[str, Any]]:
    low = text.lower()
    for mat in MATERIAL_LIBRARY:
        for pat in mat["patterns"]:
            if re.search(pat, low):
                return mat
    return None


def _detect_weathering(text: str) -> Optional[str]:
    low = text.lower()
    m = re.search(r"\bw\s*-?\s*([1-5])\b", low)
    if m:
        return f"W{m.group(1)}"
    if re.search(r"completely\s+weathered|residual", low):
        return "W5"
    if re.search(r"highly\s+weathered|highly\s+fractured|soft\s+disintegrated", low):
        return "W4"
    if re.search(r"moderately\s+weathered|moderately\s+fractured", low):
        return "W3"
    if re.search(r"slightly\s+weathered|slightly\s+fractured", low):
        return "W2"
    if re.search(r"\bfresh\b|unweathered|massive", low):
        return "W1"
    return None


WEATHERING_LABEL = {
    "W1": "W1 (Fresh)", "W2": "W2 (Slightly Weathered)", "W3": "W3 (Moderately Weathered)",
    "W4": "W4 (Highly Weathered)", "W5": "W5 (Completely Weathered)",
}
WEATHERING_UCS_FACTOR = {"W1": 1.0, "W2": 0.8, "W3": 0.5, "W4": 0.2, "W5": 0.06}
WEATHERING_RQD_FACTOR = {"W1": 1.1, "W2": 1.0, "W3": 0.7, "W4": 0.35, "W5": 0.1}


def _parse_ucs(text: str) -> Optional[float]:
    m = _UCS.search(text)
    if not m:
        return None
    try:
        val = float(m.group(1))
    except ValueError:
        return None
    unit = (m.group(2) or "mpa").lower()
    if unit.startswith("kg"):
        val *= 0.0981
    elif unit in ("kn/m2", "kpa"):
        val /= 1000.0
    return round(val, 1) if 0 < val < 400 else None


def _parse_pct(regex: re.Pattern, text: str) -> Optional[float]:
    m = regex.search(text)
    if not m:
        return None
    try:
        v = float(m.group(1))
        return v if 0 <= v <= 100 else None
    except ValueError:
        return None


def _parse_spt(text: str) -> Optional[int]:
    if re.search(r"\brefusal\b", text, re.IGNORECASE):
        return 100
    m = _SPT.search(text)
    if not m:
        return None
    try:
        return int(re.sub(r"[^\d]", "", m.group(1)))
    except ValueError:
        return None


def _classify(category: str, base_class: int, ucs: Optional[float], rqd: Optional[float], spt: Optional[int]) -> int:
    if category not in ROCK_CATEGORIES:
        cls = base_class
        if spt is not None and spt >= 50:
            cls = max(cls, 2)
        if spt is not None and spt >= 100 and category == "Dense Soil":
            cls = max(cls, 3)
        return cls
    u = ucs if ucs is not None else 50
    if u < 5:
        cls = 2
    elif u < 25:
        cls = 3
    elif u < 70:
        cls = 4
    else:
        cls = 5
    if rqd is not None:
        if rqd < 25 and cls >= 4:
            cls -= 1
        if cls == 5 and rqd < 50 and u < 100:
            cls = 4
    return cls


def _build_layer(top: float, bottom: float, mat: Dict[str, Any], context: str,
                 global_ucs: Optional[float], global_rqd: Optional[float], source: str) -> Dict[str, Any]:
    is_rock = mat["category"] in ROCK_CATEGORIES
    weathering = _detect_weathering(context) if (is_rock or mat["key"] == "weathered_rock") else None
    if mat["key"] == "weathered_rock" and not weathering:
        weathering = "W4"

    ucs = _parse_ucs(context)
    rqd = _parse_pct(_RQD, context)
    cr = _parse_pct(_CR, context)
    spt = _parse_spt(context)

    ucs_source = "report" if ucs is not None else None
    rqd_source = "report" if rqd is not None else None

    if is_rock:
        wf = WEATHERING_UCS_FACTOR.get(weathering or "W2", 0.8)
        if ucs is None and global_ucs is not None:
            ucs, ucs_source = global_ucs, "report (global)"
        if ucs is None:
            ucs, ucs_source = round(mat["ucs"] * wf, 1), "typical value"
        if rqd is None and global_rqd is not None:
            rqd, rqd_source = global_rqd, "report (global)"
        if rqd is None:
            rqd, rqd_source = round(_clamp((mat["rqd"] or 50) * WEATHERING_RQD_FACTOR.get(weathering or "W2", 1.0), 0, 100), 0), "typical value"
    else:
        ucs = ucs if ucs is not None else (mat["ucs"] if mat["key"] == "boulders" else None)

    cls = _classify(mat["category"], mat["base_class"], ucs if is_rock else None, rqd if is_rock else None, spt)
    # Boulder layers always need intermittent breaking
    if mat["key"] == "boulders":
        cls = max(cls, 3)

    return {
        "material_key": mat["key"],
        "material": mat["name"],
        "category": mat["category"],
        "is_rock": is_rock,
        "description": mat["description"],
        "report_description": re.sub(r"\s+", " ", context).strip()[:220],
        "color": mat["color"],
        "top_m": round(top, 2),
        "bottom_m": round(bottom, 2),
        "thickness_m": round(bottom - top, 2),
        "ucs_mpa": ucs,
        "ucs_source": ucs_source,
        "rqd_pct": rqd,
        "rqd_source": rqd_source,
        "core_recovery_pct": cr,
        "spt_n": spt,
        "weathering_grade": WEATHERING_LABEL.get(weathering) if weathering else None,
        "bulking_factor": mat["bulking"],
        "excavability_class_num": cls,
        "excavability_class": EXCAVABILITY_CLASSES[cls]["label"],
        "excavation_method": EXCAVABILITY_CLASSES[cls]["method"],
        "source": source,
    }


def parse_geotechnical_text(raw_text: str, target_depth_m: float) -> Dict[str, Any]:
    """Detects strata layers and key geotechnical parameters from report text."""
    text = raw_text or ""
    warnings: List[str] = []

    global_ucs = _parse_ucs(text)
    global_rqd = _parse_pct(_RQD, text)

    # Water table
    water_table: Optional[float] = None
    wt_note = "Not reported"
    if _WATER_NOT_FOUND.search(text):
        water_table, wt_note = None, "Not encountered within investigated depth"
    else:
        m = _WATER_TABLE.search(text)
        if m:
            try:
                water_table = float(m.group(1))
                wt_note = f"Encountered at {water_table} m below EGL"
            except ValueError:
                pass

    boreholes = sorted({int(x) for x in _BOREHOLE_ID.findall(text)})

    # 1. Line-based depth-range detection
    raw_intervals: List[Tuple[float, float, Dict[str, Any], str]] = []
    lines = [ln for ln in re.split(r"[\r\n]+", text) if ln.strip()]
    for idx, line in enumerate(lines):
        for m in _DEPTH_RANGE.finditer(line):
            try:
                top, bottom = float(m.group(1)), float(m.group(2))
            except ValueError:
                continue
            if not (0 <= top < bottom <= 60) or bottom - top > 40:
                continue
            context = line
            if len(re.sub(r"[^A-Za-z]", "", context)) < 4 and idx + 1 < len(lines):
                context = line + " " + lines[idx + 1]
            mat = _detect_material(context)
            if not mat and idx > 0:
                mat = _detect_material(lines[idx - 1] + " " + line)
            if mat:
                raw_intervals.append((top, bottom, mat, line + (" " + lines[idx + 1] if context != line else "")))
                break  # one interval per line

    layers: List[Dict[str, Any]] = []
    profile_inferred = False

    if raw_intervals:
        # Combine multiple boreholes: for each sub-interval take the most frequent material,
        # tie-broken by the harder (higher class) material -> conservative plant selection.
        cuts = sorted({0.0} | {t for t, _, _, _ in raw_intervals} | {b for _, b, _, _ in raw_intervals})
        segments: List[Tuple[float, float, Dict[str, Any], str]] = []
        for a, b in zip(cuts[:-1], cuts[1:]):
            mid = (a + b) / 2
            covering = [(mat, ctx) for t, bt, mat, ctx in raw_intervals if t <= mid < bt]
            if not covering:
                continue
            counts: Dict[str, int] = {}
            for mat, _ in covering:
                counts[mat["key"]] = counts.get(mat["key"], 0) + 1
            best_key = max(counts, key=lambda k: (counts[k], MATERIAL_BY_KEY[k]["base_class"]))
            ctx = next(c for mt, c in covering if mt["key"] == best_key)
            segments.append((a, b, MATERIAL_BY_KEY[best_key], ctx))

        # Merge adjacent identical materials
        merged: List[List[Any]] = []
        for a, b, mat, ctx in segments:
            if merged and merged[-1][2]["key"] == mat["key"] and abs(merged[-1][1] - a) < 1e-6:
                merged[-1][1] = b
            else:
                merged.append([a, b, mat, ctx])

        # Fill a gap at the top (e.g. first logged interval starts at 0.5 m)
        if merged and merged[0][0] > 0:
            merged[0][0] = 0.0
        for a, b, mat, ctx in merged:
            layers.append(_build_layer(a, b, mat, ctx, global_ucs, global_rqd, "Borelog depth interval"))
    else:
        # 2. Keyword-only fallback: materials in order of appearance, soils above rock
        found: List[Tuple[int, Dict[str, Any], str]] = []
        low = text.lower()
        seen = set()
        for mat in MATERIAL_LIBRARY:
            for pat in mat["patterns"]:
                mm = re.search(pat, low)
                if mm and mat["key"] not in seen:
                    # avoid counting 'clay' inside 'claystone' etc. when a rock was matched
                    seen.add(mat["key"])
                    s = max(0, mm.start() - 80)
                    found.append((mm.start(), mat, text[s:mm.end() + 120]))
                    break
        if found:
            profile_inferred = True
            order = {"Soil": 0, "Dense Soil": 1, "Mixed": 2, "Soft Rock": 3, "Medium Rock": 4, "Hard Rock": 5}
            found.sort(key=lambda f: (order.get(f[1]["category"], 9), f[0]))
            depth = 0.0
            thickness_default = {"Soil": 1.5, "Dense Soil": 1.5, "Mixed": 1.0, "Soft Rock": 2.0, "Medium Rock": 3.0, "Hard Rock": 4.0}
            for i, (_, mat, ctx) in enumerate(found[:6]):
                thk = thickness_default.get(mat["category"], 1.5)
                bottom = depth + thk if i < len(found[:6]) - 1 else max(depth + thk, target_depth_m)
                layers.append(_build_layer(depth, bottom, mat, ctx, global_ucs, global_rqd, "Inferred from keywords"))
                depth = bottom
            warnings.append(
                "No depth-wise borelog table was detected. Layer depths were inferred from material keywords "
                "and typical thicknesses - verify against the borelog."
            )
        else:
            profile_inferred = True
            warnings.append(
                "No soil or rock descriptions were recognised in the report. A generic residual-soil-over-rock "
                "profile has been assumed. Upload a text-based borelog or paste the strata description."
            )
            generic = [(0.0, 0.5, "fill"), (0.5, 2.0, "clay"), (2.0, 3.5, "murrum"), (3.5, 5.0, "weathered_rock"), (5.0, max(8.0, target_depth_m), "basalt")]
            for a, b, key in generic:
                layers.append(_build_layer(a, b, MATERIAL_BY_KEY[key], "", global_ucs, global_rqd, "Generic assumed profile"))

    # Extend the deepest layer down to the target excavation depth if the log terminated early
    if layers and layers[-1]["bottom_m"] < target_depth_m:
        last = layers[-1]
        warnings.append(
            f"Borelog terminates at {last['bottom_m']} m; '{last['material']}' has been extrapolated to the "
            f"target excavation depth of {target_depth_m} m."
        )
        last["bottom_m"] = round(target_depth_m, 2)
        last["thickness_m"] = round(last["bottom_m"] - last["top_m"], 2)
        last["extrapolated"] = True

    return {
        "layers": layers,
        "water_table_depth_m": water_table,
        "water_table_note": wt_note,
        "boreholes_detected": len(boreholes),
        "borehole_ids": boreholes,
        "global_ucs_mpa": global_ucs,
        "global_rqd_pct": global_rqd,
        "profile_inferred": profile_inferred,
        "warnings": warnings,
    }


# ---------------------------------------------------------------------------
# Rock-mass rating (simplified Bieniawski RMR89)
# ---------------------------------------------------------------------------

def estimate_rmr(ucs: float, rqd: float, weathering: Optional[str], wet: bool) -> Tuple[int, str]:
    r_ucs = 15 if ucs > 250 else 12 if ucs > 100 else 7 if ucs > 50 else 4 if ucs > 25 else 2 if ucs > 5 else 1 if ucs > 1 else 0
    r_rqd = 20 if rqd >= 90 else 17 if rqd >= 75 else 13 if rqd >= 50 else 8 if rqd >= 25 else 3
    r_spacing = 15 if rqd >= 75 else 10 if rqd >= 50 else 8 if rqd >= 25 else 5
    w = (weathering or "W2")[:2]
    r_cond = {"W1": 25, "W2": 20, "W3": 12, "W4": 6, "W5": 0}.get(w, 15)
    r_water = 7 if wet else 15
    rmr = r_ucs + r_rqd + r_spacing + r_cond + r_water
    label = ("Class I - Very Good Rock" if rmr > 80 else "Class II - Good Rock" if rmr > 60 else
             "Class III - Fair Rock" if rmr > 40 else "Class IV - Poor Rock" if rmr > 20 else "Class V - Very Poor Rock")
    return rmr, label


# ---------------------------------------------------------------------------
# Planning engine
# ---------------------------------------------------------------------------

class _PlanBuilder:
    """Incremental forward-pass scheduler matching the project CPM engine semantics."""

    def __init__(self) -> None:
        self.acts: List[Dict[str, Any]] = []
        self.by_code: Dict[str, Dict[str, Any]] = {}

    def add(self, code: str, name: str, phase: str, duration: float,
            preds: List[Dict[str, Any]], **fields: Any) -> Dict[str, Any]:
        dur = _ceil(duration)
        es = 0
        for p in preds:
            pa = self.by_code[p["code"]]
            t, lag = p.get("type", "FS"), int(p.get("lag", 0))
            if t == "SS":
                cand = pa["es"] + lag
            elif t == "FF":
                cand = pa["ef"] + lag - dur
            else:
                cand = pa["ef"] + lag
            es = max(es, cand)
        act = {"code": code, "name": name, "phase": phase, "duration_days": dur,
               "es": es, "ef": es + dur, "predecessors": preds}
        act.update(fields)
        self.acts.append(act)
        self.by_code[code] = act
        return act

    def window(self, codes: List[str]) -> Tuple[int, int]:
        sel = [self.by_code[c] for c in codes if c in self.by_code]
        return min(a["es"] for a in sel), max(a["ef"] for a in sel)

    def finalize(self) -> int:
        project_end = max(a["ef"] for a in self.acts)
        succs: Dict[str, List[Tuple[str, str, int]]] = {a["code"]: [] for a in self.acts}
        for a in self.acts:
            for p in a["predecessors"]:
                succs[p["code"]].append((a["code"], p.get("type", "FS"), int(p.get("lag", 0))))
        for a in reversed(self.acts):
            dur = a["duration_days"]
            if not succs[a["code"]]:
                lf = project_end
            else:
                lf = 10 ** 9
                for sc, t, lag in succs[a["code"]]:
                    s = self.by_code[sc]
                    if t == "SS":
                        cand = s["ls"] - lag + dur
                    elif t == "FF":
                        cand = s["lf"] - lag
                    else:
                        cand = s["ls"] - lag
                    lf = min(lf, cand)
            a["lf"] = lf
            a["ls"] = lf - dur
            a["total_float"] = max(0, a["ls"] - a["es"])
            a["is_critical"] = a["total_float"] == 0
        return project_end


def _working_day_to_date(start: date, offset: int, days_per_week: int) -> date:
    """offset = 0-based working-day index -> calendar date (skips Sundays / weekends)."""
    off_days = {7: set(), 6: {6}, 5: {5, 6}}.get(days_per_week, {6})
    d = start
    while d.weekday() in off_days:
        d += timedelta(days=1)
    count = 0
    while count < offset:
        d += timedelta(days=1)
        if d.weekday() not in off_days:
            count += 1
    return d


def _equip(key: str, count: int) -> Dict[str, Any]:
    e = EQUIPMENT_CATALOG[key]
    return {"key": key, "name": e["name"], "models": e["models"], "count": int(count)}


def build_excavation_plan(parsed: Dict[str, Any], params: Dict[str, Any]) -> Dict[str, Any]:
    area = float(params.get("excavation_area_sqm") or 1200.0)
    depth = float(params.get("target_depth_m") or 6.0)
    hours_shift = float(params.get("hours_per_shift") or 8.0)
    shifts = int(params.get("shifts_per_day") or 1)
    dpw = int(params.get("working_days_per_week") or 6)
    lead_km = float(params.get("haul_lead_km") or 2.0)
    blasting_ok = bool(params.get("blasting_permitted", True))
    near_structures = bool(params.get("near_existing_structures", False))
    start = params.get("start_date") or date.today()
    if isinstance(start, str):
        start = date.fromisoformat(start)

    gross_hours = hours_shift * shifts
    eff_hours = gross_hours * JOB_EFFICIENCY
    perimeter = 4 * math.sqrt(area)

    # Fleet sizing by working area (avoid machine congestion)
    auto_exc = 1 if area <= 300 else 2 if area <= 1500 else 3 if area <= 4000 else 4
    n_exc = int(params.get("max_excavators") or auto_exc)
    n_exc = int(_clamp(n_exc, 1, 8))

    water_table = parsed.get("water_table_depth_m")
    wet_excavation = water_table is not None and water_table < depth

    # ---- clip layers to the excavation depth & compute quantities ----
    exc_layers: List[Dict[str, Any]] = []
    for L in parsed["layers"]:
        top, bot = L["top_m"], min(L["bottom_m"], depth)
        if bot <= top:
            continue
        thk = bot - top
        allowance = 1.05 if L["is_rock"] else (1.10 if depth > 1.5 else 1.0)
        bank = area * thk * allowance
        layer = dict(L)
        layer.update({
            "exc_top_m": round(top, 2), "exc_bottom_m": round(bot, 2), "exc_thickness_m": round(thk, 2),
            "volume_allowance_factor": allowance,
            "bank_volume_cum": round(bank, 1),
            "loose_volume_cum": round(bank * L["bulking_factor"], 1),
            "below_water_table": bool(water_table is not None and bot > water_table),
        })
        exc_layers.append(layer)

    total_bank = sum(l["bank_volume_cum"] for l in exc_layers)
    rock_bank = sum(l["bank_volume_cum"] for l in exc_layers if l["is_rock"] or l["material_key"] == "boulders")
    soil_bank = total_bank - rock_bank
    total_loose = sum(l["loose_volume_cum"] for l in exc_layers)
    governing_class = max((l["excavability_class_num"] for l in exc_layers), default=1)
    any_blasting = blasting_ok and not near_structures and any(l["excavability_class_num"] == 5 for l in exc_layers)
    any_class5 = any(l["excavability_class_num"] == 5 for l in exc_layers)
    any_rock = any(l["excavability_class_num"] >= 3 for l in exc_layers)
    use_backhoe = total_bank < 600 or area < 200

    n_breakers = int(_clamp(n_exc, 1, 4))
    n_drills = 1 if rock_bank < 6000 else 2

    plan = _PlanBuilder()
    fleet_peak_loose_rate = 0.0  # loose m3/hr at peak, for tipper sizing

    # ---- 1. Pre-construction ----
    mob_days = 3 + (2 if any_class5 else 0) + (1 if any_rock else 0)
    mob_equip = [_equip("backhoe" if use_backhoe else "excavator_20t", 1 if use_backhoe else n_exc)]
    plan.add("GX-01", "Mobilisation of plant & machinery, site office, stores and safety signage", "Pre-Construction",
             mob_days, [], method="Transport machinery on trailers, set up site office, fuel store, first-aid, barricading and signage.",
             equipment=mob_equip, crew=[{"role": "Site Engineer", "count": 1}, {"role": "Supervisor", "count": 1}, {"role": "Helpers", "count": 6}],
             quantity=1, unit="LS", daily_output="-")

    if any_blasting:
        plan.add("GX-02", "Statutory approvals - blasting licence (PESO / DGMS), magazine, pre-condition survey of neighbouring structures", "Pre-Construction",
                 7, [{"code": "GX-01", "type": "SS", "lag": 0}],
                 method="Obtain explosive storage & usage licence, appoint licensed shot-firer, photograph/record existing cracks of adjacent buildings, fix vibration monitoring points.",
                 equipment=[], crew=[{"role": "Licensed Blaster (Shot-firer)", "count": 1}, {"role": "Safety Officer", "count": 1}, {"role": "Surveyor", "count": 1}],
                 quantity=1, unit="LS", daily_output="-")

    survey_days = _ceil(area / 2000) + 1
    plan.add("GX-03", "Topographic survey, setting out of excavation lines, benchmarks & underground utility scanning", "Pre-Construction",
             survey_days, [{"code": "GX-01", "type": "SS", "lag": 1}],
             method="Total-station survey, establish TBMs outside influence zone, peg excavation boundary with working space, GPR / cable locator scan.",
             equipment=[], crew=[{"role": "Surveyor", "count": 1}, {"role": "Survey Helpers", "count": 2}, {"role": "Site Engineer", "count": 1}],
             quantity=round(area, 0), unit="m2", daily_output=f"{round(area / survey_days):,} m2/day")

    clear_rate = 900 if not use_backhoe else 400
    clear_days = area / clear_rate
    plan.add("GX-04", "Site clearance, grubbing, removal of vegetation/debris & haul-road formation", "Site Preparation",
             clear_days, [{"code": "GX-03", "type": "FS", "lag": 0}, {"code": "GX-01", "type": "FS", "lag": 0}],
             method="Clear shrubs, roots and debris; form temporary haul ramp (1:8 to 1:10 gradient) and access road for tippers.",
             equipment=[_equip("backhoe", 1), _equip("tipper", 1)],
             crew=[{"role": "Operator", "count": 1}, {"role": "Driver", "count": 1}, {"role": "Helpers", "count": 4}],
             quantity=round(area, 0), unit="m2", daily_output=f"{clear_rate} m2/day")

    excavation_codes: List[str] = []
    entry_preds = [{"code": "GX-04", "type": "FS", "lag": 0}]

    # ---- 2. Dewatering set-up ----
    if wet_excavation:
        n_pumps = _ceil(area / 600) + 1
        plan.add("GX-05", f"Installation of dewatering system - sump pits / wellpoints and {n_pumps} pumps (incl. standby)", "Site Preparation",
                 3, [{"code": "GX-04", "type": "FS", "lag": 0}],
                 method=f"Groundwater at {water_table} m is above formation level ({depth} m). Install perimeter drains, sump pits at corners and submersible pumps with DG back-up; obtain discharge permission.",
                 equipment=[_equip("dewatering_pump", n_pumps)],
                 crew=[{"role": "Pump Operator / Electrician", "count": 2}, {"role": "Helpers", "count": 4}],
                 quantity=n_pumps, unit="pumps", daily_output="-")

    # ---- 3. Layer-wise excavation ----
    prev_primary: Optional[Dict[str, Any]] = None
    seq = 10
    for i, L in enumerate(exc_layers):
        cls = L["excavability_class_num"]
        bank = L["bank_volume_cum"]
        loose = L["loose_volume_cum"]
        label = f"{L['material']} ({L['exc_top_m']}-{L['exc_bottom_m']} m)"
        ucs = L.get("ucs_mpa") or 0

        preds = list(entry_preds) if prev_primary is None else []
        if prev_primary is not None:
            overlap_lag = max(1, int(math.ceil(prev_primary["duration_days"] * 0.5)))
            preds = [{"code": prev_primary["code"], "type": "SS", "lag": overlap_lag},
                     {"code": prev_primary["code"], "type": "FF", "lag": 1}]
        if wet_excavation and L["below_water_table"] and "GX-05" in plan.by_code:
            preds.append({"code": "GX-05", "type": "FS", "lag": 0})

        code = f"GX-{seq:02d}"
        seq += 1

        if cls == 1:
            if use_backhoe:
                rate, machines, key = 20.0, 1, "backhoe"
            else:
                rate, machines, key = 60.0, n_exc, "excavator_20t"
            daily = rate * machines * eff_hours
            dur = bank / daily
            act = plan.add(code, f"Excavation & loading of {label}", "Excavation", dur, preds,
                           method=f"{EXCAVABILITY_CLASSES[1]['method']}. Excavate in 1.0-1.5 m lifts, load directly into tippers; keep side slopes / benches as per shoring design.",
                           equipment=[_equip(key, machines)],
                           crew=[{"role": "Operators", "count": machines}, {"role": "Banksman / Signalman", "count": 1}, {"role": "Helpers", "count": 2 + machines}, {"role": "Supervisor", "count": 1}],
                           quantity=round(bank, 1), unit="m3 (bank)", daily_output=f"{round(daily):,} m3/day",
                           productivity_note=f"{rate:.0f} m3/hr per machine x {machines} x {eff_hours:.1f} effective hrs/day",
                           layer_index=i, excavability_class=L["excavability_class"])
            fleet_peak_loose_rate = max(fleet_peak_loose_rate, rate * machines * L["bulking_factor"])
            excavation_codes.append(code)
            prev_primary = act

        elif cls == 2:
            rate, machines = 38.0, n_exc
            daily = rate * machines * eff_hours
            act = plan.add(code, f"Hard excavation & loading of {label}", "Excavation", bank / daily, preds,
                           method=f"{EXCAVABILITY_CLASSES[2]['method']}. Very dense strata - use heavy-duty rock bucket with tiger teeth; spot-break isolated hard lumps.",
                           equipment=[_equip("excavator_rock", machines)],
                           crew=[{"role": "Operators", "count": machines}, {"role": "Banksman / Signalman", "count": 1}, {"role": "Helpers", "count": 2 + machines}, {"role": "Supervisor", "count": 1}],
                           quantity=round(bank, 1), unit="m3 (bank)", daily_output=f"{round(daily):,} m3/day",
                           productivity_note=f"{rate:.0f} m3/hr per machine x {machines} x {eff_hours:.1f} effective hrs/day",
                           layer_index=i, excavability_class=L["excavability_class"])
            fleet_peak_loose_rate = max(fleet_peak_loose_rate, rate * machines * L["bulking_factor"])
            excavation_codes.append(code)
            prev_primary = act

        elif cls == 3:
            big_area = area > 3000
            rip_key = "dozer_ripper" if big_area else "excavator_ripper"
            rip_rate = 45.0 if big_area else 22.0
            rippers = 1 if big_area else max(1, n_exc - 1) if n_exc > 2 else 1
            daily_rip = rip_rate * rippers * eff_hours
            rip = plan.add(code, f"Ripping of {label}", "Rock Excavation", bank / daily_rip, preds,
                           method=f"{EXCAVABILITY_CLASSES[3]['method']}. Rip in 0.5-0.8 m passes along joint direction; break residual core-stones with breaker.",
                           equipment=[_equip(rip_key, rippers), _equip("breaker", 1)],
                           crew=[{"role": "Operators", "count": rippers + 1}, {"role": "Helpers", "count": 3}, {"role": "Supervisor", "count": 1}],
                           quantity=round(bank, 1), unit="m3 (bank)", daily_output=f"{round(daily_rip):,} m3/day",
                           productivity_note=f"{rip_rate:.0f} m3/hr per ripper x {rippers} x {eff_hours:.1f} effective hrs/day",
                           layer_index=i, excavability_class=L["excavability_class"])
            code2 = f"GX-{seq:02d}"
            seq += 1
            muck_rate = 45.0
            daily_muck = muck_rate * n_exc * eff_hours
            plan.add(code2, f"Mucking & loading of ripped {L['material']}", "Rock Excavation", loose / daily_muck,
                     [{"code": code, "type": "SS", "lag": 1}, {"code": code, "type": "FF", "lag": 1}],
                     method="Load ripped material into tippers with GP bucket; maintain dry working platform.",
                     equipment=[_equip("excavator_20t", n_exc)],
                     crew=[{"role": "Operators", "count": n_exc}, {"role": "Helpers", "count": 2}],
                     quantity=round(loose, 1), unit="m3 (loose)", daily_output=f"{round(daily_muck):,} m3/day",
                     productivity_note=f"{muck_rate:.0f} loose m3/hr per excavator", layer_index=i,
                     excavability_class=L["excavability_class"])
            fleet_peak_loose_rate = max(fleet_peak_loose_rate, rip_rate * rippers * L["bulking_factor"])
            excavation_codes += [code, code2]
            prev_primary = rip

        else:  # Class IV / V
            if cls == 5 and blasting_ok and not near_structures:
                # Drill & controlled blast
                drill_rate = _clamp(28 - ucs * 0.07, 10, 25)  # m drilled / hr
                yield_per_m = 3.5  # bank m3 per drilled metre (shallow benches, 102 mm holes)
                daily_drill = drill_rate * yield_per_m * n_drills * eff_hours
                drill = plan.add(code, f"Drilling of blast holes in {label}", "Rock Excavation", bank / daily_drill, preds,
                                 method=f"Bench drilling, 89-115 mm holes, burden x spacing approx. 1.8 m x 2.2 m, 0.5 m sub-drill. Est. {round(bank / yield_per_m):,} m of drilling.",
                                 equipment=[_equip("drill_rig", n_drills), _equip("compressor", n_drills)],
                                 crew=[{"role": "Drill Operators", "count": n_drills}, {"role": "Drill Helpers", "count": 2 * n_drills}, {"role": "Supervisor", "count": 1}],
                                 quantity=round(bank / yield_per_m), unit="m drilled", daily_output=f"{round(drill_rate * n_drills * eff_hours):,} m/day",
                                 productivity_note=f"{drill_rate:.0f} m/hr (UCS {ucs} MPa) x {yield_per_m} m3/m yield", layer_index=i,
                                 excavability_class=L["excavability_class"])
                code2 = f"GX-{seq:02d}"
                seq += 1
                plan.add(code2, f"Controlled blasting with muffling & vibration monitoring - {L['material']}", "Rock Excavation",
                         drill["duration_days"], [{"code": code, "type": "SS", "lag": 2}, {"code": code, "type": "FF", "lag": 1}],
                         method="Daily blast rounds with delay detonators, rubber/steel-mesh muffling mats, PPV limit 5-10 mm/s at nearest structure, 500 m danger-zone clearance.",
                         equipment=[_equip("jackhammer", 2)],
                         crew=[{"role": "Licensed Blaster (Shot-firer)", "count": 1}, {"role": "Blasting Helpers", "count": 3}, {"role": "Safety Officer", "count": 1}, {"role": "Vibration Monitoring Technician", "count": 1}],
                         quantity=round(bank, 1), unit="m3 (bank)", daily_output="1 blast round/day",
                         productivity_note="Powder factor approx. 0.35-0.45 kg/m3", layer_index=i,
                         excavability_class=L["excavability_class"])
                code3 = f"GX-{seq:02d}"
                seq += 1
                muck_rate = 40.0
                daily_muck = muck_rate * n_exc * eff_hours
                plan.add(code3, f"Secondary breaking, mucking & loading of blasted {L['material']}", "Rock Excavation", loose / daily_muck,
                         [{"code": code2, "type": "SS", "lag": 1}, {"code": code2, "type": "FF", "lag": 1}],
                         method="Load blasted muck with rock buckets; break oversize boulders with hydraulic breaker.",
                         equipment=[_equip("excavator_rock", n_exc), _equip("breaker", 1)],
                         crew=[{"role": "Operators", "count": n_exc + 1}, {"role": "Helpers", "count": 3}],
                         quantity=round(loose, 1), unit="m3 (loose)", daily_output=f"{round(daily_muck):,} m3/day",
                         productivity_note=f"{muck_rate:.0f} loose m3/hr per excavator", layer_index=i,
                         excavability_class=L["excavability_class"])
                fleet_peak_loose_rate = max(fleet_peak_loose_rate, muck_rate * n_exc)
                excavation_codes += [code, code2, code3]
                prev_primary = drill
            else:
                heavy = cls == 5
                b_key = "heavy_breaker" if heavy else "breaker"
                if heavy:
                    b_rate = _clamp(10 - ucs * 0.03, 3, 6)
                else:
                    b_rate = _clamp(14 - ucs * 0.11, 4, 12)
                daily_b = b_rate * n_breakers * eff_hours
                reason = ""
                if cls == 5:
                    reason = " Blasting not permitted / structures nearby - heavy breakers with non-explosive splitting used instead."
                equip = [_equip(b_key, n_breakers)]
                if heavy:
                    equip.append(_equip("rock_splitter", 1))
                    equip.append(_equip("compressor", 1))
                brk = plan.add(code, f"Hydraulic rock breaking of {label}", "Rock Excavation", bank / daily_b, preds,
                               method=f"{EXCAVABILITY_CLASSES[4]['method']}. Break from free face in 0.5 m layers along joints; water spray for dust.{reason}",
                               equipment=equip + [_equip("water_tanker", 1)],
                               crew=[{"role": "Breaker Operators", "count": n_breakers}, {"role": "Helpers", "count": 2 + n_breakers}, {"role": "Supervisor", "count": 1}],
                               quantity=round(bank, 1), unit="m3 (bank)", daily_output=f"{round(daily_b):,} m3/day",
                               productivity_note=f"{b_rate:.1f} m3/hr per breaker (UCS {ucs} MPa, RQD {L.get('rqd_pct')}%) x {n_breakers} x {eff_hours:.1f} hrs",
                               layer_index=i, excavability_class=L["excavability_class"])
                code2 = f"GX-{seq:02d}"
                seq += 1
                muck_rate = 45.0
                muckers = max(1, int(math.ceil(n_breakers / 2)))
                daily_muck = muck_rate * muckers * eff_hours
                plan.add(code2, f"Mucking & loading of broken {L['material']}", "Rock Excavation", loose / daily_muck,
                         [{"code": code, "type": "SS", "lag": 1}, {"code": code, "type": "FF", "lag": 1}],
                         method="Collect broken rock with rock bucket and load to tippers; keep breaking face clear.",
                         equipment=[_equip("excavator_rock", muckers)],
                         crew=[{"role": "Operators", "count": muckers}, {"role": "Helpers", "count": 2}],
                         quantity=round(loose, 1), unit="m3 (loose)", daily_output=f"{round(daily_muck):,} m3/day",
                         productivity_note=f"{muck_rate:.0f} loose m3/hr per excavator", layer_index=i,
                         excavability_class=L["excavability_class"])
                fleet_peak_loose_rate = max(fleet_peak_loose_rate, b_rate * n_breakers * L["bulking_factor"])
                excavation_codes += [code, code2]
                prev_primary = brk

    exc_start, exc_end = plan.window(excavation_codes)
    last_exc_code = max(excavation_codes, key=lambda c: plan.by_code[c]["ef"])
    first_exc_code = min(excavation_codes, key=lambda c: plan.by_code[c]["es"])

    # ---- 4. Haulage (spans the whole excavation) ----
    tipper_cap = 12.0
    load_min = tipper_cap / max(1.0, fleet_peak_loose_rate / max(1, n_exc)) * 60
    cycle_min = load_min + (2 * lead_km / 20.0) * 60 + 6
    trips_per_hr = 60 / cycle_min
    n_tippers = _ceil(fleet_peak_loose_rate / (tipper_cap * trips_per_hr)) + 1
    total_trips = _ceil(total_loose / tipper_cap)
    haul_dur = exc_end - exc_start
    plan.add(f"GX-{seq:02d}", f"Haulage & disposal of excavated material to dump yard (lead {lead_km} km)", "Haulage",
             haul_dur, [{"code": first_exc_code, "type": "SS", "lag": 0}, {"code": last_exc_code, "type": "FF", "lag": 0}],
             method=f"{n_tippers} tippers (incl. 1 standby) on {cycle_min:.0f}-min cycle. Cover loads, wheel-wash at exit, spread & level at dump yard.",
             equipment=[_equip("tipper", n_tippers), _equip("water_tanker", 1)],
             crew=[{"role": "Tipper Drivers", "count": n_tippers}, {"role": "Traffic Marshal / Spotter", "count": 2}],
             quantity=round(total_loose, 1), unit="m3 (loose)", daily_output=f"{round(total_loose / max(1, haul_dur)):,} m3/day ({_ceil(total_trips / max(1, haul_dur))} trips/day)",
             productivity_note=f"{trips_per_hr:.1f} trips/hr per tipper, {total_trips:,} trips total")
    seq += 1

    # ---- 5. Shoring / slope & rock-face protection ----
    soil_layers = [l for l in exc_layers if not l["is_rock"]]
    soil_depth = sum(l["exc_thickness_m"] for l in soil_layers)
    soil_codes = [c for c in excavation_codes if not exc_layers[plan.by_code[c]["layer_index"]]["is_rock"]] if soil_layers else []
    if depth > 1.5 and soil_codes:
        s_start_code = soil_codes[0]
        s_end_code = max(soil_codes, key=lambda c: plan.by_code[c]["ef"])
        s_es, s_ef = plan.window(soil_codes)
        loose_soils = any(l["material_key"] in ("sand", "gravel", "fill", "silt") for l in soil_layers)
        if soil_depth > 3.0 or near_structures or (wet_excavation and loose_soils):
            shoring = "Soldier piles with timber/steel lagging or sheet piling along boundary; struts / anchors as per temporary works design"
        else:
            shoring = "Open cut with 1:1 (H:V) side slopes / 1.5 m benches; polythene sheet cover to protect slopes from rain"
        plan.add(f"GX-{seq:02d}", f"Side-slope benching / shoring of soil zone (0-{round(soil_depth, 1)} m)", "Temporary Works",
                 max(1, s_ef - s_es), [{"code": s_start_code, "type": "SS", "lag": 1}, {"code": s_end_code, "type": "FF", "lag": 1}],
                 method=shoring + ". Daily inspection of slopes by competent person; no surcharge within 1.5 m of edge.",
                 equipment=[_equip("backhoe", 1)],
                 crew=[{"role": "Carpenters / Fitters", "count": 4}, {"role": "Helpers", "count": 6}, {"role": "Supervisor", "count": 1}],
                 quantity=round(perimeter * soil_depth, 0), unit="m2 face", daily_output=f"{round(perimeter * soil_depth / max(1, s_ef - s_es)):,} m2/day")
        seq += 1

    weak_rock = [l for l in exc_layers if l["is_rock"] and (l.get("rqd_pct") or 100) < 50]
    if weak_rock:
        face_area = perimeter * sum(l["exc_thickness_m"] for l in weak_rock)
        days = face_area / 40.0
        rock_codes = [c for c in excavation_codes if exc_layers[plan.by_code[c]["layer_index"]] in weak_rock]
        plan.add(f"GX-{seq:02d}", "Rock-face stabilisation - scaling, rock bolts & wire mesh / shotcrete for fractured rock", "Temporary Works",
                 days, [{"code": rock_codes[0], "type": "SS", "lag": 2}, {"code": max(rock_codes, key=lambda c: plan.by_code[c]['ef']), "type": "FF", "lag": 1}],
                 method="Scale loose blocks after each lift; install 25 mm dia. rock bolts 3 m long @ 2 m c/c with chain-link mesh where RQD < 50%.",
                 equipment=[_equip("jackhammer", 2), _equip("compressor", 1)],
                 crew=[{"role": "Rock-bolting crew", "count": 4}, {"role": "Helpers", "count": 4}],
                 quantity=round(face_area, 0), unit="m2 face", daily_output="40 m2/day")
        seq += 1

    # ---- 6. Dewatering operation ----
    if wet_excavation and "GX-05" in plan.by_code:
        wet_codes = [c for c in excavation_codes if exc_layers[plan.by_code[c]["layer_index"]]["below_water_table"]]
        if wet_codes:
            w_es, _ = plan.window(wet_codes)
            plan.add(f"GX-{seq:02d}", "Continuous dewatering operation (24 x 7) until foundation casting", "Dewatering",
                     max(1, exc_end - w_es + 3), [{"code": wet_codes[0], "type": "SS", "lag": 0}, {"code": "GX-05", "type": "FS", "lag": 0}],
                     method="Run pumps round the clock, maintain water 0.5 m below formation, monitor discharge turbidity and adjacent ground settlement.",
                     equipment=[_equip("dewatering_pump", _ceil(area / 600) + 1)],
                     crew=[{"role": "Pump Operators (per shift)", "count": 2}],
                     quantity=round(max(1, exc_end - w_es + 3)), unit="days", daily_output="24 hr pumping")
            seq += 1

    # ---- 7. Founding level ----
    founding = exc_layers[-1] if exc_layers else None
    founding_is_rock = bool(founding and founding["is_rock"])
    trim_rate = 120.0 if founding_is_rock else 250.0
    trim_code = f"GX-{seq:02d}"
    plan.add(trim_code, f"Final trimming, dressing & level check of founding strata ({founding['material'] if founding else 'formation'})", "Founding Level",
             area / trim_rate, [{"code": last_exc_code, "type": "FS", "lag": 0}],
             method=("Line-drill / jack-hammer trim of rock to +/-50 mm, remove loose pieces, clean with air jet." if founding_is_rock
                     else "Hand-trim last 150 mm, remove soft pockets and replace with lean concrete, compact formation with plate compactor."),
             equipment=[_equip("jackhammer", 3), _equip("compressor", 1)] if founding_is_rock else [_equip("backhoe", 1), _equip("plate_compactor", 2)],
             crew=[{"role": "Skilled Workers", "count": 4}, {"role": "Helpers", "count": 8}, {"role": "Surveyor", "count": 1}],
             quantity=round(area, 0), unit="m2", daily_output=f"{trim_rate:.0f} m2/day")
    seq += 1

    insp_code = f"GX-{seq:02d}"
    plan.add(insp_code, "Founding-strata inspection & SBC confirmation by Geotechnical Engineer (plate load test if required)", "Founding Level",
             2, [{"code": trim_code, "type": "FS", "lag": 0}],
             method="Joint inspection with consultant; verify strata matches design assumption, conduct plate load test (IS:1888) on doubtful patches, record level sheet.",
             equipment=[],
             crew=[{"role": "Geotechnical Engineer", "count": 1}, {"role": "Structural Consultant", "count": 1}, {"role": "QA/QC Engineer", "count": 1}],
             quantity=1, unit="LS", daily_output="-")
    seq += 1

    hand_code = f"GX-{seq:02d}"
    plan.add(hand_code, "Hand-over of excavated pit for PCC / foundation works (milestone)", "Founding Level",
             1, [{"code": insp_code, "type": "FS", "lag": 0}],
             method="Sign-off of excavation checklist and level records; release for PCC, waterproofing and foundation.",
             equipment=[], crew=[{"role": "Project Manager", "count": 1}, {"role": "Site Engineer", "count": 1}],
             quantity=1, unit="milestone", daily_output="-")
    seq += 1

    plan.add(f"GX-{seq:02d}", "Demobilisation of excavation fleet, drill rigs & breakers", "Close-out",
             2, [{"code": trim_code, "type": "FS", "lag": 0}],
             method="Release machinery progressively; retain one backhoe and dewatering pumps for foundation stage.",
             equipment=[], crew=[{"role": "Helpers", "count": 4}],
             quantity=1, unit="LS", daily_output="-")

    total_days = plan.finalize()

    # ---- calendar dates & finishing touches ----
    for a in plan.acts:
        a["start_day"] = a["es"] + 1
        a["end_day"] = a["ef"]
        a["start_date"] = _working_day_to_date(start, a["es"], dpw).isoformat()
        a["end_date"] = _working_day_to_date(start, a["ef"] - 1, dpw).isoformat()
        a["machine_hours"] = round(sum(e["count"] for e in a.get("equipment", [])) * a["duration_days"] * gross_hours, 0)
        a["labour_count"] = sum(c["count"] for c in a.get("crew", []))
        a["man_days"] = a["labour_count"] * a["duration_days"] * shifts
        # Fill tipper count placeholder rows
        for e in a.get("equipment", []):
            if e["key"] == "tipper" and e["count"] == 0:
                e["count"] = n_tippers
    finish_date = _working_day_to_date(start, total_days - 1, dpw)

    # ---- fleet summary ----
    fleet: Dict[str, Dict[str, Any]] = {}
    for a in plan.acts:
        for e in a.get("equipment", []):
            if e["count"] <= 0:
                continue
            f = fleet.setdefault(e["key"], {**EQUIPMENT_CATALOG[e["key"]], "key": e["key"], "count": 0,
                                            "first_day": a["start_day"], "last_day": a["end_day"],
                                            "machine_hours": 0.0, "activities": []})
            f["count"] = max(f["count"], e["count"])
            f["first_day"] = min(f["first_day"], a["start_day"])
            f["last_day"] = max(f["last_day"], a["end_day"])
            f["machine_hours"] += e["count"] * a["duration_days"] * gross_hours
            f["activities"].append(a["code"])
    fleet_list = []
    for f in fleet.values():
        f["deployment_days"] = f["last_day"] - f["first_day"] + 1
        f["machine_hours"] = round(f["machine_hours"])
        # justification text
        f["why"] = _machine_justification(f["key"], exc_layers, params, water_table)
        fleet_list.append(f)
    priority = ["drill_rig", "compressor", "heavy_breaker", "breaker", "rock_splitter", "excavator_ripper", "dozer_ripper",
                "excavator_rock", "excavator_20t", "backhoe", "tipper", "jackhammer", "dewatering_pump", "plate_compactor", "water_tanker"]
    fleet_list.sort(key=lambda f: priority.index(f["key"]) if f["key"] in priority else 99)

    # ---- rock types summary (unique material types) ----
    rock_types: Dict[str, Dict[str, Any]] = {}
    for l in exc_layers:
        r = rock_types.setdefault(l["material_key"], {
            "material": l["material"], "category": l["category"], "color": l["color"], "description": l["description"],
            "depth_ranges": [], "total_thickness_m": 0.0, "bank_volume_cum": 0.0,
            "ucs_mpa": l.get("ucs_mpa"), "rqd_pct": l.get("rqd_pct"), "weathering_grade": l.get("weathering_grade"),
            "excavability_class": l["excavability_class"], "excavability_class_num": l["excavability_class_num"],
            "excavation_method": l["excavation_method"],
        })
        r["depth_ranges"].append(f"{l['exc_top_m']}-{l['exc_bottom_m']} m")
        r["total_thickness_m"] = round(r["total_thickness_m"] + l["exc_thickness_m"], 2)
        r["bank_volume_cum"] = round(r["bank_volume_cum"] + l["bank_volume_cum"], 1)
        if l["excavability_class_num"] > r["excavability_class_num"]:
            r.update({"excavability_class": l["excavability_class"], "excavability_class_num": l["excavability_class_num"],
                      "excavation_method": l["excavation_method"]})
    rock_type_list = sorted(rock_types.values(), key=lambda r: -r["excavability_class_num"])
    for r in rock_type_list:
        r["share_pct"] = round(100 * r["bank_volume_cum"] / max(1.0, total_bank), 1)

    # Governing rock
    rock_layers = [l for l in exc_layers if l["is_rock"]]
    if rock_layers:
        gov = max(rock_layers, key=lambda l: (l["excavability_class_num"], l["bank_volume_cum"]))
        rmr, rmr_label = estimate_rmr(gov.get("ucs_mpa") or 50, gov.get("rqd_pct") or 50, gov.get("weathering_grade"), gov["below_water_table"])
    else:
        gov = max(exc_layers, key=lambda l: (l["excavability_class_num"], l["bank_volume_cum"])) if exc_layers else None
        rmr, rmr_label = None, "Not applicable (no rock within excavation depth)"

    hazards = _hazard_controls(exc_layers, params, water_table, any_blasting, depth)

    critical = [a["code"] for a in plan.acts if a.get("is_critical")]
    phases: Dict[str, Dict[str, Any]] = {}
    for a in plan.acts:
        p = phases.setdefault(a["phase"], {"phase": a["phase"], "start_day": a["start_day"], "end_day": a["end_day"], "activities": 0})
        p["start_day"] = min(p["start_day"], a["start_day"])
        p["end_day"] = max(p["end_day"], a["end_day"])
        p["activities"] += 1

    summary = {
        "total_working_days": total_days,
        "calendar_days": (finish_date - start).days + 1,
        "start_date": start.isoformat(),
        "finish_date": finish_date.isoformat(),
        "excavation_window_days": exc_end - exc_start,
        "total_bank_volume_cum": round(total_bank, 1),
        "rock_bank_volume_cum": round(rock_bank, 1),
        "soil_bank_volume_cum": round(soil_bank, 1),
        "total_loose_volume_cum": round(total_loose, 1),
        "rock_share_pct": round(100 * rock_bank / max(1.0, total_bank), 1),
        "tipper_trips": total_trips,
        "governing_class": EXCAVABILITY_CLASSES[governing_class]["label"],
        "governing_class_num": governing_class,
        "governing_material": gov["material"] if gov else None,
        "blasting_required": any_blasting,
        "dewatering_required": wet_excavation,
        "rmr": rmr,
        "rmr_class": rmr_label,
        "critical_path": critical,
        "phases": list(phases.values()),
        "total_machine_hours": round(sum(f["machine_hours"] for f in fleet_list)),
        "total_man_days": int(sum(a["man_days"] for a in plan.acts)),
        "peak_fleet_size": sum(f["count"] for f in fleet_list if f["key"] not in ("jackhammer", "dewatering_pump", "plate_compactor")),
        "assumptions": [
            f"Working hours: {hours_shift:g} h x {shifts} shift(s)/day, {dpw} days/week; job efficiency {int(JOB_EFFICIENCY * 100)}% -> {eff_hours:.1f} productive h/day.",
            f"Excavation plan area {area:,.0f} m2 to {depth} m depth; +10% volume allowance for working space/side slopes in soil, +5% over-break in rock.",
            f"Fleet sized for {n_exc} excavator working face(s) to avoid congestion; haul lead {lead_km} km at 20 km/h average.",
            "Productivity norms are typical Indian site norms for planning - calibrate with actual fleet output after first week.",
            "Blasting " + ("permitted (subject to PESO/DGMS licence)." if any_blasting else "not used (not permitted, structures nearby, or no Class V rock)."),
        ],
    }

    return {
        "strata_layers": exc_layers,
        "rock_types": rock_type_list,
        "machinery": fleet_list,
        "activities": plan.acts,
        "hazards": hazards,
        "summary": summary,
        "governing": gov,
    }


def _machine_justification(key: str, layers: List[Dict[str, Any]], params: Dict[str, Any], wt: Optional[float]) -> str:
    def names(cls_set):
        return ", ".join(sorted({l["material"] for l in layers if l["excavability_class_num"] in cls_set})) or "-"
    return {
        "backhoe": "Small volume / confined area - versatile JCB backhoe for digging, trimming, loading and site clearance.",
        "excavator_20t": f"Bulk excavation & mucking of {names({1, 3, 4})}.",
        "excavator_rock": f"Hard digging / rock mucking in {names({2, 4, 5})} - rock bucket resists abrasion and impact.",
        "excavator_ripper": f"Rippable soft rock: {names({3})} (UCS < 25 MPa or highly fractured).",
        "dozer_ripper": f"Large open area with rippable rock: {names({3})}.",
        "breaker": f"Medium-strong / jointed rock and boulders: {names({3, 4, 5})}.",
        "heavy_breaker": f"Strong massive rock {names({5})} where blasting is not permitted.",
        "drill_rig": f"Strong massive rock {names({5})} - UCS > 70 MPa with RQD > 50% needs drilling & controlled blasting.",
        "compressor": "Compressed-air supply for DTH drilling, jack hammers and rock-face cleaning.",
        "jackhammer": "Secondary breaking, trimming to founding level, rock-bolt drilling.",
        "rock_splitter": "Vibration-free rock breaking adjacent to existing structures.",
        "tipper": "Muck haulage - fleet matched to peak excavator output and haul lead.",
        "dewatering_pump": f"Groundwater at {wt} m is above formation level - keep excavation dry.",
        "water_tanker": "Dust suppression on haul roads and breaking/drilling faces.",
        "plate_compactor": "Compaction of soil founding level before PCC.",
    }.get(key, "")


def _hazard_controls(layers: List[Dict[str, Any]], params: Dict[str, Any], wt: Optional[float], blasting: bool, depth: float) -> List[Dict[str, str]]:
    h: List[Dict[str, str]] = []
    keys = {l["material_key"] for l in layers}
    if depth > 1.5:
        h.append({"hazard": "Excavation collapse / side-wall failure", "severity": "HIGH",
                  "control": "Slope or shore all faces > 1.5 m (IS 3764), keep spoil & machines 1.5 m from edge, daily competent-person inspection, edge barricade with hard barrier."})
    if blasting:
        h.append({"hazard": "Fly-rock, ground vibration & air over-pressure from blasting", "severity": "CRITICAL",
                  "control": "Licensed shot-firer, muffling mats, PPV monitoring (limit 5-10 mm/s), siren & 500 m evacuation, blast only in fixed time window, misfire procedure."})
    if any(l["excavability_class_num"] >= 4 for l in layers):
        h.append({"hazard": "Silica dust, noise and flying chips during rock breaking/drilling", "severity": "HIGH",
                  "control": "Water spray / wet drilling, N95 masks, ear defenders, exclusion zone of 20 m around breaker, face shields."})
    if wt is not None and wt < depth:
        h.append({"hazard": f"Groundwater ingress (GWT {wt} m) - base heave, piping, flooding", "severity": "HIGH",
                  "control": "Continuous dewatering with 50% standby & DG backup, piezometers, monitor settlement of adjacent structures."})
    if keys & {"black_cotton", "clay"}:
        h.append({"hazard": "Sticky / expansive clay - machine bogging, slope swelling", "severity": "MEDIUM",
                  "control": "Avoid working in rain, provide murrum-stabilised haul road, cover exposed slopes, do not leave formation open - cast PCC promptly."})
    if keys & {"sand", "gravel", "fill"}:
        h.append({"hazard": "Ravelling of loose granular soil / fill", "severity": "HIGH",
                  "control": "Flatter slopes (1.5H:1V) or continuous shoring, avoid vibration close to edge."})
    if any(l["is_rock"] and (l.get("rqd_pct") or 100) < 50 for l in layers):
        h.append({"hazard": "Rock-fall from fractured rock faces (RQD < 50%)", "severity": "HIGH",
                  "control": "Scale after each lift, rock bolts + wire mesh, no workers below unscaled face."})
    if "boulders" in keys:
        h.append({"hazard": "Sudden dislodging of boulders", "severity": "MEDIUM",
                  "control": "Break boulders before undercutting, keep workers clear of bucket swing radius."})
    if params.get("near_existing_structures"):
        h.append({"hazard": "Damage to adjacent structures", "severity": "HIGH",
                  "control": "Pre-condition survey, crack-monitoring tell-tales, vibration limit, non-explosive methods near boundary."})
    h.append({"hazard": "Machine-person interaction & tipper movement", "severity": "MEDIUM",
              "control": "Banksman for every machine, one-way haul road, reversing alarms, high-visibility vests, separate pedestrian access ladder/ramp."})
    return h


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def guess_report_title(raw_text: str, filename: Optional[str]) -> str:
    for line in (raw_text or "").splitlines()[:40]:
        s = line.strip()
        if 12 < len(s) < 140 and re.search(r"report|investigation|borelog|bore\s*log|geotech", s, re.IGNORECASE):
            return s
    return filename or "Geotechnical Subsurface Investigation Report"


def analyze_geotechnical_report(raw_text: str, params: Dict[str, Any]) -> Dict[str, Any]:
    depth = float(params.get("target_depth_m") or 6.0)
    parsed = parse_geotechnical_text(raw_text, depth)
    plan = build_excavation_plan(parsed, params)
    return {"parsed": parsed, **plan}
