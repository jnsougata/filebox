let uploadButton = document.querySelector("#new-upload");
let folderButton = document.querySelector("#new-folder");
let uploadInput = document.getElementById("file-input");
let fileView = document.querySelector(".content");
let cardView = document.querySelector(".view");
let snackbar = document.getElementById("snackbar");
let fileOption = document.querySelector(".file-option");
let sidebarLeft =  document.querySelector(".sidebar-left");
let menu =  document.querySelector( '.menu' );
const snackbarRed = "rgb(203, 20, 70)";
const snackbarGreen = "rgb(37, 172, 80)";
const downloadGreen = "#25a03d";
const uploadBlue = "#1549e3";
let hiddenState = true;
let metadata = null;
let contextFile = null;
let folderQueue = [];
let isRenaming = false;

function randomFileHash() {
    return [...Array(16)].map(
        () => Math.floor(Math.random() * 16).toString(16)
    ).join('');
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
        return "";
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

// Progress Bar Handler
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

// File Search Handler
let search = document.getElementById("search");
let resultPanel = document.querySelector(".results");
let inputTimer = null;
search.oninput = (ev) => {
    resultPanel.style.visibility = "visible";
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
                            let child = newFileChild(file)
                            child.onclick = () => {
                                resultPanel.style.visibility = "hidden";
                                cardClick(file.hash);
                            };
                            resultPanel.appendChild(child);
                        }
                    });
                }
            })
        } else {
            resultPanel.style.visibility = "hidden";
        }
    }, 2000);
};

// File / Folder Render Element Handler
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
    if (file.type !== "folder") {
        fileName.contentEditable = "true";
        fileName.spellcheck = false;
    }
    fileName.onclick = (e) => {
        e.stopPropagation();
        isRenaming = true;
    };
    fileName.onblur = (e) => {
        fileRename(e, file.hash);
    };
    fileName.style.fontSize = "15px";
    let fileDetails = document.createElement("p");
    let d = new Date(file.date);
    let date = d.getDate()
        + "/" + (d.getMonth() + 1)
        + "/" + d.getFullYear()
        + " " + d.getHours()
        + ":" + d.getMinutes()
        + ":" + d.getSeconds();
    let size = handleSizeUnit(file.size);
    if (size) {
        fileDetails.innerHTML = `${handleSizeUnit(file.size)}  ${date}`;
    } else {
        fileDetails.innerHTML = `${date}`;
    }
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
    if (file.type == "folder") {
        let deleteButton = document.createElement("div");
        deleteButton.className = "remove";
        let deleteIcon = document.createElement("i");
        deleteIcon.className = "fa-solid fa-trash";
        deleteButton.appendChild(deleteIcon);
        deleteButton.onclick = (e) => {
            deleteFolder(e, file);
        };
        fileDiv.appendChild(deleteButton);
        fileDiv.onclick = () => {
            cardClick(file.hash);
        };
    } else {
        let fileView = document.createElement("div");
        fileView.className = "options";
        let fileViewIcon = document.createElement("i");
        fileViewIcon.className = "fa-solid fa-ellipsis-vertical";
        fileView.appendChild(fileViewIcon);
        fileView.onclick = (e) => {
            e.stopPropagation();
            cardClick(file.hash);
        };
        fileDiv.appendChild(fileView);
    }
    return fileDiv;
}

// Folder Deletion Handler
let folderTarget = {};
function deleteFolder(ev, folder) {
    ev.stopPropagation();
    folderTarget["hash"] = folder.hash;
    if (folder.parent) {
        folderTarget["children_path"] = `${folder.parent}/${folder.name}`;
        folderTarget["self_path"] = `/${folder.parent}/${folder.name}`;
    } else {
        folderTarget["children_path"] = `${folder.name}`;
        folderTarget["self_path"] = `/${folder.name}`;
    }
    let title = document.querySelector("#confirm_title")
    title.innerHTML = `Permanently delete ${folderTarget.self_path} and all files inside it?`;
    document.querySelector(".warning").style.display = "flex";
}

let confirmButton = document.querySelector("#confirm_yes");
confirmButton.onclick = () => {
    fetch(`/api/remove/folder`, {
        method: "POST",
        body: JSON.stringify(folderTarget),
    } )
    .then(() => {
        document.querySelector(".warning").style.display = "none";
        document.getElementById(`file-${folderTarget.hash}`).remove();
        showSnack(`Deleted ${folderTarget.self_path}`, snackbarRed);
    })
};

let cancelButton = document.querySelector("#confirm_no");
cancelButton.onclick = () => {
    document.querySelector(".warning").style.display = "none";
    folderTarget = null;
}


