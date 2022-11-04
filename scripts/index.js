let uploadButton = document.getElementById('upload');
let uploadInput = document.getElementById('file-input');
let fileView = document.getElementById('view-panel');
let snackbar = document.getElementById("snackbar");
let hiddenState = true;
let topbar = document.getElementById("topbar");
let toggle = document.getElementById("topbar-toggle");
const snackbarRed = "rgba(203, 20, 70, 0.55)";
const snackbarGreen = "rgba(37, 172, 80, 0.555)";
const downloadGreen = "#25a03d";
const uploadBlue = "#1549e3";

function randomFileHash() {
    return [...Array(16)].map(
        () => Math.floor(Math.random() * 16).toString(16)
    ).join('');
}

uploadButton.addEventListener('click', () => {
    uploadInput.click();
});

uploadInput.addEventListener('change', () => {
    uploadFile(uploadInput.files[0]);
});

function uploadFile(file) {
    fetch("/api/secret")
    .then(response => response.text())
    .then(token => {
        showSnack(`Uploading ${file.name}`);
        let header = {"X-Api-Key": token}
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
            let content = ev.target.result;
            fileView.appendChild(newFile(body));
            let extension = file.name.split('.').pop();
            let qualifiedName = `${hash}.${extension}`;
            renderBarMatrix(hash, uploadBlue);
            let progressBar = document.getElementById(`bar-${hash}`);
            if (file.size < 10 * 1024 * 1024) {
                fetch(`${ROOT}/${projectId}/filebox/files?name=${qualifiedName}`, {
                    method: 'POST',
                    body: content,
                    headers: header
                })
                .then(() => {
                    fetch("/api/metadata", {method: "POST", body: JSON.stringify(body)})
                    .then(() => {
                        progressBar.style.width = "100%";
                        setTimeout(() => {
                            hideBarMatrix(hash);
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
                    progressBar.style.width = "1%";
                    let progressIndex = 0;
                    chunks.forEach((chunk, index) => {
                        promises.push(
                            fetch(`${ROOT}/${projectId}/filebox/uploads/${uploadId}/parts?name=${name}&part=${index+1}`, {
                                method: 'POST',
                                body: chunk,
                                headers: header
                            }).then(response => {
                                if (response.status != 200) {
                                    allOk = false;
                                }
                                progressIndex ++;
                                progressBar.style.width = `${Math.round((progressIndex / finalIndex) * 100)}%`;
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
                            if (response.status != 200) {
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
                                        progressBar.style.width = "100%";
                                        showSnack(`File ${file.name} uploaded successfully`);
                                        setTimeout(() => {
                                            hideBarMatrix(hash);
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

function downloadFile(file) {
    fetch("/api/secret")
    .then(response => response.text())
    .then(data => {
        showSnack(`Downloading ${file.name}`);
        let header = {"X-Api-Key": data}
        let projectId = data.split("_")[0];
        const ROOT = 'https://drive.deta.sh/v1';
        let extension = file.name.split('.').pop();
        let qualifiedName = file.hash + "." + extension;
        renderBarMatrix(file.hash, downloadGreen);
        let progressBar = document.getElementById(`bar-${file.hash}`);
        progressBar.style.backgroundColor = downloadGreen;
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
                            progressBar.style.width = `${Math.round((progress / file.size) * 100)}%`;
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
            progressBar.style.width = "100%";
            setTimeout(() => {
                hideBarMatrix(file.hash);
            }, 500);
            a.click();
        })
        .catch((err) => console.error(err));
    })
}

function newFile(file) {
    let card = document.createElement("div");
    card.id = `card-${file.hash}`;
    card.className = "file-card";
    let icon = document.createElement("div");
    icon.className = "icon";
    let i = document.createElement("i");
    i.className = handleMimeIcon(file.mime);
    icon.appendChild(i);
    let details = document.createElement("div");
    details.className = "details";
    let name = document.createElement("span");
    name.innerHTML = file.name;
    let size = document.createElement("span");
    size.innerHTML = handleSizeUnit(file.size);
    let date = document.createElement("span");
    let d = new Date(file.date);
    date.innerText = d.getDate()
        + "/" + (d.getMonth() + 1)
        + "/" + d.getFullYear()
        + " " + d.getHours()
        + ":" + d.getMinutes()
        + ":" + d.getSeconds();
    details.appendChild(name);
    details.appendChild(size);
    details.appendChild(date);
    let oprations = document.createElement("div");
    oprations.className = "operations";
    let deleteButton = document.createElement("button");
    deleteButton.innerHTML = `<i class="fa-solid fa-trash"></i>`;
    deleteButton.onclick = () => {
        deleteFile(file);
    }
    let shareButton = document.createElement("button");
    shareButton.innerHTML = `<i class="fa-solid fa-share"></i>`;
    shareButton.onclick = () => {
        shareButtonClick(file);
    }
    let downloadButton = document.createElement("button");
    downloadButton.innerHTML = `<i class="fa-solid fa-download"></i>`;
    downloadButton.onclick = () => {
        downloadFile(file);
    }
    oprations.appendChild(deleteButton);
    oprations.appendChild(shareButton);
    oprations.appendChild(downloadButton);
    let progress = document.createElement("div");
    progress.className = "progress";
    progress.id = `progress-${file.hash}`;
    let bar = document.createElement("div");
    bar.className = "bar";
    bar.id = `bar-${file.hash}`;
    progress.appendChild(bar);
    card.appendChild(icon);
    card.appendChild(details);
    card.appendChild(oprations);
    card.appendChild(progress);
    return card;
}

window.onload = () => {
    hiddenState = true;
    topbar.style.display = "none";
    fetch("/api/metadata")
    .then(response => response.json())
    .then(data => {
        data.forEach(file => {
            fileView.appendChild(newFile(file));
        })
    })
}

function handleMimeIcon(mime) {
    if (mime.startsWith("image")) {
        return "fa-solid fa-image";
    } else if (mime.startsWith("video")) {
        return "fa-solid fa-video";
    } else if (mime.startsWith("audio")) {
        return "fa-solid fa-headphones";
    } else if (mime.startsWith("text")) {
        return  "fa-solid fa-file-lines";
    } else if (mime.startsWith("application/pdf")) {
        return "fa-solid fa-file-pdf";
    } else if (mime.startsWith("application/zip")) {
        return "fa-solid fa-file-zipper";
    } else {
        return "fa-solid fa-file";
    }
}

function handleSizeUnit(size) {
    if (size < 1024) {
        return size + " B";
    } else if (size < 1024 * 1024) {
        return (size / 1024).toFixed(4) + " KB";
    } else if (size < 1024 * 1024 * 1024) {
        return (size / 1024 / 1024).toFixed(4) + " MB";
    } else {
        return (size / 1024 / 1024 / 1024).toFixed(4) + " GB";
    }
}

function dropHandler(ev) {
    ev.preventDefault();
    if (ev.dataTransfer.items) {
        [...ev.dataTransfer.items].forEach((item, _) => {
            uploadFile(item.getAsFile());
        })
    }
}

function dragOverHandler(ev) {
    ev.preventDefault();
}

function showSnack(inner, color = snackbarGreen) {
    snackbar.style.backgroundColor = color;
    snackbar.className = "show";
    snackbar.innerHTML = inner;
    setTimeout(() => {
        snackbar.className = snackbar.className.replace("show", "")
    }, 3000);
}

function shareButtonClick(file) {
    if (file.size > 1024 * 1024 * 30) {
        showSnack("File is too big to share", snackbarRed);
        return;
    }
    showSnack(`URL copied to clipboard`);
    window.navigator.clipboard.writeText(window.location.href + "download/" + file.hash)
        .then(_ => {});
}

function deleteFile(file) {
    fetch(`/api/metadata`, {
        method: "DELETE",
        body: JSON.stringify(file),
    })
    .then(() => {
        showSnack(`File ${file.name} deleted`, snackbarRed);
        document.getElementById(`card-${file.hash}`).remove();
    })
}

function renderBarMatrix(hash, color) {
    let progressBar = document.getElementById(`progress-${hash}`);
    progressBar.style.visibility = "visible";
    let bar = document.getElementById(`bar-${hash}`);
    bar.style.backgroundColor = color;

}

function hideBarMatrix(hash) {
    let progressBar = document.getElementById(`progress-${hash}`);
    progressBar.style.visibility = "hidden";
    let bar = document.getElementById(`bar-${hash}`);
    bar.style.width = "0%";
}

toggle.onclick = () => {
    if (hiddenState) {
        toggle.innerHTML = `<i class="fa-solid fa-chevron-up"></i>`;
        hiddenState = false;
        topbar.style.display = "flex";
    } else {
        toggle.innerHTML = `<i class="fa-solid fa-chevron-down"></i>`;
        hiddenState = true;
        topbar.style.display = "none";
    }
};