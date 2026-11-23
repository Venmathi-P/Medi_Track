"""Rule-based reader for text-based prescription PDFs (no AI, no OCR).

Pipeline: PDF text (pypdf) -> find dosage tokens like "500 mg" -> the words before it are the
medicine name -> the text up to the next medicine is searched for frequency, duration and
instructions. Everything is a suggestion: the user reviews and edits it before anything is saved.
"""
import re
from datetime import date, timedelta
from math import ceil

MAX_PAGES = 10
MAX_CANDIDATES = 30

UNIT_MAP = {"mg": "mg", "mcg": "mcg", "µg": "mcg", "ug": "mcg", "g": "g", "ml": "ml",
            "iu": "IU", "unit": "units", "units": "units"}
DOSE_RE = re.compile(r"(?<![\w.])(\d+(?:\.\d+)?)\s?(mg|mcg|µg|ug|g|ml|iu|units?)\b", re.I)

HEADERS = {"rx", "medicine", "medicines", "medicine name", "drug", "drugs", "dosage", "dose", "frequency",
           "duration", "instructions", "instruction", "remarks", "sr", "no", "sno", "s.no", "name", "qty"}
STOP_RE = re.compile(r"^\s*(advice|review|follow[\s-]?up|next visit|notes?\b|dr\b|dr\.|signature|sample|"
                     r"diet|investigations?|regd|reg\.|date\b)", re.I)

FORM_WORDS = r"(?:tab(?:let)?s?|cap(?:sule)?s?|syp|syrup|inj(?:ection)?|oint(?:ment)?|cream|drops?|gel|susp(?:ension)?|sachet)"
LEADING_NUM_RE = re.compile(r"^\(?\d{1,2}\s*[.)\]:\-]?\s+")
LEADING_FORM_RE = re.compile(rf"^(?:{FORM_WORDS}\b\.?\s*)+", re.I)
TRAILING_FORM_RE = re.compile(rf"[\s,.\-]*\b{FORM_WORDS}\b\.?$", re.I)

# ---- frequency ----
DASH_RE = re.compile(r"(?<![\d-])([0-3])\s*-\s*([0-3])\s*-\s*([0-3])(?:\s*-\s*([0-3]))?(?![\d-])")
WEEKLY_RE = re.compile(r"\b(once\s+(?:a\s+|per\s+|every\s+)?week(?:ly)?|weekly|every\s+week|1\s*/\s*week|per\s+week)\b", re.I)
HOURS_RE = re.compile(r"\b(?:every|q)\s*(\d{1,2})\s*(?:hours?|hrs?|h)\b", re.I)
FREQ_WORDS = [  # checked in order
    (4, re.compile(r"\b(qid|qds|q\.i\.d\.?|four\s+times(?:\s+(?:a|per))?\s*(?:day|daily)?|4\s*(?:times|x)\s*(?:a|per)?\s*(?:day|daily))\b", re.I)),
    (3, re.compile(r"\b(tds|tid|t\.i\.d\.?|thrice|three\s+times(?:\s+(?:a|per))?\s*(?:day|daily)?|3\s*(?:times|x)\s*(?:a|per)?\s*(?:day|daily))\b", re.I)),
    (2, re.compile(r"\b(bd|bid|bds|b\.i\.d\.?|twice|two\s+times(?:\s+(?:a|per))?\s*(?:day|daily)?|2\s*(?:times|x)\s*(?:a|per)?\s*(?:day|daily))\b", re.I)),
    (1, re.compile(r"\b(od|qd|once(?:\s+(?:a|per))?\s*(?:day|daily)?|one\s+time(?:\s+(?:a|per))?\s*(?:day|daily)?)\b", re.I)),
]
BARE_DAILY_RE = re.compile(r"\b(daily|every\s+day|each\s+day|everyday|per\s+day|a\s+day)\b", re.I)
NIGHT_RE = re.compile(r"\b(night|bedtime|hs|nocte|at\s+bed)\b", re.I)
PRN_RE = re.compile(r"\b(sos|prn|as\s+needed|if\s+needed|when\s+required|as\s+required|when\s+needed)\b", re.I)

