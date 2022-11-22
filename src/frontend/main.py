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
app.drive = Deta().Drive("filebox")
app.db = Deta().Base("filebox_metadata")


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


@app.get("/api/shared/metadata/{file_hash}")
async def get_meta(file_hash: str):
    return app.db.get(file_hash)


@app.get("/api/shared/chunk/{skip}/{file_hash}")
async def get_stream(skip: int, file_hash: str):
    deta_project_key = os.getenv("DETA_PROJECT_KEY")
    deta_project_id = deta_project_key.split("_")[0]
    url = f"https://drive.deta.sh/v1/{deta_project_id}/filebox/files/download?name={file_hash}"
    headers = {"X-Api-Key": deta_project_key}
    chunk_size = 1024 * 1024 * 4
    resp = requests.get(url, headers=headers, stream=True)
    i = 0
    for data in resp.iter_content(chunk_size=chunk_size):
        if i == skip:
            return Response(content=data, media_type="application/octet-stream")
        i += 1
