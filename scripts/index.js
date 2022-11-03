let uploadButton = document.getElementById('upload');
let uploadInput = document.getElementById('file-input');
let fileView = document.getElementById('file-view');
let snackbar = document.getElementById("snackbar");
const snackbarRed = "rgba(203, 20, 70, 0.55)";
const snackbarGreen = "rgba(37, 172, 80, 0.555)";
const downloadGreen = "rgba(23, 131, 68, 0.323)";

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
            let progressBar = document.getElementById(`progress-${hash}`);
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
                            progressBar.style.color = "transparent";
                            progressBar.style.width = "0%";
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
                                            progressBar.style.color = "transparent";
                                            progressBar.style.width = "0%";
                                        }, 1000);
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
        let progressBar = document.getElementById(`progress-${file.hash}`);
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
                progressBar.style.color = "transparent";
                progressBar.style.width = "0%";
            }, 500);
            a.click();
        })
        .catch((err) => console.error(err));
    })
}

function newFile(file) {
    let tr = document.createElement('tr');
    tr.id = file.hash;
    let tdName = document.createElement('td');
    let tdSize = document.createElement('td');
    let tdDate = document.createElement('td');
    let tdSharing = document.createElement('td');
    tdSharing.style.textAlign = "center";
    let tdDownload = document.createElement('td');
    tdDownload.style.textAlign = "center";
    let tdDelete = document.createElement('td');
    tdDelete.style.textAlign = "center";
    let sharingButton = document.createElement('button');
    sharingButton.innerHTML = `<i class="fa-solid fa-arrow-up-right-from-square"></i>`;
    let downloadButton = document.createElement('button');
    downloadButton.innerHTML = `<i class="fa-solid fa-download"></i>`;
    let deleteButton = document.createElement('button');
    deleteButton.innerHTML = `<i class="fa-solid fa-trash"></i>`;
    let tdNameInnerDiv = document.createElement('div');
    tdNameInnerDiv.className = "name";
    let tdNameInnerDivProgress = document.createElement('div');
    tdNameInnerDivProgress.className = "progress";
    tdNameInnerDivProgress.style.width = "0%";
    tdNameInnerDivProgress.id = `progress-${file.hash}`;
    let tdNameInnerI = document.createElement('i');
    tdNameInnerI.className = handleMimeIcon(file.mime);
    let tdNameInnerH3 = document.createElement('h3');
    tdNameInnerH3.innerText = file.name;
    tdNameInnerDiv.appendChild(tdNameInnerDivProgress);
    tdNameInnerDiv.appendChild(tdNameInnerI);
    tdNameInnerDiv.appendChild(tdNameInnerH3);
    tdName.appendChild(tdNameInnerDiv);
    let tdSizeInnerH3 = document.createElement('h3');
    tdSizeInnerH3.innerText = handleSizeUnit(file.size);
    tdSize.appendChild(tdSizeInnerH3);
    let tdDateInnerH3 = document.createElement('h3');
    let date = new Date(file.date);
    tdDateInnerH3.innerText = date.getDate()
        + "/" + (date.getMonth() + 1)
        + "/" + date.getFullYear()
        + " " + date.getHours()
        + ":" + date.getMinutes()
        + ":" + date.getSeconds();
    tdDate.appendChild(tdDateInnerH3);
    sharingButton.style.backgroundColor = "rgba(37, 172, 80, 0.555)";
    sharingButton.addEventListener('click', () => {
        shareButtonClick(file);
    });
    tdSharing.appendChild(sharingButton);
    downloadButton.style.backgroundColor = "rgba(14, 116, 250, 0.658)";
    downloadButton.addEventListener('click', () => {
        downloadFile(file);
    });
    tdDownload.appendChild(downloadButton);
    deleteButton.style.backgroundColor = "rgba(224, 12, 48, 0.682)";
    deleteButton.addEventListener('click', () => {
        fetch("/api/metadata", {method: "DELETE", body: JSON.stringify(file)})
        .then(response => response.json())
        .then(() => {
            showSnack(`Deleted ${file.name}`, snackbarRed);
            tr.remove();
        })
    });
    tdDelete.appendChild(deleteButton);
    tr.appendChild(tdName);
    tr.appendChild(tdSize);
    tr.appendChild(tdDate);
    tr.appendChild(tdSharing);
    tr.appendChild(tdDelete);
    tr.appendChild(tdDownload);
    return tr;
}

window.onload = () => {
    fetch("/api/metadata")
    .then(response => response.json())
    .then(data => {
        data.forEach(file => {
            let newFile = newFile(file);
            fileView.appendChild(newFile);
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
