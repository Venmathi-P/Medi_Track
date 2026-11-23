"""Shared business logic: stock/expiry status and dose generation."""
from datetime import date, datetime, timedelta

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from .config import settings
from .models import DoseLog, Medicine, Reminder
from .schemas import DoseOut, HistorySummary, MedicineOut, ReminderOut, RefillOut


def today_or(on: date | None) -> date:
    return on or date.today()


def medicine_out(m: Medicine, today: date) -> MedicineOut:
    days = (m.expiry_date - today).days
    if days < 0:
        expiry = "expired"
    elif days <= settings.near_expiry_days:
        expiry = "near"
    else:
        expiry = "ok"
    if m.quantity <= 0:
        stock = "out"
    elif m.quantity <= m.low_stock_threshold:
        stock = "low"
    else:
        stock = "ok"
    return MedicineOut(
        id=m.id, name=m.name, dosage=m.dosage, frequency=m.frequency, quantity=m.quantity,
        low_stock_threshold=m.low_stock_threshold, start_date=m.start_date,
        expiry_date=m.expiry_date, notes=m.notes, stock_status=stock,
        expiry_status=expiry, days_to_expiry=days,
    )


def reminder_out(r: Reminder) -> ReminderOut:
    return ReminderOut(
        id=r.id, medicine_id=r.medicine_id, medicine_name=r.medicine.name,
        dosage=r.medicine.dosage, remind_time=r.remind_time, is_active=r.is_active,
    )


def dose_out(d: DoseLog) -> DoseOut:
    return DoseOut(
        id=d.id, reminder_id=d.reminder_id, medicine_id=d.medicine_id,
        medicine_name=d.medicine.name, dosage=d.medicine.dosage,
        scheduled_date=d.scheduled_date, scheduled_time=d.scheduled_time,
        status=d.status, acted_at=d.acted_at,
    )


def ensure_doses(db: Session, user_id: int, start: date, end: date) -> None:
    """Create Pending dose rows for active reminders between start and end (inclusive).

    Never creates doses before a reminder/medicine start date or after the medicine's expiry.
    Capped at server-today + 1 day so the future is not pre-generated.
    """
    end = min(end, date.today() + timedelta(days=1))
    if end < start:
        return
    reminders = (
        db.query(Reminder)
        .options(joinedload(Reminder.medicine))
        .filter(Reminder.user_id == user_id, Reminder.is_active.is_(True))
        .all()
    )
    existing = {
        (rid, d)
        for rid, d in db.query(DoseLog.reminder_id, DoseLog.scheduled_date).filter(
            DoseLog.user_id == user_id, DoseLog.scheduled_date.between(start, end)
        )
    }
    new = []
    for r in reminders:
        m = r.medicine
        day = max(start, r.start_date, m.start_date)
        last = min(end, m.expiry_date)
        while day <= last:
            if (r.id, day) not in existing:
                new.append(DoseLog(user_id=user_id, reminder_id=r.id, medicine_id=m.id,
                                   scheduled_date=day, scheduled_time=r.remind_time))
            day += timedelta(days=1)
    if new:
        db.add_all(new)
        try:
            db.commit()
        except IntegrityError:  # a concurrent request created the same rows
            db.rollback()


def apply_status(dose: DoseLog, new_status: str) -> None:
    """Change a dose's status and keep stock in sync (one unit per dose)."""
    old = dose.status
    if old == new_status:
        return
    med = dose.medicine
    if new_status == "Taken":
        med.quantity = max(0, med.quantity - 1)
    elif old == "Taken":
        med.quantity += 1
    dose.status = new_status
    dose.acted_at = datetime.now() if new_status != "Pending" else None


def summarize(doses: list[DoseLog]) -> HistorySummary:
    taken = sum(d.status == "Taken" for d in doses)
    skipped = sum(d.status == "Skipped" for d in doses)
    pending = sum(d.status == "Pending" for d in doses)
    total = len(doses)
    return HistorySummary(
        total=total, taken=taken, skipped=skipped, pending=pending,
        adherence_percent=round(taken * 100 / total) if total else 0,
    )


REFILL_LEAD_DAYS = 3  # suggest ordering this many days before the stock runs out


def refill_forecast(db: Session, user_id: int, today: date) -> list[RefillOut]:
    """Predict when each scheduled medicine runs out.

    doses per day = number of active reminders for the medicine (one unit per dose).
    Medicines with no active reminder have no schedule, so they cannot be predicted.
    """
    counts = dict(
        db.query(Reminder.medicine_id, func.count(Reminder.id))
        .filter(Reminder.user_id == user_id, Reminder.is_active.is_(True))
        .group_by(Reminder.medicine_id)
        .all()
    )
    if not counts:
        return []
    meds = db.query(Medicine).filter(Medicine.user_id == user_id, Medicine.id.in_(list(counts))).all()
    out = []
    for m in meds:
        if m.expiry_date < today:
            continue  # expired medicines are discarded, not refilled
        per_day = counts[m.id]
        days_left = m.quantity // per_day
        run_out = today + timedelta(days=days_left)
        out.append(RefillOut(
            medicine_id=m.id, name=m.name, dosage=m.dosage, quantity=m.quantity,
            doses_per_day=per_day, days_left=days_left, run_out_date=run_out,
            refill_by=max(today, run_out - timedelta(days=REFILL_LEAD_DAYS)),
            urgency="critical" if days_left <= 3 else "soon" if days_left <= 7 else "ok",
            expires_before_runout=m.expiry_date < run_out,
        ))
    out.sort(key=lambda r: (r.days_left, r.name))
    return out
