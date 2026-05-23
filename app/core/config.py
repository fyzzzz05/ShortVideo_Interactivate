from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "ShortVideo Backend"
    APP_VERSION: str = "0.1.0"
    APP_ENV: str = "dev"

    API_V1_PREFIX: str = "/api/v1"

    DATABASE_URL: str = "sqlite:///./shortvideo.db"

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=True, extra="ignore"
    )


settings = Settings()