LABELS = {1: "Once daily", 2: "Twice daily", 3: "Three times daily", 4: "Four times daily"}
DEFAULT_TIMES = {1: ["08:00"], 2: ["08:00", "20:00"], 3: ["08:00", "14:00", "20:00"], 4: ["06:00", "12:00", "18:00", "22:00"]}
DASH3_TIMES = ["08:00", "14:00", "20:00"]
DASH4_TIMES = ["06:00", "12:00", "18:00", "22:00"]

DUR_RE = re.compile(r"(?<![\w.])(\d{1,3})\s*-?\s*(days?|weeks?|wks?|months?)\b", re.I)
INSTR_RE = re.compile(
    r"\b(after\s+(?:food|meals?|breakfast|lunch|dinner)|before\s+(?:food|meals?|breakfast|lunch|dinner)|"
    r"with\s+(?:food|milk|water|meals?)|empty\s+stomach|at\s+(?:night|bedtime)|"
    r"if\s+(?:fever|pain|needed|required))\b"
    r"|\b(may\s+cause\s+[a-z ]{3,25}?)(?=[,.;)\n]|$)", re.I)


def extract_pdf_text(data: bytes) -> str:
    from io import BytesIO

    from pypdf import PdfReader

    reader = PdfReader(BytesIO(data))
    if reader.is_encrypted and int(reader.decrypt("")) == 0:
        raise ValueError("encrypted PDF")
    return "\n".join((page.extract_text() or "") for page in reader.pages[:MAX_PAGES])


def clean_name(s: str, *, from_previous_line: bool = False) -> str:
    s = s.strip(" \t-–—:;,|•*")
    s = LEADING_NUM_RE.sub("", s)
    s = LEADING_FORM_RE.sub("", s)
    s = TRAILING_FORM_RE.sub("", s)
    s = s.strip(" \t-–—:;,|•*()")
    if not re.search(r"[A-Za-z]{2}", s) or len(s) > 60 or len(s.split()) > 6:
        return ""
    if s.lower().rstrip(".") in HEADERS:
        return ""
    if from_previous_line and (":" in s or STOP_RE.match(s)):
        return ""
    return s.title() if s.isupper() else s


def _times_for(n: int, night: bool = False) -> list[str]:
    if n == 1 and night:
        return ["21:00"]
    if n in DEFAULT_TIMES:
        return DEFAULT_TIMES[n]
    n = min(n, 6)
    return [f"{(360 + round(i * 960 / (n - 1))) // 60:02d}:{(360 + round(i * 960 / (n - 1))) % 60:02d}" for i in range(n)]


def parse_frequency(ctx: str) -> dict:
    """Return {kind: daily|weekly|prn|unknown, per_day, units_per_day, times, label, warnings}."""
    out = {"kind": "unknown", "per_day": 0, "units_per_day": 0, "times": [], "label": "", "warnings": [], "note": None}
    if WEEKLY_RE.search(ctx):
        out.update(kind="weekly", label="Once weekly",
                   note="Weekly medicine: reminders repeat daily, so none is created for it.")
        return out
    m = DASH_RE.search(ctx)
    if m:
        digits = [int(g) for g in m.groups() if g is not None]
        slots = DASH4_TIMES if len(digits) == 4 else DASH3_TIMES
        times = [slots[i] for i, d in enumerate(digits) if d > 0]
        if times:
            n = len(times)
            out.update(kind="daily", per_day=n, units_per_day=sum(digits), times=times,
                       label=f"{LABELS.get(n, f'{n} times daily')} ({m.group(0).replace(' ', '')})")
            if any(d > 1 for d in digits):
                out["warnings"].append("More than one tablet per dose: stock forecasts assume one per dose.")
            return out
    m = HOURS_RE.search(ctx)
    if m and 1 <= int(m.group(1)) <= 24:
        h = int(m.group(1))
        n = max(1, round(24 / h))
        out.update(kind="daily", per_day=n, units_per_day=n, times=_times_for(n), label=f"Every {h} hours")
        if n > 4:
            out["warnings"].append("Many doses per day: check the reminder times.")
        return out
    for n, rx in FREQ_WORDS:
        if rx.search(ctx):
            night = n == 1 and bool(NIGHT_RE.search(ctx))
            out.update(kind="daily", per_day=n, units_per_day=n, times=_times_for(n, night),
                       label=LABELS[n] + (" (night)" if night else ""))
            return out
    if BARE_DAILY_RE.search(ctx):
        night = bool(NIGHT_RE.search(ctx))
        out.update(kind="daily", per_day=1, units_per_day=1, times=_times_for(1, night),
                   label="Once daily" + (" (night)" if night else ""))
        return out
    if NIGHT_RE.search(ctx):
        out.update(kind="daily", per_day=1, units_per_day=1, times=["21:00"], label="Once daily (night)")
        return out
    if PRN_RE.search(ctx):
        out.update(kind="prn", label="As needed", note="As needed: no daily reminder is created for it.")
        return out
    out["warnings"].append("Frequency not found: please fill it in.")
    return out


