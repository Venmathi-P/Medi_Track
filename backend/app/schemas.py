from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator


# ---------- auth ----------
class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    email: EmailStr


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- medicines ----------
class MedicineIn(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    dosage: str = Field(min_length=1, max_length=100)
    frequency: str = Field(min_length=1, max_length=100)
    quantity: int = Field(ge=0, le=100000)
    low_stock_threshold: int = Field(default=10, ge=0, le=100000)
    start_date: date
    expiry_date: date
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("name", "dosage", "frequency")
    @classmethod
    def strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("must not be blank")
        return v

    @model_validator(mode="after")
    def check_dates(self):
        if self.expiry_date < self.start_date:
            raise ValueError("expiry_date must be on or after start_date")
        return self


class StockIn(BaseModel):
    quantity: int = Field(ge=0, le=100000)


class MedicineOut(BaseModel):
    id: int
    name: str
    dosage: str
    frequency: str
    quantity: int
    low_stock_threshold: int
    start_date: date
    expiry_date: date
    notes: str | None
    stock_status: Literal["ok", "low", "out"]
    expiry_status: Literal["ok", "near", "expired"]
    days_to_expiry: int


# ---------- reminders ----------
class ReminderIn(BaseModel):
    medicine_id: int
    remind_time: time
    start_date: date | None = None


class ReminderPatch(BaseModel):
    remind_time: time | None = None
    is_active: bool | None = None


class ReminderOut(BaseModel):
    id: int
    medicine_id: int
    medicine_name: str
    dosage: str
    remind_time: time
    is_active: bool


class DoseOut(BaseModel):
    id: int
    reminder_id: int
    medicine_id: int
    medicine_name: str
    dosage: str
    scheduled_date: date
    scheduled_time: time
    status: Literal["Pending", "Taken", "Skipped"]
    acted_at: datetime | None


class DosePatch(BaseModel):
    status: Literal["Pending", "Taken", "Skipped"]


# ---------- prescriptions ----------
class PrescriptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    doctor_name: str | None
    original_filename: str
    content_type: str
    size_bytes: int
    uploaded_at: datetime


# ---------- history / dashboard ----------
class HistorySummary(BaseModel):
    total: int
    taken: int
    skipped: int
    pending: int
    adherence_percent: int


class HistoryOut(BaseModel):
    period: Literal["daily", "weekly"]
    start: date
    end: date
    summary: HistorySummary
    doses: list[DoseOut]


class DashboardOut(BaseModel):
    total_medicines: int
    active_reminders: int
    today: HistorySummary
    upcoming: list[DoseOut]
    low_stock: list[MedicineOut]
    near_expiry: list[MedicineOut]
    expired: list[MedicineOut]
    recent_history: list[DoseOut]


# ---------- refill forecast ----------
class RefillOut(BaseModel):
    medicine_id: int
    name: str
    dosage: str
    quantity: int
    doses_per_day: int
    days_left: int
    run_out_date: date
    refill_by: date
    urgency: Literal["critical", "soon", "ok"]
    expires_before_runout: bool


# ---------- adherence report ----------
class ReportTotals(BaseModel):
    scheduled: int
    taken: int
    skipped: int
    missed: int
    pending: int
    adherence_percent: int | None


class ReportMedicine(BaseModel):
    medicine_name: str
    dosage: str
    frequency: str
    taken: int
    skipped: int
    missed: int
    pending: int
    adherence_percent: int | None


class ReportDay(BaseModel):
    day: date
    taken: int
    skipped: int
    missed: int
    pending: int


class ReportEvent(BaseModel):
    day: date
    time: time
    medicine_name: str
    dosage: str
    state: Literal["Missed", "Skipped"]


class ReportCurrentMedicine(BaseModel):
    name: str
    dosage: str
    frequency: str
    expiry_date: date


class ReportOut(BaseModel):
    patient_name: str
    patient_email: str
    start: date
    end: date
    generated_on: date
    totals: ReportTotals
    per_medicine: list[ReportMedicine]
    daily: list[ReportDay]
    events: list[ReportEvent]
    current_medicines: list[ReportCurrentMedicine]


# ---------- emergency card ----------
BloodGroup = Literal["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]


class EmergencyIn(BaseModel):
    is_enabled: bool = False
    blood_group: BloodGroup | None = None
    allergies: str | None = Field(default=None, max_length=1000)
    conditions: str | None = Field(default=None, max_length=1000)
    contact_name: str | None = Field(default=None, max_length=100)
    contact_phone: str | None = Field(default=None, max_length=30, pattern=r"^[0-9+\-()\s]*$")
    notes: str | None = Field(default=None, max_length=1000)

    @field_validator("blood_group", "allergies", "conditions", "contact_name", "contact_phone", "notes", mode="before")
    @classmethod
    def blank_to_none(cls, v):
        if isinstance(v, str):
            v = v.strip()
            return v or None
        return v


class EmergencyOut(EmergencyIn):
    token: str


class EmergencyMedicine(BaseModel):
    name: str
    dosage: str
    frequency: str


class EmergencyPublic(BaseModel):
    patient_name: str
    blood_group: str | None
    allergies: str | None
    conditions: str | None
    contact_name: str | None
    contact_phone: str | None
    notes: str | None
    medicines: list[EmergencyMedicine]


# ---------- prescription -> medicines ----------
class CandidateOut(BaseModel):
    name: str
    dosage: str
    frequency: str
    doses_per_day: int
    reminder_times: list[str]
    duration_days: int | None
    quantity: int
    low_stock_threshold: int
    start_date: date
    expiry_date: date | None
    notes: str | None
    schedule_note: str | None
    warnings: list[str]
    already_exists: bool


class ExtractOut(BaseModel):
    status: Literal["ok", "no_medicines", "no_text", "not_pdf", "unreadable"]
    message: str
    medicines: list[CandidateOut]


class ImportItem(MedicineIn):
    reminder_times: list[time] = Field(default_factory=list, max_length=6)


class ImportIn(BaseModel):
    items: list[ImportItem] = Field(min_length=1, max_length=30)


class ImportCreated(BaseModel):
    id: int
    name: str
    reminders: int


class ImportSkipped(BaseModel):
    name: str
    reason: str


class ImportOut(BaseModel):
    created: list[ImportCreated]
    skipped: list[ImportSkipped]
