from datetime import date, datetime, time

from sqlalchemy import (Boolean, Date, DateTime, ForeignKey, Integer, LargeBinary, String, Text, Time,
                        UniqueConstraint, func)
from sqlalchemy.dialects.mysql import LONGBLOB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Medicine(Base):
    __tablename__ = "medicines"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(150))
    dosage: Mapped[str] = mapped_column(String(100))
    frequency: Mapped[str] = mapped_column(String(100))
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    low_stock_threshold: Mapped[int] = mapped_column(Integer, default=10)
    start_date: Mapped[date] = mapped_column(Date)
    expiry_date: Mapped[date] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    reminders: Mapped[list["Reminder"]] = relationship(
        back_populates="medicine", cascade="all, delete-orphan"
    )


class Reminder(Base):
    __tablename__ = "reminders"
    __table_args__ = (UniqueConstraint("medicine_id", "remind_time", name="uq_reminder_med_time"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    medicine_id: Mapped[int] = mapped_column(ForeignKey("medicines.id", ondelete="CASCADE"), index=True)
    remind_time: Mapped[time] = mapped_column(Time)
    start_date: Mapped[date] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    medicine: Mapped["Medicine"] = relationship(back_populates="reminders")
    dose_logs: Mapped[list["DoseLog"]] = relationship(
        back_populates="reminder", cascade="all, delete-orphan"
    )


class DoseLog(Base):
    """One scheduled dose of one reminder on one day: Pending, Taken or Skipped."""

    __tablename__ = "dose_logs"
    __table_args__ = (UniqueConstraint("reminder_id", "scheduled_date", name="uq_dose_reminder_day"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    reminder_id: Mapped[int] = mapped_column(ForeignKey("reminders.id", ondelete="CASCADE"), index=True)
    medicine_id: Mapped[int] = mapped_column(ForeignKey("medicines.id", ondelete="CASCADE"), index=True)
    scheduled_date: Mapped[date] = mapped_column(Date, index=True)
    scheduled_time: Mapped[time] = mapped_column(Time)
    status: Mapped[str] = mapped_column(String(10), default="Pending")
    acted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    reminder: Mapped["Reminder"] = relationship(back_populates="dose_logs")
    medicine: Mapped["Medicine"] = relationship()


class Prescription(Base):
    __tablename__ = "prescriptions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(150))
    doctor_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    original_filename: Mapped[str] = mapped_column(String(255))
    stored_filename: Mapped[str] = mapped_column(String(100), unique=True)
    content_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(Integer)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class EmergencyProfile(Base):
    """Opt-in, revocable public emergency card (one per user), opened through a secret token link."""

    __tablename__ = "emergency_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    blood_group: Mapped[str | None] = mapped_column(String(5), nullable=True)
    allergies: Mapped[str | None] = mapped_column(Text, nullable=True)
    conditions: Mapped[str | None] = mapped_column(Text, nullable=True)
    contact_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class PrescriptionFile(Base):
    """The uploaded file's bytes. Stored in the database (not on disk) so hosts with a temporary
    filesystem, such as Render's free tier, do not lose prescriptions."""

    __tablename__ = "prescription_files"

    id: Mapped[int] = mapped_column(primary_key=True)
    prescription_id: Mapped[int] = mapped_column(ForeignKey("prescriptions.id", ondelete="CASCADE"), unique=True)
    data: Mapped[bytes] = mapped_column(LargeBinary().with_variant(LONGBLOB(), "mysql"))
