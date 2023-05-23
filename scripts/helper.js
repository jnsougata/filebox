let controller;
let fileSender = document.querySelector('.file_sender');
let fileOptionPanel = document.querySelector('.file_menu');
let queueTaskList = document.querySelector('#queue-task-list');


// function sendNotification(body, tag = 'filebox') {
//     let enabled = Notification.permission === 'granted';
//     if (!enabled) {
//         return;
//     }
//     new Notification("Filebox", {
//         body: body,
//         tag: tag || 'filebox',
//         icon: '/assets/icon.png',
//     });
// }

function dateStringToTimestamp(dateString) {
    let date = new Date(dateString);
    return date.getTime();
}

function sortFileByTimestamp(data) {
    data = data.filter((file) => {
        return !(file.type === 'folder');
    });
    data = data.sort((a, b) => {
        return dateStringToTimestamp(b.date) - dateStringToTimestamp(a.date);
    });
    return data;
}

async function checkFileParentExists(file) {
    let body = {"type": "folder"}
    if (!file.parent) {
        return false;
    }
    let fragments = file.parent.split("/");
    if (fragments.length === 1) {
        body["name"] = file.parent;
    } else {
        body["name"] = fragments[fragments.length - 1];
        body["parent"] = fragments.slice(0, fragments.length - 1).join("/");
    }
    let resp = await fetch(`/api/query`, {method: "POST", body: JSON.stringify(body)});
    let data = await resp.json();
    if (!data) {
        return false;
    }
    return true;
}

function updateFolderStats(folders) {
    if (folders.length === 0) {
        return;
    }
    fetch(`/api/items/count`, {method: "POST", body: JSON.stringify(folders)})
    .then((resp) => resp.json())
    .then((stats) => {
        stats.forEach((stat) => {
            let statElem = document.getElementById(`stat-${stat.hash}`);
            if (statElem) {
                let old = statElem.innerHTML;
                statElem.innerHTML = `${stat.count} items • ${old}`
            }
        }); 
    })  
}

function handleSizeUnit(size) {
    if (size === undefined) {
        return "~";
    }
    if (size < 1024) {
        return size + " B";
    } else if (size < 1024 * 1024) {
        return (size / 1024).toFixed(2) + " KB";
    } else if (size < 1024 * 1024 * 1024) {
        return (size / 1024 / 1024).toFixed(2) + " MB";
    } else {
        return (size / 1024 / 1024 / 1024).toFixed(2) + " GB";
    }
}

function formatDateString(date) {
    date = new Date(date);
    return `
        ${date.toLocaleString('default', { month: 'short' })} 
        ${date.getDate()}, 
        ${date.getFullYear()} 
        ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}
    `;

}

function updateSpaceUsage(incr) {
    globalConsumption += incr;
    totalSizeWidget.innerText = `${handleSizeUnit(globalConsumption)}`;
}

function setIconByMime(mime, elem) {
    if (mime === undefined) {
        elem.innerHTML = `<span class="material-symbols-rounded">folder</span>`;
    } else if (mime.startsWith("image")) {
        elem.innerHTML = `<span class="material-symbols-rounded">image</span>`;
    } else if (mime.startsWith("video")) {
        elem.innerHTML = `<span class="material-symbols-rounded">movie</span>`;
    } else if (mime.startsWith("audio")) {
        elem.innerHTML = `<span class="material-symbols-rounded">music_note</span>`;
    } else if (mime.startsWith("text")) {
        elem.innerHTML = `<span class="material-symbols-rounded">text_snippet</span>`;
    } else if (mime.startsWith("application/pdf")) {
        elem.innerHTML = `<span class="material-symbols-rounded">book</span>`;
    } else if (mime.startsWith("application/zip")) {
        elem.innerHTML = `<span class="material-symbols-rounded">archive</span>`;
    } else if (mime.startsWith("application/x-rar-compressed")) {
        elem.innerHTML = `<span class="material-symbols-rounded">archive</span>`;
    } else if (mime.startsWith("font")) {
        elem.innerHTML = `<span class="material-symbols-rounded">format_size</span>`;
    } else {
        elem.innerHTML = `<span class="material-symbols-rounded">draft</span>`;
    }
}

function downloadFolderAsZip(folder) {
    let childrenPath = folder.parent ? `${folder.parent}/${folder.name}` : folder.name;
    fetch(`/api/query`, {
        method: "POST", 
        body: JSON.stringify({
            "parent": childrenPath,
            "type?ne": "folder",
            "deleted?ne": true,
            "shared?ne": true,
        })}
    )
    .then((resp) => resp.json())
    .then((data) => {
        if (!data) {
            showSnack("Folder is empty", colorOrange, "info");
            return;
        }
        let zip = new JSZip();
        let totalSize = 0;
        data.forEach((file) => {
            totalSize += parseInt(file.size);
        });
        let zipData = {
            name: `${folder.name}-${folder.hash}.zip`,
            mime: 'application/zip',
            size: totalSize,
            hash: folder.hash,
        }
        prependQueueElem(zipData);
        blurLayer.click();
        queueButton.click();
        let promises = [];
        let completed = 0;
        data.forEach((file) => {
            promises.push(
                fetchFileFromDrive(file, (cmp) => {
                    completed += cmp;
                    let percentage = Math.round(completed / totalSize * 100);
                    progressHandlerById(zipData.hash, percentage);
                })
                .then((blob) => {
                    zip.file(file.name, new Blob([blob], {type: file.mime}));
                })
            );
        });
        Promise.all(promises)
        .then(() => {
            zip.generateAsync({type:"blob"})
            .then((content) => {
                let a = document.createElement('a');
                a.href = window.URL.createObjectURL(content);
                a.download = zipData.name;
                a.click();
            });
        })
    })
}

function handleStartup(key) {
    globalSecretKey = key;
    globalUserIdParts = /-(.*?)\./.exec(window.location.hostname);
    if (globalUserIdParts) {
        globalUserId = globalUserIdParts[1];
    }
    document.querySelector('#username').innerHTML = globalUserId ? globalUserId : 'Anonymous';
    fetch("/api/consumption")
    .then(response => response.json())
    .then(data => {
        updateSpaceUsage(data.size);
    })
    recentButton.click();
}

