function randomFileHash() {
    return [...Array(16)].map(
        () => Math.floor(Math.random() * 16).toString(16)
    ).join('');
}

function upload(file) {
    fetch("/api/secret")
    .then(response => response.text())
    .then(token => {
        let header = {"X-Api-Key": token, "Content-Type": file.type}
        let hash = randomFileHash();
        let projectId = token.split("_")[0];
        const ROOT = 'https://drive.deta.sh/v1';
        let reader = new FileReader();
        reader.onload = (ev) => {
            let body = {
                "hash": hash,
                "name": file.name,
                "size": file.size,
                "mime": file.type,
                "date": new Date().toISOString(),
            }
            if (globalFolderQueue.length > 0) {
                let folder = globalFolderQueue[globalFolderQueue.length - 1];
                if (folder.parent) {
                    body.parent = `${folder.parent}/${folder.name}`;
                } else {
                    body.parent = folder.name;
                }
            }
            globalFileBucket[hash] = file;
            let content = ev.target.result;
            taskQueueElem.appendChild(queueElem(body));
            let extension = file.name.split('.').pop();
            let qualifiedName = `${hash}.${extension}`;
            let bar = document.getElementById(`bar-${hash}`);
            if (file.size < 10 * 1024 * 1024) {
                fetch(`${ROOT}/${projectId}/filebox/files?name=${qualifiedName}`, {
                    method: 'POST',
                    body: content,
                    headers: header
                })
                .then(() => {
                    fetch("/api/metadata", {method: "POST", body: JSON.stringify(body)})
                    .then(() => {
                        bar.style.width = "100%";
                        updateToCompleted(hash)
                        setTimeout(() => {
                            showSnack(`Uploaded ${file.name}`);
                        }, 500);
                    })
                })
            } else {
                let chunkSize = 10 * 1024 * 1024;
                let chunks = [];
                for (let i = 0; i < content.byteLength; i += chunkSize) {
                    chunks.push(content.slice(i, i + chunkSize));
                }
                fetch(`${ROOT}/${projectId}/filebox/uploads?name=${qualifiedName}`, {
                    method: 'POST',
                    headers: header
                })
                .then(response => response.json())
                .then(data => {
                    let finalChunk = chunks.pop();
                    let finalIndex = chunks.length + 1;
                    let uploadId = data["upload_id"];
                    let name = data.name;
                    let allOk = true;
                    let promises = [];
                    bar.style.width = "1%";
                    let progressIndex = 0;
                    chunks.forEach((chunk, index) => {
                        promises.push(
                            fetch(`${ROOT}/${projectId}/filebox/uploads/${uploadId}/parts?name=${name}&part=${index+1}`, {
                                method: 'POST',
                                body: chunk,
                                headers: header
                            }).then(response => {
                                if (response.status !== 200) {
                                    allOk = false;
                                }
                                progressIndex ++;
                                bar.style.width = `${Math.round((progressIndex / finalIndex) * 100)}%`;
                            })
                        )
                    })
                    Promise.all(promises)
                    .then(() => {
                        fetch(`${ROOT}/${projectId}/filebox/uploads/${uploadId}/parts?name=${name}&part=${finalIndex}`, {
                            method: 'POST',
                            body: finalChunk,
                            headers: header
                        })
                        .then(response => {
                            if (response.status !== 200) {
                                allOk = false;
                            }
                            if (allOk) {
                                fetch(`${ROOT}/${projectId}/filebox/uploads/${uploadId}?name=${name}`, {
                                    method: 'PATCH',
                                    headers: header,
                                })
                                .then(response => response.json())
                                .then(() => {
                                    fetch("/api/metadata", {method: "POST", body: JSON.stringify(body)})
                                    .then(() => {
                                        bar.style.width = "100%";
                                        updateToCompleted(hash)
                                        showSnack(`Uploaded ${file.name} successfully!`);
                                        setTimeout(() => {
                                            
                                        }, 500);
                                    })
                                })
                            } else {
                                showSnack(`Failed to upload ${file.name}`, snackbarRed);
                                document.getElementById(`${hash}`).remove();
                                fetch(`${ROOT}/${projectId}/filebox/uploads/${uploadId}?name=${name}`, {
                                    method: 'DELETE', 
                                    headers: header
                                })
                                .then(() => {})
                            }
                        })
                    })
                })
            }
        };
        reader.readAsArrayBuffer(file);
    })
}

function download(file) {
    fetch("/api/secret")
    .then(response => response.text())
    .then(data => {
        showSnack(`Downloading ${file.name}`);
        let header = {"X-Api-Key": data}
        let projectId = data.split("_")[0];
        const ROOT = 'https://drive.deta.sh/v1';
        let extension = file.name.split('.').pop();
        let qualifiedName = file.hash + "." + extension;
        let bar = document.getElementById(`bar-${file.hash}`);
        fetch(`${ROOT}/${projectId}/filebox/files/download?name=${qualifiedName}`, {
            method: 'GET',
            headers: header
        })
        .then((response) => {
            let progress = 0;
            const reader = response.body.getReader();
            return new ReadableStream({
                start(controller) {
                    return pump();
                    function pump() {
                        return reader.read().then(({ done, value }) => {
                            if (done) {
                                controller.close();
                                return;
                            }
                            controller.enqueue(value);
                            progress += value.length;
                            bar.style.width = `${Math.round((progress / file.size) * 100)}%`;
                            return pump();
                        });
                    }
                }
            })
        })
        .then((stream) => new Response(stream))
        .then((response) => response.blob())
        .then((blob) => URL.createObjectURL(blob))
        .then((url) => {
            let a = document.createElement('a');
            a.href = url;
            a.download = file.name;
            bar.style.width = "100%";
            setTimeout(() => {
                showSnack(`Downloaded ${file.name}`);
            }, 500);
            a.click();
        })
        .catch((err) => console.error(err));
    })
}