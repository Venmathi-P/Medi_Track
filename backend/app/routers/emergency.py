import secrets
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import EmergencyProfile, Medicine, User
from ..schemas import EmergencyIn, EmergencyMedicine, EmergencyOut, EmergencyPublic

router = APIRouter(prefix="/emergency", tags=["emergency card"])
public_router = APIRouter(prefix="/public/emergency", tags=["emergency card (public)"])


def new_token() -> str:
    return secrets.token_urlsafe(24)  # 192 bits, not guessable


def get_or_create(db: Session, user: User) -> EmergencyProfile:
    p = db.query(EmergencyProfile).filter(EmergencyProfile.user_id == user.id).first()
    if not p:
        p = EmergencyProfile(user_id=user.id, token=new_token(), is_enabled=False)
        db.add(p)
        db.commit()
        db.refresh(p)
    return p


def to_out(p: EmergencyProfile) -> EmergencyOut:
    return EmergencyOut(token=p.token, is_enabled=p.is_enabled, blood_group=p.blood_group,
                        allergies=p.allergies, conditions=p.conditions, contact_name=p.contact_name,
                        contact_phone=p.contact_phone, notes=p.notes)


@router.get("", response_model=EmergencyOut)
def get_card(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return to_out(get_or_create(db, user))


@router.put("", response_model=EmergencyOut)
def save_card(payload: EmergencyIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    p = get_or_create(db, user)
    for key, value in payload.model_dump().items():
        setattr(p, key, value)
    db.commit()
    db.refresh(p)
    return to_out(p)


@router.post("/regenerate", response_model=EmergencyOut)
def regenerate(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Issue a new secret link; the old link and any printed QR code stop working."""
    p = get_or_create(db, user)
    p.token = new_token()
    db.commit()
    db.refresh(p)
    return to_out(p)


@public_router.get("/{token}", response_model=EmergencyPublic)
def public_card(token: str, response: Response, db: Session = Depends(get_db)):
    """Read-only card for responders. No login. Shows only what the owner chose to share
    (never the email); 404 when sharing is off or the link was revoked."""
    p = db.query(EmergencyProfile).filter(EmergencyProfile.token == token,
                                          EmergencyProfile.is_enabled.is_(True)).first()
    if not p:
        raise HTTPException(404, "This emergency card is not available")
    response.headers["Cache-Control"] = "no-store"
    user = db.get(User, p.user_id)
    today = date.today()
    meds = (db.query(Medicine).filter(Medicine.user_id == p.user_id, Medicine.expiry_date >= today,
                                      Medicine.start_date <= today).order_by(Medicine.name).all())
    return EmergencyPublic(
        patient_name=user.name, blood_group=p.blood_group, allergies=p.allergies, conditions=p.conditions,
        contact_name=p.contact_name, contact_phone=p.contact_phone, notes=p.notes,
        medicines=[EmergencyMedicine(name=m.name, dosage=m.dosage, frequency=m.frequency) for m in meds],
    )
