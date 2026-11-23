from datetime import date, timedelta
from typing import Literal

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..deps import get_current_user
from ..models import DoseLog, User
from ..schemas import HistoryOut
from ..services import dose_out, ensure_doses, summarize, today_or

router = APIRouter(prefix="/history", tags=["history"])


@router.get("", response_model=HistoryOut)
def history(period: Literal["daily", "weekly"] = "daily", on: date | None = None,
            db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    end = today_or(on)
    start = end if period == "daily" else end - timedelta(days=6)
    ensure_doses(db, user.id, start, end)
    rows = (db.query(DoseLog).options(joinedload(DoseLog.medicine))
            .filter(DoseLog.user_id == user.id, DoseLog.scheduled_date.between(start, end))
            .order_by(DoseLog.scheduled_date.desc(), DoseLog.scheduled_time).all())
    return HistoryOut(period=period, start=start, end=end, summary=summarize(rows),
                      doses=[dose_out(d) for d in rows])
