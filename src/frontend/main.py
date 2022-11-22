import os
import requests
from deta import Deta
from fastapi import FastAPI
from fastapi import Request
from fastapi.responses import Response, PlainTextResponse, RedirectResponse


class ContentResponse(Response):

    def __init__(self, path: str, **kwargs):
        with open(path, "rb") as f:
            content = f.read()
            super().__init__(content=content, **kwargs)


app = FastAPI(docs_url=None, redoc_url=None)


@app.get("/")
def index():
    return ContentResponse("./static/index.html", media_type="text/html")


@app.get("/dir/{name:path}")
def folder(name: str):
    if name:
        return ContentResponse("./static/folder.html", media_type="text/html")
    return RedirectResponse("/")


@app.get("/download/{file_id}")
def shared():
    return ContentResponse("./static/download.html", media_type="text/html")


@app.get("/assets/{path}")
def assets(path: str):
    return ContentResponse(f"./assets/{path}", media_type="image/*")


@app.get("/styles/{path}")
def styles(path: str):
    return ContentResponse(f"./styles/{path}", media_type="text/css")


@app.get("/scripts/{path}")
def scripts(path: str):
    return ContentResponse(f"./scripts/{path}", media_type="text/javascript")
