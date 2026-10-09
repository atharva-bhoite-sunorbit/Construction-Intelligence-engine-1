"""
Source-grounded field primitives.

Every extracted / derived parameter is represented as a *Field* dict:

{
    "value":          <python value or None>,
    "display":        <human readable string>,
    "unit":           <unit string or None>,
    "status":         "FOUND" | "MISSING" | "REQUIRES_DATA",
    "source_type":    REPORT | CALCULATED | AI_INTERPRETATION | AI_RECOMMENDATION | USER_ENTERED | REQUIRES_DATA | None,
    "source_page":    <1-based page or None>,
    "source_section": <section heading or None>,
    "source_text":    <verbatim (normalised) text from the document or None>,
    "confidence":     "HIGH" | "MEDIUM" | "LOW" | None,
    "method":         <extraction method>,
    "note":           <optional explanation>,
    ... optional: "formula", "inputs", "original"
}
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

NOT_IN_REPORT = "Not specified in report"
REQUIRES_PROJECT_DATA = "Requires additional project data"

SOURCE_TYPES = (
    "REPORT",
    "CALCULATED",
    "AI_INTERPRETATION",
    "AI_RECOMMENDATION",
    "USER_ENTERED",
    "REQUIRES_DATA",
)


def _fmt_num(v: float) -> str:
    if v is None:
        return ""
    if abs(v - round(v)) < 1e-9:
        return f"{int(round(v)):,}" if abs(v) >= 10000 else str(int(round(v)))
    return f"{v:.2f}".rstrip("0").rstrip(".") if abs(v) < 1000 else f"{v:,.2f}"


def fmt_value(value: Any, unit: Optional[str] = None) -> str:
    if value is None:
        return NOT_IN_REPORT
    if isinstance(value, dict) and "min" in value and "max" in value:
        lo, hi = value.get("min"), value.get("max")
        qual = value.get("qualifier")
        if lo is not None and hi is not None and abs(lo - hi) > 1e-9:
            s = f"{_fmt_num(lo)}–{_fmt_num(hi)}"
        else:
            s = _fmt_num(lo if lo is not None else hi)
        if qual:
            s = f"{qual} {s}"
        return f"{s} {unit}".strip() if unit else s
    if isinstance(value, float) or isinstance(value, int):
        if isinstance(value, bool):
            return "Yes" if value else "No"
        return f"{_fmt_num(float(value))} {unit}".strip() if unit else _fmt_num(float(value))
    if isinstance(value, list):
        return ", ".join(str(x) for x in value) if value else NOT_IN_REPORT
    return f"{value} {unit}".strip() if unit and not str(value).endswith(unit) else str(value)


def report_field(
    value: Any,
    *,
    page: Optional[int],
    text: Optional[str],
    section: Optional[str] = None,
    unit: Optional[str] = None,
    confidence: str = "HIGH",
    method: str = "RULE_REGEX",
    note: Optional[str] = None,
    display: Optional[str] = None,
    **extra: Any,
) -> Dict[str, Any]:
    """A value taken directly from the uploaded document."""
    if value is None:
        return missing(note=note)
    f = {
        "value": value,
        "display": display or fmt_value(value, unit),
        "unit": unit,
        "status": "FOUND",
        "source_type": "REPORT",
        "source_page": page,
        "source_section": section,
        "source_text": (text or "").strip()[:600] or None,
        "confidence": confidence,
        "method": method,
        "note": note,
    }
    f.update(extra)
    return f


def calculated_field(
    value: Any,
    *,
    formula: str,
    inputs: Optional[List[Dict[str, Any]]] = None,
    unit: Optional[str] = None,
    page: Optional[int] = None,
    section: Optional[str] = None,
    note: Optional[str] = None,
    display: Optional[str] = None,
    confidence: str = "HIGH",
    **extra: Any,
) -> Dict[str, Any]:
    """A value computed by the system from REPORT (or USER_ENTERED) inputs only."""
    if value is None:
        return requires_data(note or "Inputs for this calculation are not available in the report.")
    f = {
        "value": value,
        "display": display or fmt_value(value, unit),
        "unit": unit,
        "status": "FOUND",
        "source_type": "CALCULATED",
        "source_page": page,
        "source_section": section,
        "source_text": None,
        "confidence": confidence,
        "method": "SYSTEM_CALCULATION",
        "formula": formula,
        "inputs": inputs or [],
        "note": note,
    }
    f.update(extra)
    return f


def ai_field(
    value: Any,
    *,
    kind: str = "AI_INTERPRETATION",
    reason: str,
    basis: Optional[List[str]] = None,
    unit: Optional[str] = None,
    display: Optional[str] = None,
    confidence: str = "MEDIUM",
) -> Dict[str, Any]:
    """AI interpretation / recommendation. NEVER presented as a consultant value."""
    assert kind in ("AI_INTERPRETATION", "AI_RECOMMENDATION")
    return {
        "value": value,
        "display": display or fmt_value(value, unit),
        "unit": unit,
        "status": "FOUND",
        "source_type": kind,
        "source_page": None,
        "source_section": None,
        "source_text": None,
        "confidence": confidence,
        "method": "RULE_ENGINE",
        "note": reason,
        "basis": basis or [],
    }


def user_field(value: Any, *, unit: Optional[str] = None, note: Optional[str] = None) -> Dict[str, Any]:
    return {
        "value": value,
        "display": fmt_value(value, unit),
        "unit": unit,
        "status": "FOUND",
        "source_type": "USER_ENTERED",
        "source_page": None,
        "source_section": None,
        "source_text": None,
        "confidence": None,
        "method": "USER_INPUT",
        "note": note,
    }


def missing(note: Optional[str] = None, display: str = NOT_IN_REPORT) -> Dict[str, Any]:
    return {
        "value": None,
        "display": display,
        "unit": None,
        "status": "MISSING",
        "source_type": None,
        "source_page": None,
        "source_section": None,
        "source_text": None,
        "confidence": None,
        "method": "NOT_FOUND",
        "note": note,
    }


def requires_data(note: Optional[str] = None, action: Optional[str] = None) -> Dict[str, Any]:
    return {
        "value": None,
        "display": REQUIRES_PROJECT_DATA,
        "unit": None,
        "status": "REQUIRES_DATA",
        "source_type": "REQUIRES_DATA",
        "source_page": None,
        "source_section": None,
        "source_text": None,
        "confidence": None,
        "method": "NOT_COMPUTABLE",
        "note": note,
        "action": action,
    }


def is_found(f: Any) -> bool:
    if f is None:
        return False
    if isinstance(f, dict):
        return f.get("status") == "FOUND" and f.get("value") is not None
    return bool(f)


def val(f: Any) -> Any:
    if f is None:
        return None
    if isinstance(f, dict):
        return f.get("value") if is_found(f) else None
    return f


def rng(lo: Optional[float], hi: Optional[float] = None, qualifier: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Range value container – preserves report ranges, never collapses to a single number."""
    if lo is None and hi is None:
        return None
    if hi is None:
        hi = lo
    if lo is None:
        lo = hi
    if lo > hi:
        lo, hi = hi, lo
    r: Dict[str, Any] = {"min": lo, "max": hi}
    if qualifier:
        r["qualifier"] = qualifier
    return r


def range_min(v: Any) -> Optional[float]:
    if isinstance(v, dict):
        return v.get("min")
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return float(v)
    return None


def range_max(v: Any) -> Optional[float]:
    if isinstance(v, dict):
        return v.get("max")
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return float(v)
    return None