function handleTrashFileMenuClick(file) {
    fileOptionPanel.innerHTML = "";
    fileOptionPanel.id = `panel-${file.hash}`;
    blurLayer.style.display = 'block';
    let title = document.createElement("div");
    title.className = "title";
    let fileNameElem = document.createElement("p");
    fileNameElem.innerHTML = file.name;
    title.appendChild(fileNameElem);
    let close = document.createElement("span");
    close.className = `material-symbols-rounded`;
    close.innerHTML = `chevron_right`;
    close.addEventListener("click", () => {
        fileOptionPanel.style.display = 'none';
        blurLayer.style.display = 'none';
    });
    title.appendChild(close);
    fileOptionPanel.appendChild(title);
    let restore = document.createElement("div");
    restore.className = "file_menu_option";
    restore.innerHTML = `<p>Restore</p><span class="material-symbols-rounded">replay</span>`;
    restore.addEventListener("click", () => {
        checkFileParentExists(file)
        .then((exists) => {
            if (!exists && file.parent !== undefined) {
                showSnack(`Parent not found. Restoring to root`, colorOrange, 'warning');
                delete file.parent;
                delete file.deleted;
            } else {
                delete file.deleted;
            }
            fetch(`/api/metadata`, {method: "PATCH", body: JSON.stringify(file)})
            .then(() => {
                showSnack(`Restored ${file.name}`, colorGreen, 'success');
                document.getElementById(`file-${file.hash}`).remove();
                close.click();
                globalTrashFiles = globalTrashFiles.filter((f) => f.hash !== file.hash);
            })
        })
    });
    let deleteButton = document.createElement("div");
    deleteButton.className = "file_menu_option";
    deleteButton.innerHTML = `<p>Delete Permanently</p><span class="material-symbols-rounded">delete_forever</span>`;
    deleteButton.addEventListener("click", () => {
        fetch(`/api/metadata`, {method: "DELETE", body: JSON.stringify(file)})
        .then(() => {
            showSnack(`Permanently deleted ${file.name}`, colorRed, 'info');
            document.getElementById(`file-${file.hash}`).remove();
            if (!file.shared) {
                updateSpaceUsage(-file.size);
            }
            close.click();
            globalTrashFiles = globalTrashFiles.filter((f) => f.hash !== file.hash);
            if (globalTrashFiles.length === 0) {
                renderOriginalNav();
            }
        })
    });
    fileOptionPanel.appendChild(restore);
    fileOptionPanel.appendChild(deleteButton);
    fileOptionPanel.style.display = 'flex';
}

function handleFileMenuClick(file) {
    fileOptionPanel.innerHTML = "";
    fileOptionPanel.id = `panel-${file.hash}`;
    blurLayer.style.display = 'block';

    // Title
    let title = document.createElement("div");
    title.className = "title";
    let fileNameElem = document.createElement("p");
    fileNameElem.innerHTML = file.name;
    title.appendChild(fileNameElem);
    let close = document.createElement("span");
    close.className = `material-symbols-rounded`;
    close.innerHTML = `chevron_right`;
    close.addEventListener("click", () => {
        fileOptionPanel.style.display = 'none';
        blurLayer.style.display = 'none';
    });
    title.appendChild(close);
    fileOptionPanel.appendChild(title);

    // Access
    let visibilityOption = document.createElement("div");
    visibilityOption.className = "file_menu_option";
    let visibility = file.access === 'private' ? 'visibility_off' : 'visibility';
    visibilityOption.innerHTML = `<p>Access</p><span class="material-symbols-rounded">${visibility}</span>`;
    visibilityOption.addEventListener("click", () => {
        if (file.access === 'private') {
            file.access = 'public';
            visibilityOption.innerHTML = `<p>Access</p><span class="material-symbols-rounded">visibility</span>`;
            share.style.opacity = 1;
            if (file.size > 1024 * 1024 * 4) {
                embed.style.opacity = 0.3;
            } else {
                embed.style.opacity = 1;
            }
            showSnack("Access changed to public", colorGreen, 'info');
        } else {
            file.access = 'private';
            visibilityOption.innerHTML = `<p>Access</p><span class="material-symbols-rounded">visibility_off</span>`;
            share.style.opacity = 0.3;
            embed.style.opacity = 0.3;
            showSnack("Access changed to private", colorOrange, 'info');
        }
        fetch(`/api/file/access`, {
            method: "PATCH", 
            body: JSON.stringify({hash: file.hash, access: file.access})
        })
    });
    if (file.type !== 'folder') {
        fileOptionPanel.appendChild(visibilityOption);
    }

    // Bookmark
    let bookmarkMode = file.pinned ? 'remove' : 'add';
    let bookmarkOption = document.createElement("div");
    bookmarkOption.className = "file_menu_option";
    bookmarkOption.innerHTML = `<p>Pin</p><span class="material-symbols-rounded">${bookmarkMode}</span>`;
    bookmarkOption.addEventListener("click", () => {
        if (file.pinned) {
            fetch(`/api/bookmark/${file.hash}`, {method: "DELETE"})
            .then(() => {
                showSnack(`Unpinned successfully`, colorOrange, 'info');
                let card = document.getElementById(`card-${file.hash}`);
                if (card) {
                    card.remove();
                }
                delete file.pinned;
                bookmarkOption.innerHTML = `<p>Bookmark</p><span class="material-symbols-rounded">add</span>`;
            })
        } else {
            fetch(`/api/bookmark/${file.hash}`, {method: "POST"})
            .then(() => {
                showSnack(`Pinned successfully`, colorGreen, 'success');
                let pins = document.querySelector('.pinned_files');
                if (pins) {
                    pins.appendChild(newFileElem(file));
                }
                file.pinned = true;
                bookmarkOption.innerHTML = `<p>Bookmark</p><span class="material-symbols-rounded">remove</span>`;
            })
        }
    });
    fileOptionPanel.appendChild(bookmarkOption);

    // Share
    let send = document.createElement("div");
    send.className = "file_menu_option";
    send.innerHTML = `<p>Send</p><span class="material-symbols-rounded">send</span>`;
    if (file.type !== "folder") {
        send.addEventListener("click", () => {
            if (file.owner) {
                showSnack("Can't send a file that you don't own", colorOrange, 'info');
                return;
            }
            renderFileSenderModal(file);
        });
        fileOptionPanel.appendChild(send);
    }

    // Rename
    let rename = document.createElement("div");
    rename.className = "file_menu_option";
    rename.innerHTML = `<p>Rename</p><span class="material-symbols-rounded">edit</span>`;
    rename.addEventListener("click", () => {
        fileNameElem.contentEditable = true;
        fileNameElem.spellcheck = false;
        fileNameElem.focus();
        fileNameElem.addEventListener('blur', (e) => {
            fileNameElem.contentEditable = false;
            if (file.name === fileNameElem.innerText) {
                return;
            }
            let extPattern = /\.[0-9a-z]+$/i;
            let oldext = extPattern.exec(file.name);
            oldext = oldext ? oldext[0] : '';
            let newext = extPattern.exec(fileNameElem.innerText);
            newext = newext ? newext[0] : '';
            fileNameElem.contentEditable = false;
            if (oldext !== newext) {
                e.target.innerHTML = file.name;
                showSnack("File extension cannot be changed", colorOrange, 'warning');
                return;
            }
            fetch(`/api/rename`, {
                method: "POST", 
                body: JSON.stringify({hash: file.hash, name: fileNameElem.innerText})
            })
            .then((res) => {
                if (res.status === 200) {
                    file.name = fileNameElem.innerText;
                    document.querySelector(`#filename-${file.hash}`).innerHTML = file.name;
                    showSnack(`File renamed to ${file.name}`, colorGreen, 'success');
                }
            })
        });
    });

    // Download
    let downloadButton = document.createElement("div");
    downloadButton.className = "file_menu_option";
    downloadButton.innerHTML = `<p>Download</p><span class="material-symbols-rounded">download</span>`;
    downloadButton.addEventListener("click", () => {
        close.click();
        prependQueueElem(file, false);
        if (file.shared === true) {
            downloadShared(file, (percentage) => {
                progressHandlerById(file.hash, percentage);
            });
            return;
        }
        download(file, (percentage) => {
            progressHandlerById(file.hash, percentage);
        });
    });

    // Share
    let share = document.createElement("div");
    share.className = "file_menu_option";
    share.innerHTML = `<p>Share Link</p><span class="material-symbols-rounded">link</span>`;
    share.addEventListener("click", () => {
        if (file.access === "private") {
            showSnack(`Make file public to share via link`, colorOrange, 'warning');
        } else {
            window.navigator.clipboard.writeText(`${window.location.origin}/shared/${file.hash}`)
            .then(() => {
                showSnack(`Copied to clipboard`, colorGreen, 'success');
            })
        }
    });

    // Embed
    let embed = document.createElement("div");
    embed.className = "file_menu_option";
    embed.innerHTML = `<p>Embed</p><span class="material-symbols-rounded">code</span>`;
    embed.addEventListener("click", () => {
        if (file.access === "private") {
            showSnack(`Make file public to embed`, colorOrange, 'warning');
        } else if (file.size > 1024 * 1024 * 4) {
            showSnack(`File is too large to embed`, colorRed, 'error');
        } else {
            window.navigator.clipboard.writeText(`${window.location.origin}/api/embed/${file.hash}`)
            .then(() => {
                showSnack(`Copied to clipboard`, colorGreen, 'success');
            })
        }
    });

    // Move
    let move = document.createElement("div");
    move.className = "file_menu_option";
    move.innerHTML = `<p>Move</p><span class="material-symbols-rounded">arrow_forward</span>`;
    move.addEventListener("click", () => {
        close.click();
        renderAuxNav(fileMover(file));
        isFileMoving = true;
        browseButton.click();
    });
    if (file.type !== 'folder') {
        fileOptionPanel.appendChild(rename);
        fileOptionPanel.appendChild(downloadButton);
        if (file.access === 'private') {
            share.style.opacity = 0.3;
        }
        fileOptionPanel.appendChild(share);
        if (file.access === 'private' || file.size > 1024 * 1024 * 4) {
            embed.style.opacity = 0.3;
        }
        fileOptionPanel.appendChild(embed);
        fileOptionPanel.appendChild(move);
    }

    // Download as zip
    let downloadZip = document.createElement("div");
    downloadZip.className = "file_menu_option";
    downloadZip.innerHTML = `<p>Download as Zip</p><span class="material-symbols-rounded">archive</span>`;
    downloadZip.addEventListener("click", () => {
        downloadFolderAsZip(file);
    });
    if (file.type === 'folder') {
        fileOptionPanel.appendChild(downloadZip);
    }

    // Trash
    let trashButton = document.createElement("div");
    trashButton.className = "file_menu_option";
    if (file.type === 'folder') {
        trashButton.innerHTML = `<p>Delete Permanently</p><span class="material-symbols-rounded">delete_forever</span>`;
    } else {
        trashButton.innerHTML = `<p>Trash</p><span class="material-symbols-rounded">delete_forever</span>`;
    }
    trashButton.addEventListener("click", () => {
        if (file.type === 'folder') {
            fetch(`/api/metadata`, {method: "DELETE", body: JSON.stringify(file)})
            .then((resp) => {
                if (resp.status === 409) {
                    showSnack(`Folder is not empty`, colorOrange, 'warning');
                    close.click();
                    return;
                }
                if (resp.status === 200) {
                    showSnack(`Permanently Deleted ${file.name}`, colorRed, 'warning');
                    document.getElementById(`file-${file.hash}`).remove();
                    close.click();
                } 
            })
        } else {
            file.deleted = true;
            fetch(`/api/metadata`, {method: "PATCH", body: JSON.stringify(file)})
            .then(() => {
                showSnack(`Moved to trash ${file.name}`, colorRed, 'warning');
                document.getElementById(`file-${file.hash}`).remove();
                close.click();
            })
        }
    });
    fileOptionPanel.appendChild(trashButton);

    if (file.recipients && file.recipients.length > 0) {
        let p = document.createElement("p");
        p.innerText = "Block Access";
        p.style.fontSize = "14px";
        p.style.color = "white";
        p.style.width = "100%";
        p.style.padding = "10px 20px";
        p.style.backgroundColor = "rgba(242, 58, 58, 0.5)";
        fileOptionPanel.appendChild(p);
        file.recipients.forEach((recipient) => {
            let recipientElem = document.createElement("div");
            recipientElem.className = "file_menu_option";
            recipientElem.innerHTML = `<p>${recipient} </p><span class="material-symbols-rounded">block</span>`;
            recipientElem.addEventListener("click", () => {
                file.recipients = file.recipients.filter((r) => r !== recipient);
                fetch(`/api/metadata`, {method: "PATCH", body: JSON.stringify(file)})
                .then(() => {
                    showSnack(`Blocked access for ${recipient}`, colorOrange, 'warning');
                    recipientElem.remove();
                })
            });
            fileOptionPanel.appendChild(recipientElem);
        });
    }

    fileOptionPanel.style.display = 'flex';
}

