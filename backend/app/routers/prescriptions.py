import uuid
from datetime import date
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..deps import get_current_user
from ..models import Medicine, Prescription, PrescriptionFile, User
from ..prescription_parser import extract_pdf_text, parse_prescription_text
from ..schemas import CandidateOut, ExtractOut, PrescriptionOut
from ..services import today_or

router = APIRouter(prefix="/prescriptions", tags=["prescriptions"])

# extension -> (content type, magic-byte prefixes)
ALLOWED = {
    ".pdf": ("application/pdf", (b"%PDF",)),
    ".png": ("image/png", (b"\x89PNG\r\n\x1a\n",)),
    ".jpg": ("image/jpeg", (b"\xff\xd8\xff",)),
    ".jpeg": ("image/jpeg", (b"\xff\xd8\xff",)),
}


def legacy_dir() -> Path:
    """Folder used by earlier versions that saved files on disk. Still read as a fallback."""
    return Path(settings.upload_dir).resolve()


def owned(db: Session, user: User, pid: int) -> Prescription:
    p = db.query(Prescription).filter(Prescription.id == pid, Prescription.user_id == user.id).first()
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Prescription not found")
    return p


def load_file_bytes(db: Session, p: Prescription) -> bytes | None:
    row = db.query(PrescriptionFile).filter(PrescriptionFile.prescription_id == p.id).first()
    if row:
        return row.data
    old = legacy_dir() / p.stored_filename
    return old.read_bytes() if old.is_file() else None


@router.get("", response_model=list[PrescriptionOut])
def list_prescriptions(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return (db.query(Prescription).filter(Prescription.user_id == user.id)
            .order_by(Prescription.uploaded_at.desc()).all())


@router.post("", response_model=PrescriptionOut, status_code=status.HTTP_201_CREATED)
async def upload_prescription(
    title: str = Form(..., min_length=1, max_length=150),
    doctor_name: str | None = Form(None, max_length=150),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    original = Path(file.filename or "prescription").name
    ext = Path(original).suffix.lower()
    if ext not in ALLOWED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only PDF, PNG and JPG files are allowed")
    content_type, magics = ALLOWED[ext]

    max_bytes = settings.max_upload_mb * 1024 * 1024
    data = await file.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            f"File is larger than {settings.max_upload_mb} MB")
    if not data or not data.startswith(magics):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "File content does not match its extension")

    p = Prescription(user_id=user.id, title=title.strip(), doctor_name=(doctor_name or "").strip() or None,
                     original_filename=original[:255], stored_filename=f"{uuid.uuid4().hex}{ext}",
                     content_type=content_type, size_bytes=len(data))
    db.add(p)
    db.flush()
    db.add(PrescriptionFile(prescription_id=p.id, data=data))
    db.commit()
    db.refresh(p)
    return p


@router.post("/{pid}/extract", response_model=ExtractOut)
def extract_medicines(pid: int, on: date | None = None, db: Session = Depends(get_db),
                      user: User = Depends(get_current_user)):
    """Read the prescription's text and suggest medicines. Nothing is saved here."""
    p = owned(db, user, pid)
    empty = lambda status_, msg: ExtractOut(status=status_, message=msg, medicines=[])  # noqa: E731
    if p.content_type != "application/pdf":
        return empty("not_pdf", "Automatic reading works on PDFs that contain text. This file is an image, so add its medicines on the Medicines page.")
    data = load_file_bytes(db, p)
    if data is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File is missing on the server")
    try:
        text = extract_pdf_text(data)
    except Exception:  # corrupt, encrypted or unsupported PDF
        return empty("unreadable", "This PDF could not be read (it may be damaged or password protected).")
    if len(text.strip()) < 20:
        return empty("no_text", "This PDF has no selectable text (it is probably a scan or photo), so it cannot be read automatically. Add its medicines on the Medicines page.")

    found = parse_prescription_text(text, today_or(on))
    if not found:
        return empty("no_medicines", "The PDF was read, but no medicine lines were recognised. You can add rows by hand below.")
    existing = {(m.name.strip().lower(), m.dosage.strip().lower())
                for m in db.query(Medicine).filter(Medicine.user_id == user.id)}
    meds = [CandidateOut(**c, already_exists=(c["name"].lower(), c["dosage"].lower()) in existing) for c in found]
    return ExtractOut(status="ok", message=f"Found {len(meds)} medicine{'s' if len(meds) != 1 else ''}. Check the details, then add them.", medicines=meds)


@router.get("/{pid}/file")
def get_file(pid: int, download: bool = False, db: Session = Depends(get_db),
             user: User = Depends(get_current_user)):
    p = owned(db, user, pid)
    data = load_file_bytes(db, p)
    if data is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File is missing on the server")
    disposition = "attachment" if download else "inline"
    return Response(content=data, media_type=p.content_type, headers={
        "Content-Disposition": f"{disposition}; filename*=UTF-8''{quote(p.original_filename)}",
        "Cache-Control": "private, no-store",
    })


@router.delete("/{pid}", status_code=status.HTTP_204_NO_CONTENT)
def delete_prescription(pid: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    p = owned(db, user, pid)
    db.query(PrescriptionFile).filter(PrescriptionFile.prescription_id == p.id).delete()
    (legacy_dir() / p.stored_filename).unlink(missing_ok=True)
    db.delete(p)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
