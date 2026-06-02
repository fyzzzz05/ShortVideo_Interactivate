from app.core.logging import setup_logging


def startup() -> None:
    setup_logging()


def shutdown() -> None:
    return None
