from ipaddress import ip_address
from urllib.parse import urlsplit

from starlette.datastructures import Headers, MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

_ALLOWED_SCHEMES = {"http", "https"}
_ALLOWED_PORTS = {3000, 4173, 5173, 5174}
_ALLOWED_METHODS = "GET, PUT, POST, DELETE, OPTIONS"
_ALLOWED_HEADERS = "Authorization, Content-Type"


def is_loopback_host(host: str | None) -> bool:
    if host is None:
        return False
    try:
        return ip_address(host).is_loopback
    except ValueError:
        return host.lower() == "localhost"


def is_allowed_browser_origin(origin: str | None) -> bool:
    if origin is None or origin == "null":
        return True
    try:
        parsed = urlsplit(origin)
        port = parsed.port
    except ValueError:
        return False
    return (
        parsed.scheme in _ALLOWED_SCHEMES
        and is_loopback_host(parsed.hostname)
        and port in _ALLOWED_PORTS
        and parsed.path in {"", "/"}
        and not parsed.username
        and not parsed.password
        and not parsed.query
        and not parsed.fragment
    )


class LoopbackCorsMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self._app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self._app(scope, receive, send)
            return
        headers = Headers(scope=scope)
        origin = headers.get("origin")
        if origin is None:
            await self._app(scope, receive, send)
            return
        if not is_allowed_browser_origin(origin):
            await self._reject(send)
            return
        if scope["method"] == "OPTIONS":
            await self._preflight(origin, send)
            return

        async def send_with_cors(message: Message) -> None:
            if message["type"] == "http.response.start":
                response_headers = MutableHeaders(scope=message)
                response_headers["Access-Control-Allow-Origin"] = origin
                response_headers["Vary"] = "Origin"
            await send(message)

        await self._app(scope, receive, send_with_cors)

    async def _preflight(self, origin: str, send: Send) -> None:
        headers = [
            (b"access-control-allow-origin", origin.encode("latin-1")),
            (b"access-control-allow-methods", _ALLOWED_METHODS.encode("latin-1")),
            (b"access-control-allow-headers", _ALLOWED_HEADERS.encode("latin-1")),
            (b"access-control-max-age", b"600"),
            (b"vary", b"Origin"),
        ]
        await send({"type": "http.response.start", "status": 204, "headers": headers})
        await send({"type": "http.response.body", "body": b""})

    async def _reject(self, send: Send) -> None:
        await send(
            {
                "type": "http.response.start",
                "status": 403,
                "headers": [(b"content-type", b"application/json")],
            }
        )
        await send(
            {
                "type": "http.response.body",
                "body": (
                    b'{"error":{"code":"ORIGIN_NOT_ALLOWED","message":"Origin not allowed",'
                    b'"details":{},"retryable":false,"operationId":null}}'
                ),
            }
        )