function handleFolderClick(folder) {
    fileOptionPanel.style.display = 'none';
    globalContextFolder = folder;
    if (globalFolderQueue.length > 0) {
        let lastFolder = globalFolderQueue[globalFolderQueue.length - 1];
        if (lastFolder.hash !== folder.hash) {
            globalFolderQueue.push(folder);
        }
    } else {
        globalFolderQueue.push(folder);
    }
    let parentOf;
    if (folder.parent) {
        parentOf = `${folder.parent}/${folder.name}`;
    } else {
        parentOf = folder.name;
    }
    fetch(`/api/folder`, {
        method: "POST",
        body: JSON.stringify({parent: parentOf})
    })
    .then(res => res.json())
    .then(data => {
        let ul = document.createElement('ul');
        ul.id = 'folder-view';
        let folders = data.filter((file) => file.type === 'folder');
        let files = data.filter((file) => file.type !== 'folder');
        folders.forEach((folder) => {
            ul.appendChild(newFileElem(folder));
        });
        files.forEach((file) => {
            ul.appendChild(newFileElem(file));
        });
        let fileList = document.createElement('div');
        fileList.className = 'file_list';
        fileList.appendChild(ul);
        let fileView = document.createElement('div');
        fileView.className = 'my_files';
        fileView.innerHTML = '';
        fileView.appendChild(buildPrompt(files));
        fileView.appendChild(fileList);
        mainSection.innerHTML = '';
        mainSection.appendChild(fileView);
        updateFolderStats(folders);
        updatePromptFragment(folder.name);
    })
}

