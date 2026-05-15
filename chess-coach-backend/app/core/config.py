from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/chess_coach_db"
    SECRET_KEY: str = "change_this_secret_key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    STOCKFISH_PATH: str = r"C:\Users\nguen\Downloads\stockfish-windows-armv8\stockfish\stockfish-windows-armv8.exe"
    STOCKFISH_DEPTH: int = 12
    OPENAI_API_KEY: str | None = None
    OPENAI_MODEL: str = "gpt-5-mini"
    BACKEND_CORS_ORIGINS: str = ""
    PUBLIC_BACKEND_URL: str = ""

    EMAIL_VERIFICATION_ENABLED: bool = False
    EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS: int = 24
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_FROM_NAME: str = "Chess Coach"
    SMTP_STARTTLS: bool = True

    @property
    def cors_origins(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.BACKEND_CORS_ORIGINS.split(",")
            if origin.strip()
        ]

    class Config:
        env_file = ".env"


settings = Settings()
