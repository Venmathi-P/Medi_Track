from collections import defaultdict
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..deps import get_current_user
from ..models import DoseLog, Medicine, User
from ..schemas import (ReportCurrentMedicine, ReportDay, ReportEvent, ReportMedicine, ReportOut,
                       ReportTotals)
from ..services import ensure_doses, today_or

router = APIRouter(prefix="/reports", tags=["reports"])


def pct(taken: int, counted: int) -> int | None:
    return round(taken * 100 / counted) if counted else None


@router.get("/adherence", response_model=ReportOut)
def adherence(start: date, end: date, on: date | None = None, db: Session = Depends(get_db),
              user: User = Depends(get_current_user)):
    """Doctor-ready adherence summary. A Pending dose from a past day counts as Missed;
    today's Pending doses are shown but not counted against adherence."""
    today = today_or(on)
    if end < start:
        raise HTTPException(400, "End date must be on or after the start date")
    end = min(end, today)
    if end < start:
        raise HTTPException(400, "The start date is in the future")
    if (end - start).days > 92:
        raise HTTPException(400, "Choose a range of 93 days or less")

    ensure_doses(db, user.id, start, end)
    rows = (db.query(DoseLog).options(joinedload(DoseLog.medicine))
            .filter(DoseLog.user_id == user.id, DoseLog.scheduled_date.between(start, end))
            .order_by(DoseLog.scheduled_date, DoseLog.scheduled_time).all())

    def state(d: DoseLog) -> str:
        if d.status != "Pending":
            return d.status
        return "Missed" if d.scheduled_date < today else "Pending"

    blank = lambda: {"Taken": 0, "Skipped": 0, "Missed": 0, "Pending": 0}  # noqa: E731
    total, by_med, by_day, meds_meta, events = blank(), defaultdict(blank), defaultdict(blank), {}, []
    for d in rows:
        st = state(d)
        total[st] += 1
        by_med[d.medicine_id][st] += 1
        by_day[d.scheduled_date][st] += 1
        meds_meta[d.medicine_id] = d.medicine
        if st in ("Missed", "Skipped"):
            events.append(ReportEvent(day=d.scheduled_date, time=d.scheduled_time,
                                      medicine_name=d.medicine.name, dosage=d.medicine.dosage, state=st))
    events.sort(key=lambda e: (e.day, e.time), reverse=True)

    counted = lambda c: c["Taken"] + c["Skipped"] + c["Missed"]  # noqa: E731
    per_medicine = [
        ReportMedicine(medicine_name=m.name, dosage=m.dosage, frequency=m.frequency, taken=c["Taken"],
                       skipped=c["Skipped"], missed=c["Missed"], pending=c["Pending"],
                       adherence_percent=pct(c["Taken"], counted(c)))
        for mid, c in by_med.items() for m in [meds_meta[mid]]
    ]
    per_medicine.sort(key=lambda r: r.medicine_name.lower())
    daily = [ReportDay(day=day, taken=c["Taken"], skipped=c["Skipped"], missed=c["Missed"], pending=c["Pending"])
             for day, c in sorted(by_day.items())]
    current = (db.query(Medicine).filter(Medicine.user_id == user.id, Medicine.expiry_date >= today)
               .order_by(Medicine.name).all())

    return ReportOut(
        patient_name=user.name, patient_email=user.email, start=start, end=end, generated_on=today,
        totals=ReportTotals(scheduled=len(rows), taken=total["Taken"], skipped=total["Skipped"],
                            missed=total["Missed"], pending=total["Pending"],
                            adherence_percent=pct(total["Taken"], counted(total))),
        per_medicine=per_medicine, daily=daily, events=events[:200],
        current_medicines=[ReportCurrentMedicine(name=m.name, dosage=m.dosage, frequency=m.frequency,
                                                 expiry_date=m.expiry_date) for m in current],
    )