function newFileElem(file, isTrash = false) {
    let li = document.createElement('li');
    li.id = `file-${file.hash}`
    let fileIcon = document.createElement('div');
    if (file.type === 'folder' || file.color) {
        fileIcon.style.color = file.color;
    }
    let pickerElem = document.createElement("input");
    pickerElem.type = "color";
    pickerElem.style.display = "none";
    pickerElem.value = file.color || "#ccc";
    pickerElem.addEventListener("change", () => {
        file.color = pickerElem.value;
        fetch(`/api/metadata`, {method: "PATCH", body: JSON.stringify(file)})
        .then(() => {
            fileIcon.style.color = file.color;
            showSnack(`Folder color changed successfully`, colorGreen, 'success');
        })
    });
    fileIcon.appendChild(pickerElem);
    fileIcon.className = 'file_icon';
    setIconByMime(file.mime, fileIcon);
    fileIcon.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (file.type === 'folder') {
            pickerElem.click();
            return;
        }
        if (!document.querySelector('.multi_select_options')) {
            let multiSelectOptions = document.createElement('div');
            multiSelectOptions.className = 'multi_select_options';
            let zipButton = document.createElement('button');
            zipButton.innerHTML = '<span class="material-symbols-rounded">archive</span>';
            zipButton.addEventListener("click", () => {
                let zip = new JSZip();
                let totalSize = 0;
                globalMultiSelectBucket.forEach((file) => {
                    totalSize += parseInt(file.size);
                });
                let randomZipId = randId();
                let zipData = {
                    name: `filebox-download-${randomZipId}.zip`,
                    mime: 'application/zip',
                    size: totalSize,
                    hash: randomZipId,
                }
                prependQueueElem(zipData);
                queueButton.click();
                let promises = [];
                let completed = 0;
                globalMultiSelectBucket.forEach((file) => {
                    promises.push(
                        fetchFileFromDrive(file, (cmp) => {
                            completed += cmp;
                            let percentage = Math.round((completed / totalSize) * 100);
                            progressHandlerById(zipData.hash, percentage);
                        })
                        .then((blob) => {
                            zip.file(file.name, new Blob([blob], {type: file.mime}));
                        })
                    );
                });
                Promise.all(promises)
                .then(() => {
                    zip.generateAsync({type:"blob"})
                    .then((content) => {
                        let a = document.createElement('a');
                        a.href = window.URL.createObjectURL(content);
                        a.download = zipData.name;
                        a.click();
                    });
                })
            });
            let moveButton = document.createElement('button');
            moveButton.innerHTML = '<span class="material-symbols-rounded">arrow_forward</span>';
            moveButton.addEventListener("click", () => {
                isFileMoving = true;
                browseButton.click();
                let fileMover = document.createElement('div');
                fileMover.className = 'file_mover';
                let cancelButton = document.createElement('button');
                cancelButton.innerHTML = 'Cancel';
                cancelButton.addEventListener('click', () => {
                    renderOriginalNav();
                });
                let selectButton = document.createElement('button');
                selectButton.innerHTML = 'Select';
                selectButton.style.backgroundColor = 'var(--color-blueish)';
                selectButton.addEventListener('click', () => {
                    globalMultiSelectBucket.forEach((file) => {
                        delete file.deleted;
                    });
                    if (!globalContextFolder) {
                        globalMultiSelectBucket.forEach((file) => {
                            delete file.parent;
                        });
                    } else {
                        globalMultiSelectBucket.forEach((file) => {
                            if (globalContextFolder.parent) {
                                file.parent = `${globalContextFolder.parent}/${globalContextFolder.name}`;
                            } else {
                                file.parent = globalContextFolder.name;
                            }
                        });
                    }
                    fetch(`/api/bulk`, {
                        method: "PATCH", 
                        body: JSON.stringify(globalMultiSelectBucket)}
                    )
                    .then(() => {
                        showSnack('Files Moved Successfully', colorGreen, 'success');
                        if (globalContextFolder) {
                            renderOriginalNav();
                            handleFolderClick(globalContextFolder);
                        } else {
                            isFileMoving = false;
                            browseButton.click();
                        }
                    })
                });
                let p = document.createElement('p');
                p.innerHTML = 'Select Move Destination';
                fileMover.appendChild(cancelButton);
                fileMover.appendChild(p);
                fileMover.appendChild(selectButton);
                renderAuxNav(fileMover);
                globalMultiSelectBucketUpdated = true;
            });
            let privateButton = document.createElement('button');
            privateButton.innerHTML = '<span class="material-symbols-rounded">visibility_off</span>';
            privateButton.addEventListener("click", () => {
                globalMultiSelectBucket.forEach((file) => {
                    file.access = 'private';
                });
                fetch(`/api/bulk`, {method: "PATCH", body: JSON.stringify(globalMultiSelectBucket)})
                .then(() => {
                    showSnack(`Made selected files private`, colorOrange, 'info');
                })
            });
            let publicButton = document.createElement('button');
            publicButton.innerHTML = '<span class="material-symbols-rounded">visibility</span>';
            publicButton.addEventListener("click", () => {
                globalMultiSelectBucket.forEach((file) => {
                    file.access = 'public';
                });
                fetch(`/api/bulk`, {method: "PATCH", body: JSON.stringify(globalMultiSelectBucket)})
                .then(() => {
                    showSnack(`Made selected files public`, colorGreen, 'info');
                })
            });
            let deleteButton = document.createElement('button');
            deleteButton.innerHTML = '<span class="material-symbols-rounded">delete_forever</span>';
            deleteButton.style.backgroundColor = "#f23a3a";
            deleteButton.addEventListener("click", () => {
                let ok = confirm(`Do you really want to delete ${globalMultiSelectBucket.length} file(s)?`);
                if (!ok) {
                    return;
                }
                fetch(`/api/bulk`, {method: "DELETE", body: JSON.stringify(globalMultiSelectBucket)})
                .then(() => {
                    globalMultiSelectBucket.forEach((file) => {
                        document.getElementById(`file-${file.hash}`).remove();
                    });
                    globalMultiSelectBucket = [];
                    showSnack(`Deleted selected files`, colorRed, 'info');
                    renderOriginalNav();
                })
            });
            let selectCount = document.createElement('p');
            selectCount.style.marginRight = 'auto';
            selectCount.id = 'selection-count';
            multiSelectOptions.appendChild(selectCount);
            multiSelectOptions.appendChild(zipButton);
            multiSelectOptions.appendChild(moveButton);
            multiSelectOptions.appendChild(privateButton);
            multiSelectOptions.appendChild(publicButton);
            multiSelectOptions.appendChild(deleteButton);
            renderAuxNav(multiSelectOptions);
        }
        if (globalMultiSelectBucket.length === 25) {
            showSnack(`Can't select more than 25 items`, colorOrange, 'warning');
            return;
        } else {
            li.style.backgroundColor = "rgba(255, 255, 255, 0.055)";
            let checkIcon = document.createElement('span');
            checkIcon.className = 'material-symbols-rounded';
            checkIcon.innerHTML = 'done';
            checkIcon.style.color = 'rgb(30, 112, 30)';
            checkIcon.style.backgroundColor = 'var(--color-blackish-hover)';
            checkIcon.style.borderRadius = '50%';
            checkIcon.style.padding = '5px';
            checkIcon.style.fontSize = '20px';
            fileIcon.innerHTML = '';
            fileIcon.appendChild(checkIcon);
            let index = globalMultiSelectBucket.findIndex((f) => f.hash === file.hash);
            if (index === -1) {
                globalMultiSelectBucket.push(file);
            } else {
                globalMultiSelectBucket.splice(index, 1);
                li.style.backgroundColor = "transparent";
                setIconByMime(file.mime, fileIcon)
            }
            document.getElementById('selection-count').innerHTML = `${globalMultiSelectBucket.length} selected`;
            if (globalMultiSelectBucket.length === 0) {
                renderOriginalNav();
            }
        }
    });
    let fileInfo = document.createElement('div');
    fileInfo.className = 'info';
    let fileName = document.createElement('p');
    fileName.innerHTML = file.name;
    fileName.id = `filename-${file.hash}`;
    let fileSizeAndDate = document.createElement('p');
    fileSizeAndDate.style.fontSize = '11px';
    fileSizeAndDate.id = `stat-${file.hash}`;
    if (file.type === 'folder') {
        fileSizeAndDate.innerHTML = `${formatDateString(file.date)}`;
    } else {
        fileSizeAndDate.innerHTML = `${handleSizeUnit(file.size)} • ${formatDateString(file.date)}`;
    }
    fileInfo.appendChild(fileName);
    fileInfo.appendChild(fileSizeAndDate);
    li.appendChild(fileIcon);
    li.appendChild(fileInfo);
    let menuOptionSpan = document.createElement('span');
    menuOptionSpan.className = 'material-symbols-rounded';
    menuOptionSpan.innerHTML = "more_horiz";
    menuOptionSpan.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (fileOptionPanel.style.display === 'flex' && fileOptionPanel.id === `panel-${file.hash}`) {
            fileOptionPanel.style.display = 'none';
            return;
        }
        if (isTrash) {
            handleTrashFileMenuClick(file);
        } else {
            handleFileMenuClick(file);
        }
    });
    li.appendChild(menuOptionSpan);
    li.addEventListener('click', () => {
        if (file.type === 'folder') {
            handleFolderClick(file);
        } else {
            showFilePreview(file);
        }
    });
    li.addEventListener('contextmenu', (ev) => {
        ev.preventDefault();
        let prevFile = document.getElementById(`file-${cm.id}`);
        if (prevFile) {
            prevFile.style.backgroundColor = 'transparent';
        }
        renderFileContextMenu(ev, file);
    });
    return li;
}

