def normalize_user_id(user_id: str | None) -> str:
    if not user_id:
        return "anonymous"
    return user_id.strip() or "anonymous"
