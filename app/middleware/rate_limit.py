from fastapi import HTTPException


def check_rate_limit(current: int, threshold: int = 100) -> None:
    if current > threshold:
        raise HTTPException(status_code=429, detail="rate limited")
