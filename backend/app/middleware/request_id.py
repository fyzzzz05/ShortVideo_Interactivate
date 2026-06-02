from fastapi import Request


async def request_id_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Request-Id"] = request.headers.get("X-Request-Id", "generated")
    return response