def parse_duration_days(ctx: str) -> int | None:
    m = DUR_RE.search(ctx)
    if not m:
        return None
    n, unit = int(m.group(1)), m.group(2).lower()
    return n * (7 if unit.startswith(("week", "wk")) else 30 if unit.startswith("month") else 1)


def parse_instructions(ctx: str) -> str | None:
    seen, parts = set(), []
    for m in INSTR_RE.finditer(ctx):
        phrase = re.sub(r"\s+", " ", m.group(1) or m.group(2)).strip().lower()
        if phrase not in seen:
            seen.add(phrase)
            parts.append(phrase)
    return (", ".join(parts)).capitalize() if parts else None


def parse_prescription_text(text: str, today: date) -> list[dict]:
    lines = [re.sub(r"[ \t]+", " ", ln).strip() for ln in text.splitlines()]
    lines = [ln for ln in lines if ln]

    # 1. find each medicine: (name_line, dose_line, dose match)
    found = []
    for i, line in enumerate(lines):
        m = DOSE_RE.search(line)
        if not m:
            continue
        name = clean_name(line[: m.start()])
        name_line = i
        if not name and i > 0 and not DOSE_RE.search(lines[i - 1]):
            name = clean_name(lines[i - 1], from_previous_line=True)
            name_line = i - 1
        if name:
            found.append((name, name_line, i, m))

    # 2. build candidates from each medicine's block of text
    candidates, seen = [], set()
    for k, (name, name_line, dose_line, m) in enumerate(found):
        end = found[k + 1][1] if k + 1 < len(found) else len(lines)
        block = [lines[dose_line][m.end():]] + lines[dose_line + 1:end]
        for j, ln in enumerate(block):
            if STOP_RE.match(ln):
                block = block[:j]
                break
        ctx = "\n".join(block)

        unit = UNIT_MAP[m.group(2).lower()]
        dosage = f"{m.group(1)} {unit}"
        key = (name.lower(), dosage.lower())
        if key in seen:
            continue
        seen.add(key)

        freq = parse_frequency(ctx)
        days = parse_duration_days(ctx)
        warnings = list(freq["warnings"])
        if days is None:
            warnings.append("Course length not found: set the expiry date and quantity yourself.")

        if freq["kind"] == "weekly":
            quantity = ceil(days / 7) if days else 0
            threshold = 1
        elif freq["units_per_day"] and days:
            quantity, threshold = freq["units_per_day"] * days, max(2, 2 * freq["units_per_day"])
        else:
            quantity, threshold = 0, max(2, 2 * (freq["units_per_day"] or 1))
        if quantity == 0:
            warnings.append("Quantity not found: enter how many you have.")

        expiry = (today + timedelta(days=max(days - 1, 0))) if days else None
        candidates.append({
            "name": name, "dosage": dosage, "frequency": freq["label"], "doses_per_day": freq["per_day"],
            "reminder_times": freq["times"], "duration_days": days, "quantity": quantity,
            "low_stock_threshold": threshold, "start_date": today, "expiry_date": expiry,
            "notes": parse_instructions(ctx), "schedule_note": freq["note"], "warnings": warnings,
        })
        if len(candidates) >= MAX_CANDIDATES:
            break
    return candidates
