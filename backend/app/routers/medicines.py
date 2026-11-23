from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Medicine, Reminder, User
from ..schemas import (ImportCreated, ImportIn, ImportOut, ImportSkipped, MedicineIn, MedicineOut, RefillOut,
                       StockIn)
from ..services import medicine_out, refill_forecast, today_or

router = APIRouter(prefix="/medicines", tags=["medicines"])


def owned(db: Session, user: User, medicine_id: int) -> Medicine:
    m = db.query(Medicine).filter(Medicine.id == medicine_id, Medicine.user_id == user.id).first()
    if not m:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Medicine not found")
    return m


@router.get("", response_model=list[MedicineOut])
def list_medicines(q: str | None = None, on: date | None = None,
                   db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    query = db.query(Medicine).filter(Medicine.user_id == user.id)
    if q:
        query = query.filter(Medicine.name.like(f"%{q.strip()}%"))
    today = today_or(on)
    return [medicine_out(m, today) for m in query.order_by(Medicine.name).all()]


@router.post("", response_model=MedicineOut, status_code=status.HTTP_201_CREATED)
def create_medicine(payload: MedicineIn, db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)):
    m = Medicine(user_id=user.id, **payload.model_dump())
    db.add(m)
    db.commit()
    db.refresh(m)
    return medicine_out(m, date.today())


@router.post("/import", response_model=ImportOut, status_code=status.HTTP_201_CREATED)
def import_medicines(payload: ImportIn, on: date | None = None, db: Session = Depends(get_db),
                     user: User = Depends(get_current_user)):
    """Create several medicines (and their daily reminders) in one transaction, e.g. after reading a
    prescription. A medicine with the same name and dosage that already exists is skipped."""
    day = today_or(on)
    existing = {(m.name.strip().lower(), m.dosage.strip().lower())
                for m in db.query(Medicine).filter(Medicine.user_id == user.id)}
    created, skipped = [], []
    for it in payload.items:
        key = (it.name.lower(), it.dosage.lower())
        if key in existing:
            skipped.append(ImportSkipped(name=it.name, reason="Already in your medicines"))
            continue
        existing.add(key)
        m = Medicine(user_id=user.id, **it.model_dump(exclude={"reminder_times"}))
        db.add(m)
        db.flush()
        times = sorted({t.replace(second=0, microsecond=0) for t in it.reminder_times})
        for tm in times:
            db.add(Reminder(user_id=user.id, medicine_id=m.id, remind_time=tm, start_date=day))
        created.append(ImportCreated(id=m.id, name=m.name, reminders=len(times)))
    db.commit()
    return ImportOut(created=created, skipped=skipped)


@router.get("/refills", response_model=list[RefillOut])
def refills(on: date | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Smart refill prediction, soonest run-out first. Declared before /{medicine_id}."""
    return refill_forecast(db, user.id, today_or(on))


@router.get("/{medicine_id}", response_model=MedicineOut)
def get_medicine(medicine_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return medicine_out(owned(db, user, medicine_id), date.today())


@router.put("/{medicine_id}", response_model=MedicineOut)
def update_medicine(medicine_id: int, payload: MedicineIn, db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)):
    m = owned(db, user, medicine_id)
    for key, value in payload.model_dump().items():
        setattr(m, key, value)
    db.commit()
    db.refresh(m)
    return medicine_out(m, date.today())


@router.patch("/{medicine_id}/stock", response_model=MedicineOut)
def update_stock(medicine_id: int, payload: StockIn, db: Session = Depends(get_db),
                 user: User = Depends(get_current_user)):
    m = owned(db, user, medicine_id)
    m.quantity = payload.quantity
    db.commit()
    db.refresh(m)
    return medicine_out(m, date.today())


@router.delete("/{medicine_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_medicine(medicine_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    db.delete(owned(db, user, medicine_id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