function buildPinnedContent(data) {
    let ul = document.createElement('ul');
    ul.className = 'pinned_files';
    data.forEach((file) => {
        ul.appendChild(newFileElem(file));
    });
    let fileList = document.createElement('div');
    fileList.className = 'file_list';
    fileList.appendChild(ul);
    return fileList;
}

function buildRecentContent(data) {
    let ul = document.createElement('ul');
    ul.className = 'recent_files';
    data.forEach((file) => {
        if (file.parent !== '~shared') {
            ul.appendChild(newFileElem(file));
        }
    });
    let fileList = document.createElement('div');
    fileList.className = 'file_list';
    fileList.appendChild(ul);
    return fileList;
}

function buildFileBrowser(data) {
    let ul = document.createElement('ul');
    ul.className = 'all_files';
    data.forEach((file) => {
        ul.appendChild(newFileElem(file));
    });
    let fileList = document.createElement('div');
    fileList.className = 'file_list';
    fileList.appendChild(ul);
    return fileList;
}

function updatePromptFragment(text = 'home') {
    let fragment;
    if (text === 'home') {
        fragment = 'Home';
    } else {
        fragment = text
    }
    document.querySelector('.fragment').innerHTML = fragment;
}

function buildPrompt(files) {
    let prompt = document.createElement('div');
    prompt.className = 'prompt';
    let fragment = document.createElement('p');
    fragment.className = 'fragment';
    let div = document.createElement('div');
    let backButton = document.createElement('i');
    backButton.className = 'material-symbols-rounded';
    backButton.innerHTML = 'arrow_back';
    backButton.addEventListener('click', () => {
        if (!isFileMoving) {
            globalMultiSelectBucket = [];
        }
        if (globalFolderQueue.length === 0) {
            globalContextFolder = null;
            return;
        }
        if (globalFolderQueue.length > 1) {
            globalFolderQueue.pop();
            handleFolderClick(globalFolderQueue[globalFolderQueue.length - 1]);
        } else {
            globalContextFolder = null;
            globalFolderQueue.pop();
            getContextOptionElem().click();
        }
    });
    let selectAll = document.createElement('i');
    selectAll.className = 'material-symbols-rounded';
    selectAll.innerHTML = 'select_all';
    selectAll.addEventListener('click', () => {
        files.forEach((file) => {
            let elem = document.getElementById(`file-${file.hash}`);
            if (!elem) {
                let index = files.findIndex((f) => f.hash === file.hash);
                files.splice(index, 1);
            }
        });
        let files25 = files.slice(0, 25);
        files25.forEach((file) => {
            document.getElementById(`file-${file.hash}`).firstElementChild.click();
        });
    });
    prompt.appendChild(backButton);
    div.appendChild(fragment);
    div.appendChild(selectAll);
    prompt.appendChild(div);
    return prompt;
}

function prependQueueElem(file, isUpload = true) {
    let li = document.createElement('li');
    let icon = document.createElement('div');
    icon.className = 'icon';
    setIconByMime(file.mime, icon)
    if (isUpload === null) {
        icon.innerHTML = '<span class="material-symbols-rounded">open_in_browser</span>';
    }
    let info = document.createElement('div');
    info.className = 'info';
    let name = document.createElement('p');
    name.innerHTML = file.name;
    let progress = document.createElement('div');
    progress.className = 'progress';
    let bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.width = '0%';
    if (isUpload === null) {
        bar.style.backgroundColor = `#8cb4fc`;
    } else if (isUpload) {
        bar.style.backgroundColor = colorBlue;
    } else {
        bar.style.backgroundColor = colorGreen;
    }
    bar.id = `bar-${file.hash}`;
    progress.appendChild(bar);
    info.appendChild(name);
    info.appendChild(progress);
    let percentage = document.createElement('p');
    percentage.innerHTML = '0%';
    percentage.id = `percentage-${file.hash}`;
    li.appendChild(icon);
    li.appendChild(info);
    li.appendChild(percentage);
    queueTaskList.prepend(li);
}

function updateToCompleted(hash) {
    let icon = document.querySelector(`#icon-${hash}`);
    icon.className = 'fa-solid fa-check-circle';
    icon.style.color = '#279627';
}

let snackTimer = null;
function showSnack(text, color=colorGreen, type='success') {
    let icons = {
        success: 'done',
        error: 'cancel',
        warning: 'priority_high',
        info: 'question_mark'
    }
    let snackbar = document.querySelector('.snackbar');
    snackbar.style.display = 'flex';
    let content = document.createElement('div');
    content.className = 'snack_content';
    content.style.backgroundColor = color;
    let icon = document.createElement('i');
    icon.className = "material-symbols-rounded";
    icon.style.marginRight = '10px';
    icon.innerHTML = icons[type];
    let p = document.createElement('p');
    p.innerHTML = text;
    let close = document.createElement('i');
    close.className = 'material-symbols-rounded';
    close.style.marginLeft = '10px';
    close.innerHTML = 'close';
    close.style.cursor = 'pointer';
    close.style.backgroundColor = 'transparent';
    close.addEventListener('click', () => {
        snackbar.style.display = 'none';
        cg.click();
    });
    snackbar.innerHTML = "";
    content.appendChild(icon);
    content.appendChild(p);
    content.appendChild(close);
    snackbar.appendChild(content);
    if (snackTimer) {
        clearTimeout(snackTimer);
    }
    snackTimer = setTimeout(() => {
        snackbar.style.display = 'none';
    }, 3000);
}

