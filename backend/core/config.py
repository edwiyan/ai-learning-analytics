from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    openai_api_key: str
    openai_model: str = "gpt-4o-mini"
    topic_mapping_confidence_threshold: float = 0.75
    tesseract_cmd: str = "tesseract"
    redis_url: str = "redis://localhost:6379/0"
    environment: str = "development"
    debug: bool = False

    # Email / SMTP
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    email_from: str = ""
    email_from_name: str = "AILAS – BTECH"

    class Config:
        env_file = ".env"


settings = Settings()
