from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import models  # noqa: F401  (registers tables)
from .config import settings
from .database import Base, engine
from .routers import (auth, dashboard, emergency, history, medicines, prescriptions, reminders,
                      reports)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)  # no-op if database/schema.sql was already applied
    yield


app = FastAPI(title="MediTrack API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (auth, medicines, reminders, prescriptions, history, dashboard, reports, emergency):
    app.include_router(r.router, prefix="/api")
app.include_router(emergency.public_router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}
