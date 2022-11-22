let uploadButton = document.getElementById('upload');
let uploadInput = document.getElementById('file-input');
let fileView = document.querySelector('.content');
let cardView = document.querySelector('.cards');
let snackbar = document.getElementById("snackbar");
const snackbarRed = "rgb(203, 20, 70)";
const snackbarGreen = "rgb(37, 172, 80)";
const downloadGreen = "#25a03d";
const uploadBlue = "#1549e3";
let hiddenState = true;
let metadata = null;
let contextFile = null;
let folderQueue = [];

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

let headerLeft = document.querySelector(".left");
headerLeft.onclick = () => {
    window.open("https://github.com/jnsougata/filebox", "_blank");
}

function uploadFile(file) {
    fetch("/api/secret")
    .then(response => response.text())
    .then(token => {
        showSnack(`Uploading ${file.name}`);
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
            if (folderQueue.length > 0) {
                let folder = folderQueue[folderQueue.length - 1];
                if (folder.parent) {
                    body.parent = `${folder.parent}/${folder.name}`;
                } else {
                    body.parent = folder.name;
                }
            }
            metadata[hash] = body;
            let content = ev.target.result;
            cardView.appendChild(newFileChild(body));
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

window.onload = () => {
    hiddenState = true;
    document.querySelector(".search").display = "none";
    fetch("/api/metadata")
    .then(response => response.json())
    .then(data => {
        metadata = {};
        let folders = [];
        let files = [];
        data.forEach(file => {
            if (!file.parent) {
                metadata[file.hash] = file;
                if (file.type === "folder") {
                    folders.push(file);
                } else {
                    files.push(file);
                }
            }
        });
        let items = folders.concat(files);
        items.forEach(file => {
            cardView.appendChild(newFileChild(file));
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
    if (size === undefined) {
        return "n/a";
    }
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

cardView.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
});

cardView.addEventListener("drop", (e) => {
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

window.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "z") {
        previousFolderButton.click();
    }
})

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
        document.getElementById(`file-${file.hash}`).remove();
    })
}

function renderBarMatrix(hash, color) {
    let progressBar = document.getElementById(`progress-${hash}`);
    progressBar.style.display = "flex";
    let bar = document.getElementById(`bar-${hash}`);
    bar.style.backgroundColor = color;
}

function hideBarMatrix(hash) {
    let progressBar = document.getElementById(`progress-${hash}`);
    progressBar.style.display = "none";
    let bar = document.getElementById(`bar-${hash}`);
    bar.style.width = "0%";
}

let searchBar = document.querySelector(".search");
let toggle = document.querySelector("#toggle");
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
let resultPanel = document.getElementById("results");
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
                if (data.length === 0) {
                    resultPanel.innerHTML = `<div class="no-result" style="color: #ef5151; font-size: 15px; margin-top: 15px;">👀 No results found</div>`;
                } else {
                    resultPanel.innerHTML = "";
                    data.forEach(file => {
                        if (file.type !== "folder") {
                            metadata[file.hash] = file;
                            resultPanel.appendChild(newFileChild(file));
                            resultPanel.onclick = (e) => {
                                toggle.click();
                            };
                        }
                    });
                }
            })
        }
    }, 2000);
};

let newFolderButton = document.getElementById("folder");
newFolderButton.onclick = () => {
    let folderName = prompt("Enter folder name");
    if (folderName) {
        let folderData = {
            name: folderName,
            hash: randomFileHash(),
            date: new Date().toISOString(),
            type: "folder",
            parent: ""
        }
        cardView.appendChild(newFileChild(folderData));
        fetch(`/api/metadata`, {
            method: "POST",
            body: JSON.stringify(folderData),
        }).then(() => {
            showSnack(`Folder ${folderName} created!`);
        });
    }
};

function newFileChild(file) {
    let fileDiv = document.createElement("div");
    fileDiv.id = `file-${file.hash}`;
    fileDiv.className = "card";
    let iconDiv = document.createElement("div");
    iconDiv.className = "icon";
    let icon = document.createElement("i");
    if (file.type === "folder") {
        icon.className = "fa-solid fa-folder";
    } else {
        icon.className = handleMimeIcon(file.mime);
    }
    iconDiv.appendChild(icon);
    let detailsDiv = document.createElement("div");
    detailsDiv.className = "details";
    let fileName = document.createElement("p");
    fileName.innerHTML = file.name;
    let fileDetails = document.createElement("p");
    let d = new Date(file.date);
    let date = d.getDate()
        + "/" + (d.getMonth() + 1)
        + "/" + d.getFullYear()
        + " " + d.getHours()
        + ":" + d.getMinutes()
        + ":" + d.getSeconds();
    fileDetails.innerHTML = `
    <i class="fa-solid fa-database" style="margin-left: 0"></i> ${handleSizeUnit(file.size)}
    <i class="fa-solid fa-calendar"></i> ${date}
    `;
    let progressBar = document.createElement("div");
    progressBar.id = `progress-${file.hash}`;
    progressBar.className = "progress";
    let bar = document.createElement("div");
    bar.id = `bar-${file.hash}`;
    bar.className = "bar";
    progressBar.appendChild(bar);
    progressBar.style.display = "none";
    detailsDiv.appendChild(fileName);
    detailsDiv.appendChild(fileDetails);
    detailsDiv.appendChild(progressBar);
    fileDiv.appendChild(iconDiv);
    fileDiv.appendChild(detailsDiv);
    fileDiv.onclick = () => {
        cardClick(file.hash);
    };
    return fileDiv;
}

