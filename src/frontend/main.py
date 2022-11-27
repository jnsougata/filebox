from fastapi import FastAPI
from fastapi.responses import Response


class ContentResponse(Response):

    def __init__(self, path: str, **kwargs):
        self.file = open(path, 'rb')
        super().__init__(content=self.file.read(), **kwargs)
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_value, traceback):
        self.file.close()


app = FastAPI(docs_url=None, redoc_url=None)

@app.get("/")
def index():
    with ContentResponse("./static/index.html", media_type="text/html") as response:
        return response


@app.get("/download/{hash}")
def shared():
    with ContentResponse("./static/download.html", media_type="text/html") as response:
        return response


@app.get("/assets/{path}")
def assets(path: str):
    with ContentResponse(f"./assets/{path}", media_type="image/*") as response:
        return response


@app.get("/styles/{path}")
def styles(path: str):
    with ContentResponse(f"./styles/{path}", media_type="text/css") as response:
        return response


@app.get("/scripts/{path}")
def scripts(path: str):
    with ContentResponse(f"./scripts/{path}", media_type="text/javascript") as response:
        return response