function renderFilesByQuery(query) {
    sidebarOptionSwitch();
    if (previousOption) {
        previousOption.style.borderLeft = '5px solid transparent';
        previousOption.style.backgroundColor = 'transparent';
        previousOption = null;
    }
    query['deleted?ne'] = true;
    fetch("/api/query", {method: "POST", body: JSON.stringify(query)})
    .then(response => response.json())
    .then(data => {
        mainSection.innerHTML = '';
        if (!data) {
            showSnack('No files found of this type', colorOrange, 'warning');
            return;
        }
        let fileList = document.createElement('div');
        fileList.className = 'file_list';
        let ul = document.createElement('ul');
        ul.className = 'all_files';
        data.forEach((file) => {
            ul.appendChild(newFileElem(file));
        });
        fileList.appendChild(ul);
        mainSection.appendChild(fileList);
    });
}

async function loadSharedFile(file, controller) {
    let progressBar = document.getElementById(`bar-${file.hash}`);
    let percentageElem = document.getElementById(`percentage-${file.hash}`);
    let size = file.size;
    const chunkSize = 1024 * 1024 * 4
    if (size < chunkSize) {
        let resp = await fetch(`/api/external/${globalUserId}/${file.owner}/${file.hash}/0`, {signal: controller.signal});
        percentageElem.innerHTML = '100%';
        progressBar.style.width = '100%';
        return await resp.blob();
    } else {
        let skips = 0;
        let progress = 0;
        let loadingLevel = document.querySelector('#loading-amount');
        if (size % chunkSize === 0) {
            skips = size / chunkSize;
        } else {
            skips = Math.floor(size / chunkSize) + 1;
        }
        let heads = Array.from(Array(skips).keys());
        let promises = [];
        heads.forEach((head) => {
            promises.push(
                fetch(`/api/external/${globalUserId}/${file.owner}/${file.hash}/${head}`)
                .then((resp) => {
                    return resp.blob();
                })
                .then((blob) => {
                    progress += blob.size;
                    let percentage = Math.floor((progress / size) * 100);
                    progressBar.style.width = `${percentage}%`;
                    percentageElem.innerHTML = `${percentage}%`;
                    return blob;
                })
            );
        });
        let blobs = await Promise.all(promises);
        return new Blob(blobs, {type: file.mime});
    }
}


// this will suck at large files
// will implement streaming later
// this is just a basic implementation
async function showFilePreview(file) {
    showSnack(`Loading preview for ${file.name}`, colorBlue, 'info');
    prependQueueElem(file, null);
    controller = new AbortController();
    let src;
    queueButton.click();
    if (file.shared) {
        let blob = await loadSharedFile(file, controller);
        src = URL.createObjectURL(new Blob([blob], {type: file.mime}));
    } else {
        let progressBar = document.getElementById(`bar-${file.hash}`);
        let percentageElem = document.getElementById(`percentage-${file.hash}`);
        let extRegex = /(?:\.([^.]+))?$/;
        let extension = extRegex.exec(file.name);
        if (extension && extension[1]) {
            extension = extension[1];
        } else {
            extension = '';
        }
        let filename;
        if (extension === '') {
            filename = file.hash;
        } else {
            filename = `${file.hash}.${extension}`
        }
        let projectId = globalSecretKey.split("_")[0];
        let url = `https://drive.deta.sh/v1/${projectId}/filebox/files/download?name=${filename}`;
        const response = await fetch(url, { 
            headers: {"X-Api-Key": globalSecretKey},
            signal: controller.signal
        });
        let progress = 0;
        const reader = response.body.getReader();
        const stream = new ReadableStream({
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
                        let percentage = Math.floor((progress / file.size) * 100);
                        progressBar.style.width = `${percentage}%`;
                        percentageElem.innerHTML = `${percentage}%`;
                        return pump();
                    });
                }
            }
        });
        const br = new Response(stream);
        const blob = await br.blob();
        src = URL.createObjectURL(new Blob([blob], {type: file.mime}));
    }
    window.location.href = src;
}

function fileMover(file) {
    let fileMover = document.createElement('div');
    fileMover.className = 'file_mover';
    let cancelButton = document.createElement('button');
    cancelButton.innerHTML = 'Cancel';
    cancelButton.addEventListener('click', () => {
        renderOriginalNav();
    });
    let selectButton = document.createElement('button');
    selectButton.innerHTML = 'Select';
    selectButton.style.backgroundColor = 'var(--color-blueish)';
    selectButton.addEventListener('click', () => {
        if (!globalContextFolder) {
            delete file.parent;
        } else {
            if (globalContextFolder.parent) {
                file.parent = `${globalContextFolder.parent}/${globalContextFolder.name}`;
            } else {
                file.parent = globalContextFolder.name;
            }
        }
        fetch(`/api/metadata`, {method: "PATCH", body: JSON.stringify(file)})
        .then(() => {
            if (globalContextFolder) {
                renderOriginalNav();
                if (document.querySelector(`#file-${file.hash}`)) {
                    showSnack('File is already here', colorOrange, 'info');
                    return;
                }   
                showSnack('File Moved Successfully', colorGreen, 'success');
                document.querySelector('#folder-view').appendChild(newFileElem(file))
            } else {
                isFileMoving = false;
                browseButton.click();
            }
        })
    });
    let p = document.createElement('p');
    p.innerHTML = 'Select Move Destination';
    fileMover.appendChild(cancelButton);
    fileMover.appendChild(p);
    fileMover.appendChild(selectButton);
    return fileMover;
}

function buildDynamicNavIcon() {
    let icon = document.createElement('span');
    icon.className = 'material-symbols-rounded';
    icon.id = 'dyn-nav-icon';
    if (window.innerWidth < 768) {
        icon.innerHTML = 'menu';
        icon.style.color = "#ccc"
        icon.style.padding = '0px 10px';
        icon.addEventListener('click', () => {
            blurLayer.style.display = 'block';
            sidebar.style.display = 'flex';
        });
    } else {
        icon.innerHTML = 'search';
        icon.style.color = "var(--color-blueish)";
        icon.style.padding = '0px';
        icon.style.paddingRight = '10px';
        icon.style.paddingLeft = '10px';
    }
    return icon;
}

function renderSearchResults(query) {
    fetch(`/api/query`, {
        method: "POST",
        body: JSON.stringify(query),
    })
    .then(response => response.json())
    .then(data => {
        if (window.innerWidth < 768) {
            sidebarState(false);
        }
        let resultsPage = document.createElement('div');
        resultsPage.className = 'my_files';
        let key = Object.keys(query)[0];
        let attr = key.replace("?contains","");
        let value = query[key];
        if (!data) {
            mainSection.innerHTML = '';
            let p = document.createElement('p');
            let symbol = `<i class="fa-solid fa-circle-exclamation"></i> `;
            p.innerHTML = `${symbol} No results found for ${attr}: *${value}*`;
            p.style.backgroundColor = "#e44d27";
            resultsPage.appendChild(p);
            mainSection.appendChild(resultsPage);
            fileOptionPanel.style.display = 'none';
            return;
        }
        let absoluteResults = data.filter((file) => {
            if (file.name.startsWith(query)) {
                data.splice(data.indexOf(file), 1);
                return true;
            } else {
                return false;
            }
        });
        data = absoluteResults.concat(data);
        let p = document.createElement('p');
        p.innerHTML = `Search results for ${attr}: *${value}*`;
        p.style.backgroundColor = "#317840";
        resultsPage.appendChild(p);
        let fileList = document.createElement('div');
        fileList.className = 'file_list';
        let ul = document.createElement('ul');
        ul.className = 'all_files';
        data.forEach((file) => {
            ul.appendChild(newFileElem(file));
        });
        fileList.appendChild(ul);
        resultsPage.appendChild(fileList);
        mainSection.innerHTML = '';
        mainSection.appendChild(resultsPage);
        fileOptionPanel.style.display = 'none';
    })
}