// File Menu Options Handlers
let fileOptionClose = document.querySelector("#close-option");
let fileOptionTitle = document.querySelector("#title-option");
let fileOptionMime = document.querySelector("#mime-option");
let fileDelteOption = document.querySelector("#delete-option");
let fileEmbedOption = document.querySelector("#embed-option");
let fileShareOption = document.querySelector("#copy-option");
let fileDownloadOption = document.querySelector("#download-option");

function cardClick(hash) {
    if (isRenaming) {
        return;
    }
    contextFile = metadata[hash];
    if (contextFile.type !== "folder") {
        fileOptionTitle.innerHTML = contextFile.name;
        fileOptionMime.innerHTML = contextFile.mime;
        fileOption.style.visibility = "visible";
    } else {
        folderQueue.push(metadata[hash]);
        folderClick(metadata[hash]);
    }
}

fileOptionClose.onclick = () => {
    fileOption.style.visibility = "hidden";
};

fileDownloadOption.onclick = () => {
    downloadFile(contextFile);
    fileOption.style.visibility = "hidden";
};
fileDelteOption.onclick = () => {
    deleteFile(contextFile);
    fileOption.style.visibility = "hidden";
};
fileShareOption.onclick = () => {
    shareButtonClick(contextFile);
};
fileEmbedOption.onclick = () => {
    if (contextFile.size > 1024 * 1024 * 5) {
        showSnack("File is too big to embed", snackbarRed);
        return;
    }
    window.navigator.clipboard.writeText(`${window.location.protocol}//${window.location.host}/api/embed/${contextFile.hash}`)
    .then(() => {
        showSnack(`Embed url copied to clipboard`);
    });
};

// Promt Path Handler
let pathPrompt = document.querySelector(".fragment");
function folderClick(folder) {
    fileOption.style.visibility = "hidden";
    if (folder.parent) {
        pathPrompt.innerHTML = `/${folder.parent}/${folder.name}/`;
        handleFolderClick(`${folder.parent}/${folder.name}`);
    } else {
        pathPrompt.innerHTML = `/${folder.name}/`;
        handleFolderClick(folder.name);
    }
}

// Prompt Back Button Handler
let previousFolderButton = document.querySelector("#previos_folder");
previousFolderButton.onclick = () => {
    fileOption.style.visibility = "hidden";
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

// Folder Click Handler
function handleFolderClick(parent) {
    fetch(`/api/folder`, {
        method: "POST",
        body: JSON.stringify({parent: parent})
    })
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

// Drag and Drop Handler
uploadButton.addEventListener('click', () => {
    uploadInput.click();
});

uploadInput.addEventListener('change', () => {
    let files = uploadInput.files;
    for (let i = 0; i < files.length; i++) {
        uploadFile(files[i]);
    }
});

// Folder Create Handler
folderButton.onclick = () => {
    let folderName = prompt("Enter folder name");
    if (folderName) {
        let folderData = {
            name: folderName,
            hash: randomFileHash(),
            date: new Date().toISOString(),
            type: "folder",
            parent: ""
        }
        if (folderQueue.length > 0) {
            let folder = folderQueue[folderQueue.length - 1];
            if (folder.parent) {
                folderData.parent = `${folder.parent}/${folder.name}`;
            } else {
                folderData.parent = folder.name;
            }
        }
        metadata[folderData.hash] = folderData;
        cardView.appendChild(newFileChild(folderData));
        fetch(`/api/metadata`, {
            method: "POST",
            body: JSON.stringify(folderData),
        }).then(() => {
            showSnack(`Folder ${folderName} created!`);
        });
    }
};

// File Rename Handler
function fileRename(e, hash) {
    let oldName = metadata[hash].name;
    let oldNameExtension = oldName.split(".").pop();
    let updatedName = e.target.innerHTML;
    let updatedExtension = updatedName.split(".").pop();
    if (oldNameExtension !== updatedExtension) {
        e.target.innerHTML = oldName;
        showSnack("File extension cannot be changed", snackbarRed);
        isRenaming = false;
        return;
    }
    if (updatedName === oldName) {
        isRenaming = false;
        return;
    }
    let payload = {
        hash: hash,
        name: updatedName
    }
    fetch(`/api/rename`, {
        method: "POST",
        body: JSON.stringify(payload),
    })
    .then((res) => {
        isRenaming = false;
        if (res.status === 200) {
            metadata[hash].name = updatedName;
            showSnack(`File renamed to ${updatedName}`);
        } else {
            return;
        }
    })
}

let isToggled =  false ;
menu.addEventListener( 'click' ,  (e) => {
    if (isToggled) {
        sidebarLeft.style.display =  'none' ;
        isToggled =  false ;
    }  else  {
        sidebarLeft.style.display =  'flex' ;
        fileOption.style.visibility =  'hidden' ;
        isToggled =  true ;
    }
} );

let logo = document.querySelector(".logo");
logo.onclick = () => {
    window.open("https://github.com/jnsougata/filebox", "_blank");
}
