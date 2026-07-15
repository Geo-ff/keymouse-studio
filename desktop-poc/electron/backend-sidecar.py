from __future__ import annotations

import asyncio
import json
import socket
import sys
import threading

import uvicorn

from keymouse_studio.config import Settings
from keymouse_studio.main import create_app

HOST = "127.0.0.1"


def watch_parent(server: uvicorn.Server) -> None:
    sys.stdin.readline()
    server.should_exit = True


async def run() -> None:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind((HOST, 0))
    sock.listen(2048)
    port = sock.getsockname()[1]
    settings = Settings(host=HOST, port=port)
    server = uvicorn.Server(
        uvicorn.Config(
            create_app(settings),
            host=HOST,
            port=port,
            workers=1,
            lifespan="on",
            reload=False,
            proxy_headers=False,
            access_log=False,
            log_config=None,
        )
    )
    watcher = threading.Thread(target=watch_parent, args=(server,), daemon=True)
    watcher.start()
    serve_task = asyncio.create_task(server.serve(sockets=[sock]))
    while not server.started and not serve_task.done():
        await asyncio.sleep(0.01)
    if server.started:
        print(
            json.dumps(
                {"host": HOST, "port": port, "token": settings.session_token},
                separators=(",", ":"),
            ),
            flush=True,
        )
    await serve_task


if __name__ == "__main__":
    asyncio.run(run())