function renderOriginalNav() {
    isFileMoving = false;
    globalMultiSelectBucket = [];
    navBar.style.paddingLeft = '10px';
    navBar.style.paddingRight = '10px';
    let icon = buildDynamicNavIcon();
    let backButton = document.createElement('button');
    let searched = false;
    backButton.innerHTML = '<span class="material-symbols-rounded">clear_all</span>';
    backButton.style.display = 'none';
    backButton.addEventListener('click', () => {
        backButton.style.display = 'none';
        if (searched) {
            getContextOptionElem().click();
        } else {
            inputBar.value = '';
        }
    });
    let inputBar = document.createElement('input');
    inputBar.type = 'text';
    inputBar.placeholder = 'Search in Drive';
    inputBar.spellcheck = false;
    inputBar.autocomplete = 'on'; 
    let inputTimer = null;
    inputBar.addEventListener('input', (ev) => {
        if (inputTimer) {
            clearTimeout(inputTimer);
        }
        inputTimer = setTimeout(() => {
            if (ev.target.value.length > 0) {
                searched = true;
                backButton.style.display = 'flex';
                let matches = /:(.*?) (.*)/.exec(ev.target.value);
                if (matches) {
                    let attr = matches[1];
                    let contains = matches[2];
                    renderSearchResults({[`${attr}?contains`]: `${contains}`});
                } else {
                    renderSearchResults({"name?contains": `${ev.target.value}`});
                }
            }
        }, 500);
    });
    let newFolderButton = document.createElement('button');
    newFolderButton.innerHTML = '<span class="material-symbols-rounded">create_new_folder</span>';
    newFolderButton.addEventListener('click', () => {
        createFolder();
    });
    let newHiddenFolderInput = document.createElement('input');
    newHiddenFolderInput.type = 'file';
    newHiddenFolderInput.multiple = true;
    newHiddenFolderInput.style.display = 'none';
    newHiddenFolderInput.webkitdirectory = true;
    newHiddenFolderInput.addEventListener('change', (ev) => {
        let relativePaths = [];
        for (let i = 0; i < ev.target.files.length; i++) {
            relativePaths.push(ev.target.files[i].webkitRelativePath);
        }
        let uniqueFolders = [];
        for (let i = 0; i < relativePaths.length; i++) {
            let folderPath = relativePaths[i].split('/');
            folderPath.pop();
            folderPath = folderPath.join('/');
            if (!uniqueFolders.includes(folderPath)) {
                uniqueFolders.push(folderPath);
            }
        }
        let parents = [];
        uniqueFolders.forEach((folder) => {
            let folderPath = folder.split('/');
            let currentPath = '';
            folderPath.forEach((folder) => {
                currentPath += folder + '/';
                if (!parents.includes(currentPath)) {
                    parents.push(currentPath);
                }
            });
        });
        let strippedParents = parents.map((parent) => {
            return parent.slice(0, -1);
        });
        strippedParents.forEach((parent) => {
            let relativePath;
            if (globalContextFolder) {
                if (globalContextFolder.parent) {
                    relativePath = `${globalContextFolder.parent}/${globalContextFolder.name}`;
                } else {
                    relativePath = globalContextFolder.name;
                }
            }
            let folderName;
            let folderPath = '';
            if (parent.includes('/')) {
                let parentParts = parent.split('/');
                folderName = parentParts.pop();
                folderPath = `${parentParts.join('/')}`;
            } else {
                folderName = parent;
            }
            if (relativePath && folderPath) {
                folderPath = `${relativePath}/${folderPath}`;
            } else if (relativePath) {
                folderPath = relativePath;
            }
            let body = {
                "name": folderName,
                "type": "folder",
                "hash": randId(),
                "date": new Date().toISOString(),
            }
            if (folderPath) {
                body.parent = folderPath;
            }
            fetch(`/api/metadata`, {method: "POST", body: JSON.stringify(body)})
        });
        for (let i = 0; i < ev.target.files.length; i++) {
            let file = ev.target.files[i];
            let relativePath = ev.target.files[i].webkitRelativePath;
            let parentFragments = relativePath.split('/');
            parentFragments.pop();
            let parent = parentFragments.join('/');
            if (globalContextFolder) {
                if (globalContextFolder.parent) {
                    parent = `${globalContextFolder.parent}/${globalContextFolder.name}/${parent}`;
                } else {
                    parent = `${globalContextFolder.name}/${parent}`;
                }
            }
            let metadata = buildFileMetadata(file);
            metadata.parent = parent;
            prependQueueElem(metadata, true)
            upload(file, metadata, (percentage) => {
                progressHandlerById(metadata.hash, percentage);
            });
        }
    });
    let folderUploadButton = document.createElement('button');
    folderUploadButton.innerHTML = '<span class="material-symbols-rounded">drive_folder_upload</span>';
    folderUploadButton.addEventListener('click', () => {
        newHiddenFolderInput.click();
    });
    let newHiddenFileInput = document.createElement('input');
    newHiddenFileInput.type = 'file';
    newHiddenFileInput.multiple = true;
    newHiddenFileInput.style.display = 'none';
    let newFileButton = document.createElement('button');
    newFileButton.innerHTML = '<span class="material-symbols-rounded">upload_file</span>';
    newFileButton.addEventListener('click', () => {
        newHiddenFileInput.click();
    });
    newHiddenFileInput.addEventListener('change', (ev) => {
        queueButton.click();
        for (let i = 0; i < ev.target.files.length; i++) {
            let file = ev.target.files[i];
            let metadata = buildFileMetadata(file);
            prependQueueElem(metadata, true);
            upload(file, metadata, (percentage) => {
                progressHandlerById(metadata.hash, percentage);
            });
        }
    });
    navBar.innerHTML = '';
    navBar.appendChild(icon);
    navBar.appendChild(inputBar);
    navBar.appendChild(backButton);
    navBar.appendChild(newFolderButton);
    navBar.appendChild(folderUploadButton);
    navBar.appendChild(newFileButton);
    navBar.appendChild(newHiddenFileInput);
    navBar.appendChild(newHiddenFolderInput);
}

function renderAuxNav(elem){
    navBar.style.width = '100%';
    navBar.style.margin = '0';
    navBar.style.padding = '0';
    let wrapper = document.createElement('div');
    wrapper.className = 'other';
    navBar.innerHTML = '';
    wrapper.appendChild(elem);
    navBar.appendChild(wrapper);
}

