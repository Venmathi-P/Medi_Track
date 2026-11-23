from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "mysql+pymysql://root:password@localhost:3306/meditrack"
    secret_key: str = "change-me-in-production"
    access_token_expire_minutes: int = 60 * 24
    cors_origins: str = "http://localhost:5173"
    upload_dir: str = "uploads"
    max_upload_mb: int = 5  # files are stored in the database; keep within a single row's size limit
    near_expiry_days: int = 30


settings = Settings()
