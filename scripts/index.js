let uploadButton = document.getElementById('upload');
let uploadInput = document.getElementById('file-input');
let fileView = document.getElementById('files');
let snackbar = document.getElementById("snackbar");
const snackbarRed = "rgb(203, 20, 70)";
const snackbarGreen = "rgb(37, 172, 80)";
const downloadGreen = "#25a03d";
const uploadBlue = "#1549e3";
let hiddenState = true;

function randomFileHash() {
    return [...Array(16)].map(
        () => Math.floor(Math.random() * 16).toString(16)
    ).join('');
}

uploadButton.addEventListener('click', () => {
    uploadInput.click();
});

uploadInput.addEventListener('change', () => {
    let files = uploadInput.files;
    for (let i = 0; i < files.length; i++) {
        uploadFile(files[i]);
    }
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
                        setTimeout(() => {
                            showSnack(`Uploaded ${file.name}`);
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
                                        showSnack(`Uploaded ${file.name} successfully!`);
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
    card.className = "card";
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
    let operations = document.createElement("div");
    operations.className = "operations";
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
    operations.appendChild(deleteButton);
    operations.appendChild(shareButton);
    operations.appendChild(downloadButton);
    let progress = document.createElement("div");
    progress.className = "progress";
    progress.id = `progress-${file.hash}`;
    let bar = document.createElement("div");
    bar.className = "bar";
    bar.id = `bar-${file.hash}`;
    progress.appendChild(bar);
    card.appendChild(icon);
    card.appendChild(details);
    card.appendChild(operations);
    card.appendChild(progress);
    return card;
}

function newFolder(data) {
    let card = document.createElement("div");
    card.id = `folder-${data.hash}`;
    card.className = "card";
    let icon = document.createElement("div");
    icon.className = "icon";
    let i = document.createElement("i");
    i.className = "fa-solid fa-folder";
    icon.appendChild(i);
    let details = document.createElement("div");
    details.className = "details";
    let name = document.createElement("span");
    name.innerHTML = data.name;
    let date = document.createElement("span");
    let d = new Date(data.date);
    date.innerText = d.getDate()
        + "/" + (d.getMonth() + 1)
        + "/" + d.getFullYear()
        + " " + d.getHours()
        + ":" + d.getMinutes()
        + ":" + d.getSeconds();
    details.appendChild(name);
    details.appendChild(date);
    card.appendChild(icon);
    card.appendChild(details);
    card.onclick = () => {
        folderClick(data);
    };
    return card;
}

window.onload = () => {
    hiddenState = true;
    searchBar.style.display = "none";
    fetch("/api/metadata")
    .then(response => response.json())
    .then(data => {
        let folders = [];
        let files = [];
        data.forEach(file => {
            if (file.type === "folder") {
                folders.push(file);
            } else {
                files.push(file);
            }
        });
        files.forEach(file => {
            fileView.appendChild(newFile(file));
        });
        folders.forEach(folder => {
            fileView.appendChild(newFolder(folder));
        });
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
    } else if (mime.startsWith("application/x-rar-compressed")) {
        return "fa-solid fa-file-zipper";
    } else if (mime.startsWith("font")) {
        return "fa-solid fa-font";
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

fileView.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
});

fileView.addEventListener("drop", (e) => {
    e.preventDefault();
    if (e.dataTransfer.items) {
        [...e.dataTransfer.items].forEach((item) => {
            uploadFile(item.getAsFile());
        })
    }
});

window.addEventListener("paste", (e) => {
    let items = e.clipboardData.items;
    if (items) {
        [...items].forEach((item) => {
            if (item.kind === "file") {
                uploadFile(item.getAsFile());
            }
        })
    }
});

function showSnack(inner, color = snackbarGreen) {
    snackbar.innerHTML = inner;
    snackbar.style.backgroundColor = color;
    snackbar.style.visibility = "visible";
    setTimeout(() => {
        snackbar.style.visibility = "hidden";
    }, 3000);
}

function shareButtonClick(file) {
    if (file.size > 1024 * 1024 * 30) {
        showSnack("File is too big to share", snackbarRed);
        return;
    }
    window.navigator.clipboard.writeText(window.location.href + "download/" + file.hash)
        .then(() => {
            showSnack(`URL copied to clipboard`);
        });
}

function deleteFile(file) {
    fetch(`/api/metadata`, {
        method: "DELETE",
        body: JSON.stringify(file),
    })
    .then(() => {
        showSnack(`Deleted ${file.name}`, snackbarRed);
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

let searchBar = document.getElementById("search-bar");
let toggle = document.getElementById("search-toggle");
toggle.onclick = () => {
    if (hiddenState) {
        toggle.innerHTML = `<i class="fa-solid fa-chevron-up"></i>`;
        hiddenState = false;
        searchBar.style.display = "flex";
        fileView.style.display = "none";
    } else {
        toggle.innerHTML = `<i class="fa-solid fa-search"></i>`;
        hiddenState = true;
        searchBar.style.display = "none"
        fileView.style.display = "flex";
    }
};

let search = document.getElementById("search");
let resultPanel = document.getElementById("result-panel");
let inputTimer = null;
search.oninput = (ev) => {
    if (inputTimer) {
        clearTimeout(inputTimer);
    }
    inputTimer = setTimeout(() => {
        if (ev.target.value.length > 0) {
            fetch(`/api/query`, {
                method: "POST",
                body: JSON.stringify({"name?contains": ev.target.value}),
            })
            .then(response => response.json())
            .then(data => {
                let folders = [];
                let files = [];
                data.forEach(file => {
                    if (file.type === "folder") {
                        folders.push(file);
                    } else {
                        files.push(file);
                    }
                });
                if (files.length || folders.length) {
                    resultPanel.innerHTML = "";
                    resultPanel.style.justifyContent = "flex-start";
                    files.forEach(file => {
                        resultPanel.appendChild(newFile(file));
                    });
                    folders.forEach(folder => {
                        resultPanel.appendChild(newFolder(folder));
                    });
                } else {
                    resultPanel.style.justifyContent = "center";
                    resultPanel.innerHTML = `👀 No results found . . .`;
                }
            })
        }
    }, 2000);
};

let newFolderButton = document.getElementById("new-folder");
newFolderButton.onclick = () => {
    let folderName = prompt("Enter folder name");
    if (folderName === "dir") {
        showSnack("`dir` is a reserved word", snackbarRed)
        return
    }
    if (folderName) {
        let folderData = {
            name: folderName,
            hash: randomFileHash(),
            date: new Date().toISOString(),
            type: "folder",
        }
        fileView.appendChild(newFolder(folderData));
        fetch(`/api/metadata`, {
            method: "POST",
            body: JSON.stringify(folderData),
        }).then(() => {
            showSnack(`Folder ${folderName} created!`);
        });
    }
};

function folderClick(data) {
    if (data.parent) {
        window.location.href = `${window.location.href}dir/${data.parent}/${data.name}`;
    } else {
        window.location.href = `${window.location.href}dir/${data.name}`;
    }
}