function renderFileSenderModal(file) {
    if (!globalUserId) {
        showSnack('File sending is not available for this instance', colorOrange, 'info');
        return;
    }
    fileOptionPanel.style.display = 'none';
    fileSender.innerHTML = '';
    let filename = document.createElement('p');
    filename.innerHTML = file.name;
    let userIdField = document.createElement('input');
    userIdField.placeholder = 'Type user instance id';
    userIdField.type = 'text';
    userIdField.spellcheck = false;
    let buttons = document.createElement('div');
    let cancelButton = document.createElement('button');
    cancelButton.innerHTML = 'Cancel';
    cancelButton.addEventListener('click', () => {
        fileSender.style.display = 'none';
        blurLayer.style.display = 'none';
    });
    let sendButton = document.createElement('button');
    sendButton.innerHTML = 'Send';
    sendButton.style.backgroundColor = colorGreen;
    sendButton.addEventListener('click', () => {
        if (userIdField.value === globalUserId) {
            showSnack("You can't send a file to yourself", colorOrange, 'warning');
            return;
        }
        let fileClone = JSON.parse(JSON.stringify(file));
        delete fileClone.recipients;
        delete fileClone.pinned;
        fileClone.owner = globalUserId;
        fileClone.pending = true;
        fileClone.shared = true;
        fileClone.parent = "~shared";
        fetch(`/api/push/${userIdField.value}`, {method: "POST", body: JSON.stringify(fileClone)})
        .then((resp) => {
            if (resp.status !== 207) {
                fileSender.style.display = 'none';
                showSnack('Something went wrong. Please try again', colorRed, 'error');
                return;
            }
            if (file.recipients) {
                if (!file.recipients.includes(userIdField.value)) {
                    file.recipients.push(userIdField.value);
                }
            } else {
                file.recipients = [userIdField.value];
            }
            fetch(`/api/metadata`, {method: "PATCH", body: JSON.stringify(file)})
            .then((resp) => {
                if (resp.status === 207) {
                    showSnack(`File shared with ${userIdField.value}`, colorGreen, 'success');
                    fileSender.style.display = 'none';
                } else {
                    showSnack('Something went wrong. Please try again', colorRed, 'error');
                }
            })
        })
    });
    buttons.appendChild(cancelButton);
    buttons.appendChild(sendButton);
    fileSender.appendChild(filename);
    fileSender.appendChild(userIdField);
    fileSender.appendChild(buttons);
    fileSender.style.display = 'flex';
}

function buildTitleP(text) {
    let p = document.createElement('p');
    p.innerHTML = text;
    p.style.width = '100%';
    p.style.textAlign = 'left';
    p.style.padding = '10px';
    p.style.fontSize = '18px';
    return p;
}

function buildPendingFileList(files) {
    let sharedFiles = document.createElement('div');
    sharedFiles.className = 'shared_files';
    files.forEach((file) => {
        let pendingFile = document.createElement('div');
        pendingFile.className = 'pending_file';
        let icon = document.createElement('div');
        icon.className = 'icon';
        setIconByMime(file.mime, icon);
        let fileInfo = document.createElement('div');
        fileInfo.className = 'file_info';
        let filename = document.createElement('p');
        filename.innerHTML = file.name;
        let details = document.createElement('p');
        details.innerHTML = `Owner: ${file.owner} & Size: ${handleSizeUnit(file.size)}`;
        let buttons = document.createElement('div');
        buttons.style.display = 'flex';
        buttons.style.width = '100%';
        buttons.style.alignItems = 'center';
        buttons.style.justifyContent = 'flex-end';
        let reject = document.createElement('span');
        reject.className = 'material-symbols-rounded';
        reject.innerHTML = 'close';
        reject.style.color = colorRed;
        reject.addEventListener('click', () => {
            fetch(`/api/metadata`, {method: "DELETE", body: JSON.stringify(file)})
            .then((res) => {
                if (res.status === 200) {
                    pendingFile.remove();
                    showSnack('File rejected', colorOrange, 'warning')
                } else {
                    showSnack('Something went wrong. Please try again', colorRed, 'error');
                }
            })
        });
        let accept = document.createElement('span');
        accept.className = 'material-symbols-rounded';
        accept.innerHTML = 'check';
        accept.addEventListener('click', () => {
            delete file.pending;
            fetch(`/api/metadata`, {method: "POST", body: JSON.stringify(file)})
            .then((res) => {
                if (res.status === 207) {
                    showSnack('File accepted', colorGreen, 'success')
                    let fileList = document.querySelector('.all_files');
                    pendingFile.remove();
                    fileList.appendChild(newFileElem(file));
                } else {
                    showSnack('Something went wrong. Please try again', colorRed, 'error');
                }
            })
        });
        buttons.appendChild(reject);
        buttons.appendChild(accept);
        fileInfo.appendChild(filename);
        fileInfo.appendChild(details);
        pendingFile.appendChild(icon);
        pendingFile.appendChild(fileInfo);
        pendingFile.appendChild(buttons);
        sharedFiles.appendChild(pendingFile);
    });
    return sharedFiles;
}

function renderGreetings() {
    let greetings = document.createElement('div');
    greetings.className = 'greetings';
    let skip = document.createElement('div');
    skip.className = 'skip';
    skip.innerHTML = '<p>skip</p>';
    skip.addEventListener('click', () => {
        localStorage.setItem('isGreeted', true);
        greetings.remove();
    });
    let innerOne = document.createElement('div');
    innerOne.className = 'inner';
    innerOne.innerHTML = '<img src="../assets/app_icon.png" alt="icon">';
    let innerTwo = document.createElement('div');
    innerTwo.className = 'inner';
    let h1 = document.createElement('h1');
    h1.innerHTML = 'Welcome to Filebox';
    let p = document.createElement('p');
    p.innerHTML = `Let's upload your first file`;
    let dropSection = document.createElement('div');
    let dropSectionSpan = document.createElement('span');
    dropSectionSpan.innerHTML = 'Drop your file here or click to select';
    dropSection.className = 'drop';
    dropSection.appendChild(dropSectionSpan);
    let pseudoInput = document.createElement('input');
    pseudoInput.type = 'file';
    pseudoInput.style.display = 'none';
    pseudoInput.addEventListener('change', () => {
        dropSectionSpan.innerHTML = pseudoInput.files[0].name;
        uploadButton.disabled = false;
        uploadButton.style.opacity = '1';
    });
    dropSection.appendChild(pseudoInput);
    dropSection.addEventListener('click', () => {
        pseudoInput.click();
    });
    dropSection.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropSection.style.border = '2px dashed #cccccc8f';
    });
    dropSection.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropSection.style.border = '2px dashed var(--color-blackish-hover)';
    });
    dropSection.addEventListener('drop', (e) => {
        e.preventDefault();
        dropSection.style.border = '2px dashed var(--color-blackish-hover)';
        pseudoInput.files = e.dataTransfer.files;
        dropSectionSpan.innerHTML = pseudoInput.files[0].name;
        uploadButton.disabled = false;
        uploadButton.style.opacity = '1';
    });
    let uploadButton = document.createElement('button');
    uploadButton.innerHTML = 'Upload';
    uploadButton.disabled = true;
    uploadButton.style.opacity = '0.5';
    uploadButton.addEventListener('click', () => {
        let file = pseudoInput.files[0];
        let metadata = buildFileMetadata(file);
        prependQueueElem(metadata, true);
        upload(file, metadata, (percentage) => {
            progressHandlerById(metadata.hash, percentage);
        });
        localStorage.setItem('isGreeted', true);
        skip.click();
    });
    innerTwo.appendChild(h1);
    innerTwo.appendChild(p);
    innerTwo.appendChild(dropSection);
    innerTwo.appendChild(uploadButton);
    greetings.appendChild(skip);
    greetings.appendChild(innerOne);
    greetings.appendChild(innerTwo);
    document.body.prepend(greetings);
}