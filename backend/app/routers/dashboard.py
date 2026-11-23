from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..deps import get_current_user
from ..models import DoseLog, Medicine, Reminder, User
from ..schemas import DashboardOut
from ..services import dose_out, ensure_doses, medicine_out, summarize, today_or

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardOut)
def dashboard(on: date | None = None, db: Session = Depends(get_db),
              user: User = Depends(get_current_user)):
    day = today_or(on)
    ensure_doses(db, user.id, day, day)

    meds = [medicine_out(m, day) for m in
            db.query(Medicine).filter(Medicine.user_id == user.id).order_by(Medicine.name).all()]
    active_reminders = db.query(Reminder).filter(Reminder.user_id == user.id, Reminder.is_active.is_(True)).count()

    todays = (db.query(DoseLog).options(joinedload(DoseLog.medicine))
              .filter(DoseLog.user_id == user.id, DoseLog.scheduled_date == day)
              .order_by(DoseLog.scheduled_time).all())
    recent = (db.query(DoseLog).options(joinedload(DoseLog.medicine))
              .filter(DoseLog.user_id == user.id, DoseLog.status != "Pending")
              .order_by(DoseLog.acted_at.desc()).limit(8).all())

    return DashboardOut(
        total_medicines=len(meds),
        active_reminders=active_reminders,
        today=summarize(todays),
        upcoming=[dose_out(d) for d in todays if d.status == "Pending"],
        low_stock=[m for m in meds if m.stock_status != "ok" and m.expiry_status != "expired"],
        near_expiry=[m for m in meds if m.expiry_status == "near"],
        expired=[m for m in meds if m.expiry_status == "expired"],
        recent_history=[dose_out(d) for d in recent],
    )