let sidebar = document.querySelector(".side");
let crossButton = document.querySelector("#cross");
let navTitle = document.querySelector("#sidenav_title");
let navFileSize = document.querySelector("#sidenav_size");
let navFileDate = document.querySelector("#sidenav_date");
let navFileHash = document.querySelector("#sidenav_hash");
let navFileMime = document.querySelector("#sidenav_mime");
let navFileParent = document.querySelector("#sidenav_parent");
let navIcon = document.querySelector("#sidenav_icon");
let navDownloadButton = document.querySelector("#sidenav_download");
let navDeleteButton = document.querySelector("#sidenav_delete");
let navCopyButton = document.querySelector("#sidenav_copy");
let navEmbedButton = document.querySelector("#sidenav_embed");

function cardClick(hash) {
    contextFile = metadata[hash];
    if (contextFile.type !== "folder") {
        navTitle.innerHTML = contextFile.name;
        navFileSize.innerHTML = handleSizeUnit(contextFile.size);
        let d = new Date(contextFile.date);
        navFileDate.innerHTML = d.getDate()
            + "/" + (d.getMonth() + 1)
            + "/" + d.getFullYear()
            + " " + d.getHours()
            + ":" + d.getMinutes()
            + ":" + d.getSeconds();
        navFileHash.innerHTML = contextFile.hash;
        if (contextFile.parent) {
            navFileParent.innerHTML = contextFile.parent;
        }
        navFileMime.innerHTML = contextFile.mime;
        navIcon.className = handleMimeIcon(contextFile.mime);
        sidebar.style.display = "flex";
    } else {
        folderQueue.push(metadata[hash]);
        folderClick(metadata[hash]);
    }
}

crossButton.onclick = () => {
    sidebar.style.display = "none";
};
navDownloadButton.onclick = () => {
    downloadFile(contextFile);
    sidebar.style.display = "none";
};
navDeleteButton.onclick = () => {
    deleteFile(contextFile);
    sidebar.style.display = "none";
};
navCopyButton.onclick = () => {
    shareButtonClick(contextFile);
    sidebar.style.display = "none";
};
navEmbedButton.onclick = () => {
    if (contextFile.size > 1024 * 1024 * 5) {
        showSnack("File is too big to embed", snackbarRed);
        return;
    }
    window.navigator.clipboard.writeText(`${window.location.protocol}//${window.location.host}/api/embed/${contextFile.hash}`)
    .then(() => {
        showSnack(`Embed url copied to clipboard`);
    });
};

let pathPrompt = document.querySelector(".fragment");
function folderClick(folder) {
    if (folder.parent) {
        pathPrompt.innerHTML = `/${folder.parent}/${folder.name}/`;
        handleFolderClick(`${folder.parent}/${folder.name}`);
    } else {
        pathPrompt.innerHTML = `/${folder.name}/`;
        handleFolderClick(folder.name);
    }
}
let previousFolderButton = document.querySelector("#previos_folder");
previousFolderButton.onclick = () => {
    if (folderQueue.length > 1) {
        folderQueue.pop();
        let folder = folderQueue[folderQueue.length - 1];
        if (folder.parent) {
            pathPrompt.innerHTML = `/${folder.parent}/${folder.name}/`;
            handleFolderClick(`${folder.parent}/${folder.name}`);
        } else {
            pathPrompt.innerHTML = `/${folder.name}/`;
            handleFolderClick(folder.name);
        }
    } else if (folderQueue.length === 1) {
        pathPrompt.innerHTML = `/`;
        folderQueue.pop();
        fetch("/api/metadata")
        .then(response => response.json())
        .then(data => {
            for (let file of Object.values(metadata)) {
                let fileDiv = document.getElementById(`file-${file.hash}`);
                cardView.removeChild(fileDiv);
            }
            metadata = {};
            let folders = [];
            let files = [];
            data.forEach(file => {
                if (!file.parent) {
                    metadata[file.hash] = file;
                    if (file.type === "folder") {
                        folders.push(file);
                    } else {
                        files.push(file);
                    }
                }
            });
            let items = folders.concat(files);
            items.forEach(file => {
                cardView.appendChild(newFileChild(file));
            });
        })
    }
};

function handleFolderClick(parent) {
    fetch(`/api/folder/${parent}`)
    .then(res => res.json())
    .then(data => {
        for (let file of Object.values(metadata)) {
            let fileDiv = document.getElementById(`file-${file.hash}`);
            cardView.removeChild(fileDiv);
        }
        metadata = {};
        let folders = [];
        let files = [];
        data.forEach(file => {
            metadata[file.hash] = file;
            if (file.type === "folder") {
                folders.push(file);
            } else {
                files.push(file);
            }
        });
        let items = folders.concat(files);
        items.forEach(file => {
            cardView.appendChild(newFileChild(file));
        });
    })
}
