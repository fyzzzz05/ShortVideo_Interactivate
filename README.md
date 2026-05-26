# ShortVideo Backend

## Run

```bash
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

## Key APIs
- GET `/health`
- GET `/api/v1/dramas`
- GET `/api/v1/episodes/{episode_id}/events?mode=offline|hybrid`
- POST `/api/v1/events/realtime-detect`
- POST `/api/v1/interactions/click`
- POST `/api/v1/interactions/like`
- GET `/api/v1/interactions/summary?episode_id=1`
- POST `/api/v1/shop/search-link`
- GET `/api/v1/quiz/{episode_id}/profile`
- POST `/api/v1/quiz/submit`
