from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..deps import get_current_user
from ..models import DoseLog, Medicine, Reminder, User
from ..schemas import DoseOut, DosePatch, ReminderIn, ReminderOut, ReminderPatch
from ..services import apply_status, dose_out, ensure_doses, reminder_out, today_or

router = APIRouter(prefix="/reminders", tags=["reminders"])


def owned_reminder(db: Session, user: User, reminder_id: int) -> Reminder:
    r = (db.query(Reminder).options(joinedload(Reminder.medicine))
         .filter(Reminder.id == reminder_id, Reminder.user_id == user.id).first())
    if not r:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reminder not found")
    return r


@router.get("", response_model=list[ReminderOut])
def list_reminders(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = (db.query(Reminder).options(joinedload(Reminder.medicine))
            .filter(Reminder.user_id == user.id).order_by(Reminder.remind_time).all())
    return [reminder_out(r) for r in rows]


@router.post("", response_model=ReminderOut, status_code=status.HTTP_201_CREATED)
def create_reminder(payload: ReminderIn, db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)):
    med = db.query(Medicine).filter(Medicine.id == payload.medicine_id, Medicine.user_id == user.id).first()
    if not med:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Medicine not found")
    r = Reminder(user_id=user.id, medicine_id=med.id, remind_time=payload.remind_time.replace(second=0, microsecond=0),
                 start_date=payload.start_date or date.today())
    db.add(r)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "A reminder for this medicine at this time already exists")
    db.refresh(r)
    return reminder_out(r)


@router.patch("/{reminder_id}", response_model=ReminderOut)
def update_reminder(reminder_id: int, payload: ReminderPatch, db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)):
    r = owned_reminder(db, user, reminder_id)
    if payload.remind_time is not None:
        r.remind_time = payload.remind_time.replace(second=0, microsecond=0)
    if payload.is_active is not None:
        r.is_active = payload.is_active
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "A reminder for this medicine at this time already exists")
    db.refresh(r)
    return reminder_out(r)


@router.delete("/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reminder(reminder_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    db.delete(owned_reminder(db, user, reminder_id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/doses", response_model=list[DoseOut])
def doses_for_day(on: date | None = None, db: Session = Depends(get_db),
                  user: User = Depends(get_current_user)):
    day = today_or(on)
    ensure_doses(db, user.id, day, day)
    rows = (db.query(DoseLog).options(joinedload(DoseLog.medicine))
            .filter(DoseLog.user_id == user.id, DoseLog.scheduled_date == day)
            .order_by(DoseLog.scheduled_time).all())
    return [dose_out(d) for d in rows]


@router.patch("/doses/{dose_id}", response_model=DoseOut)
def set_dose_status(dose_id: int, payload: DosePatch, db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)):
    d = (db.query(DoseLog).options(joinedload(DoseLog.medicine))
         .filter(DoseLog.id == dose_id, DoseLog.user_id == user.id).first())
    if not d:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Dose not found")
    apply_status(d, payload.status)
    db.commit()
    db.refresh(d)
    return dose_out(d)
