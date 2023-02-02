let fileOptionPanel = document.querySelector('.file_menu');
let queueTaskList = document.querySelector('#queue-task-list');
let queueContent = document.querySelector('.queue_content');
queueContent.addEventListener('click', () => {
    queueModalCloseButton.click();
});

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
    let d = new Date(date);
    return d.getDate()
        + "/" + (d.getMonth() + 1)
        + "/" + d.getFullYear()
        + " " + d.getHours()
        + ":" + d.getMinutes()
        + ":" + d.getSeconds();
}

function updateSpaceUsage(incr) {
    globalConsumption += incr;
    totalSizeWidget.innerHTML = `${handleSizeUnit(globalConsumption)} Used`;
}

function handleTrashFileMenuClick(file) {
    fileOptionPanel.innerHTML = "";
    fileOptionPanel.id = `panel-${file.hash}`;
    if (window.innerWidth < 768) {
        blurLayer.style.display = 'block';
    }
    let title = document.createElement("div");
    title.className = "title";
    let fileNameElem = document.createElement("p");
    fileNameElem.innerHTML = file.name;
    title.appendChild(fileNameElem);
    let close = document.createElement("i");
    close.className = `fa-solid fa-chevron-down`;
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
                showSnack(`Parent not found. Restoring to root!`, colorOrange, 'warning');
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
                if (globalTrashFiles.length === 0) {
                    renderOriginalHeader();
                }
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
            updateSpaceUsage(-file.size);
            close.click();
            globalTrashFiles = globalTrashFiles.filter((f) => f.hash !== file.hash);
            if (globalTrashFiles.length === 0) {
                renderOriginalHeader();
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
    if (window.innerWidth < 768) {
        blurLayer.style.display = 'block';
    }
    let title = document.createElement("div");
    title.className = "title";
    let fileNameElem = document.createElement("p");
    fileNameElem.innerHTML = file.name;
    title.appendChild(fileNameElem);
    let bookmark = document.createElement("i");
    if (file.pinned) {
        bookmark.className = `fa-solid fa-bookmark`;
    } else {
        bookmark.className = `fa-regular fa-bookmark`;
    }
    bookmark.addEventListener("click", () => {
        if (file.pinned) {
            fetch(`/api/pin/${file.hash}`, {method: "DELETE"})
            .then(() => {
                showSnack(`Unpinned successfully!`, colorOrange, 'info');
                let card = document.getElementById(`card-${file.hash}`);
                if (card) {
                    card.remove();
                }
                bookmark.className = `fa-regular fa-bookmark`;
                delete file.pinned;
            })
        } else {
            fetch(`/api/pin/${file.hash}`, {method: "POST"})
            .then(() => {
                showSnack(`Pinned successfully!`, colorGreen, 'success');
                let pinnedSection = document.querySelector('.pinned');
                if (pinnedSection) {
                    pinnedSection.appendChild(newPinnedElem(file));
                }
                bookmark.className = `fa-solid fa-bookmark`;
                file.pinned = true;
            })
        }
    });
    title.appendChild(bookmark);
    let visibility = document.createElement("i");
    if (file.access === "private") {
        visibility.className = `fa-solid fa-eye-slash`;
    } else {
        visibility.className = `fa-solid fa-eye`;
    }
    visibility.addEventListener("click", () => {
        if (file.access === 'private') {
            visibility.className = `fa-solid fa-eye`;
            file.access = 'public';
            if (file.size > 1024 * 1024 * 30) {
                share.style.opacity = 0.3;
            } else {
                share.style.opacity = 1;
            }
            if (file.size > 1024 * 1024 * 4) {
                embed.style.opacity = 0.3;
            } else {
                embed.style.opacity = 1;
            }
            showSnack("File access changed to public", colorGreen, 'info');
        } else {
            visibility.className = `fa-solid fa-eye-slash`;
            file.access = 'private';
            share.style.opacity = 0.3;
            embed.style.opacity = 0.3;
            showSnack("File access changed to private", colorOrange, 'info');
        }
        fetch(`/api/file/access`, {
            method: "POST", 
            body: JSON.stringify({hash: file.hash, access: file.access})
        })
    });
    if (file.type !== "folder") {
        title.appendChild(visibility);
    }
    let close = document.createElement("i");
    close.className = `fa-solid fa-chevron-down`;
    close.addEventListener("click", () => {
        fileOptionPanel.style.display = 'none';
        blurLayer.style.display = 'none';
    });
    title.appendChild(close);
    fileOptionPanel.appendChild(title);
    let send = document.createElement("div");
    send.className = "file_menu_option";
    send.innerHTML = `<p>Send</p><span class="material-symbols-rounded">send</span>`;
    if (file.type !== "folder") {
        send.addEventListener("click", () => {
            renderFileSenderModal(file);
        });
        fileOptionPanel.appendChild(send);
    }
    let rename = document.createElement("div");
    rename.className = "file_menu_option";
    rename.innerHTML = `<p>Rename</p><span class="material-symbols-rounded">edit</span>`;
    rename.addEventListener("click", () => {
        fileNameElem.contentEditable = true;
        fileNameElem.spellcheck = false;
        fileNameElem.focus();
        fileNameElem.addEventListener('blur', (e) => {
            let oldName = file.name;
            let oldExtension = "";
            let oldNameFragments = oldName.split(".");
            if (oldNameFragments.length > 1) {
                oldExtension = oldNameFragments.pop();
            } else {
                oldExtension = "";
            }
            let newName = e.target.innerText;
            let newExtension = "";
            let newNameFragments = newName.split(".");
            if (newNameFragments.length > 1) {
                newExtension = newNameFragments.pop();
            } else {
                newExtension = "";
            }
            if (oldExtension !== newExtension) {
                e.target.innerHTML = oldName;
                showSnack("File extension cannot be changed", colorOrange, 'warning');
                return;
            }
            if (newName === oldName) {
                return;
            }
            fetch(`/api/rename`, {method: "POST", body: JSON.stringify({hash: file.hash, name: newName})})
            .then((res) => {
                if (res.status === 200) {
                    file.name = newName;
                    document.querySelector(`#filename-${file.hash}`).innerHTML = newName;
                    showSnack(`File renamed to ${newName}`, colorGreen, 'success');
                }
            })
        });
    });
    let downloadButton = document.createElement("div");
    downloadButton.className = "file_menu_option";
    downloadButton.innerHTML = `<p>Download</p><span class="material-symbols-rounded">download</span>`;
    downloadButton.addEventListener("click", () => {
        close.click();
        showSnack(`Downloading ${file.name}`, colorGreen, 'info');
        queueButton.click();
        download(file);
    });
    let share = document.createElement("div");
    share.className = "file_menu_option";
    share.innerHTML = `<p>Share Link</p><span class="material-symbols-rounded">link</span>`;
    share.addEventListener("click", () => {
        if (file.access === "private") {
            showSnack(`Make file public to share via link`, colorOrange, 'warning');
        } else if (file.size > 30 * 1024 * 1024) {
            showSnack(`File is too large to share via link`, colorRed, 'error');
        } else {
            window.navigator.clipboard.writeText(`${window.location.origin}/shared/${file.hash}`)
            .then(() => {
                showSnack(`Copied sharing URL to clipboard`, colorGreen, 'success');
            })
        }
    });
    let embed = document.createElement("div");
    embed.className = "file_menu_option";
    embed.innerHTML = `<p>Embed</p><span class="material-symbols-rounded">code</span>`;
    embed.addEventListener("click", () => {
        if (file.access === "private") {
            showSnack(`Make file public to embed`, colorOrange, 'warning');
        } else if (file.size > 4 * 1024 * 1024) {
            showSnack(`File is too large to embed`, colorRed, 'error');
        } else {
            window.navigator.clipboard.writeText(`${window.location.origin}/api/embed/${file.hash}`)
            .then(() => {
                showSnack(`Copied embed URL to clipboard`, colorGreen, 'success');
            })
        }
    });
    let move = document.createElement("div");
    move.className = "file_menu_option";
    move.innerHTML = `<p>Move</p><span class="material-symbols-rounded">arrow_forward</span>`;
    move.addEventListener("click", () => {
        close.click();
        renderOtherHeader(fileMover(file));
        isFileMoving = true;
        myFilesButton.click();
    });
    if (file.type !== 'folder') {
        fileOptionPanel.appendChild(rename);
        fileOptionPanel.appendChild(downloadButton);
        if (file.access === 'private' || file.size > 1024 * 1024 * 30) {
            share.style.opacity = 0.3;
            embed.style.opacity = 0.3;
        }
        if (file.access === 'private' || file.size > 1024 * 1024 * 4) {
            embed.style.opacity = 0.3;
        }
        fileOptionPanel.appendChild(share);
        if (file.access === 'private' || file.size > 1024 * 1024 * 4) {
            embed.style.opacity = 0.3;
        }
        fileOptionPanel.appendChild(embed);
        fileOptionPanel.appendChild(move);
    }
    let trashButton = document.createElement("div");
    trashButton.className = "file_menu_option";
    if (file.type === 'folder') {
        trashButton.innerHTML = `<p>Delete</p><span class="material-symbols-rounded">delete_forever</span>`;
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
    fileOptionPanel.style.display = 'flex';
}

function handleMimeIcon(mime) {
    if (mime === undefined) {
        return "fa-solid fa-folder";
    }
    if (mime.startsWith("image")) {
        return "fa-solid fa-image";
    } else if (mime.startsWith("video")) {
        return "fa-solid fa-video";
    } else if (mime.startsWith("audio")) {
        return "fa-solid fa-headphones";
    } else if (mime.startsWith("text")) {
        return  "fa-solid fa-file-lines";
    } else if (mime.startsWith("application/pdf")) {
        return "fa-solid fa-book-open";
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
    let fragment;
    let parentOf;
    if (folder.parent) {
        fragment = `/${folder.parent}/${folder.name}`;
        parentOf = `${folder.parent}/${folder.name}`;
    } else {
        fragment = `/${folder.name}`;
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
        fileView.appendChild(buildPrompt());
        fileView.appendChild(fileList);
        mainSection.innerHTML = '';
        mainSection.appendChild(fileView);
        updateFolderStats(folders);
        updatePromptFragment(`~${fragment}`);
    })
}

function newFileElem(file, isTrash = false) {
    let li = document.createElement('li');
    li.id = `file-${file.hash}`
    let fileIcon = document.createElement('div');
    fileIcon.className = 'file_icon';
    fileIcon.innerHTML = `<i class="${handleMimeIcon(file.mime)}"></i>`
    fileIcon.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (file.type === 'folder') {
            return ;
        }
        if (!document.querySelector('.multi_select_options')) {
            let multiSelecOptions = document.createElement('div');
            multiSelecOptions.className = 'multi_select_options';
            let moveButton = document.createElement('button');
            moveButton.innerHTML = 'Move';
            moveButton.addEventListener("click", () => {
                isFileMoving = true;
                myFilesButton.click();
                let fileMover = document.createElement('div');
                fileMover.className = 'file_mover';
                let cancelButton = document.createElement('button');
                cancelButton.innerHTML = 'Cancel';
                cancelButton.addEventListener('click', () => {
                    renderOriginalHeader();
                });
                let selectButton = document.createElement('button');
                selectButton.innerHTML = 'Select';
                selectButton.style.backgroundColor = 'var(--color-blueish)';
                selectButton.addEventListener('click', () => {
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
                    fetch(`/api/bulk`, {method: "PATCH", body: JSON.stringify(globalMultiSelectBucket)})
                    .then(() => {
                        showSnack('Files Moved Successfully!', colorGreen, 'success');
                        if (globalContextFolder) {
                            renderOriginalHeader();
                            handleFolderClick(globalContextFolder);
                        } else {
                            isFileMoving = false;
                            myFilesButton.click();
                        }
                    })
                });
                let p = document.createElement('p');
                p.innerHTML = 'Select Move Destination';
                fileMover.appendChild(cancelButton);
                fileMover.appendChild(p);
                fileMover.appendChild(selectButton);
                renderOtherHeader(fileMover);
                globalMultiSelectBucketUpdated = true;
            });
            let privateButton = document.createElement('button');
            privateButton.innerHTML = 'Private';
            privateButton.addEventListener("click", () => {
                globalMultiSelectBucket.forEach((file) => {
                    file.access = 'private';
                });
                fetch(`/api/bulk`, {method: "PATCH", body: JSON.stringify(file)})
                .then(() => {
                    showSnack(`Made selected files private`, colorOrange, 'info');
                })
            });
            let publicButton = document.createElement('button');
            publicButton.innerHTML = 'Public';
            publicButton.addEventListener("click", () => {
                globalMultiSelectBucket.forEach((file) => {
                    file.access = 'public';
                });
                fetch(`/api/bulk`, {method: "PATCH", body: JSON.stringify(file)})
                .then(() => {
                    showSnack(`Made selected files public`, colorGreen, 'info');
                })
            });
            let deleteButton = document.createElement('button');
            deleteButton.innerHTML = 'Delete';
            deleteButton.style.backgroundColor = colorRed;
            deleteButton.addEventListener("click", () => {
                fetch(`/api/bulk`, {method: "DELETE", body: JSON.stringify(globalMultiSelectBucket)})
                .then(() => {
                    globalMultiSelectBucket.forEach((file) => {
                        let fileElem = document.getElementById(`file-${file.hash}`);
                        fileElem.remove();
                    });
                    showSnack(`Deleted selected files`, colorRed, 'info');
                    renderOriginalHeader();
                })
            });
            multiSelecOptions.appendChild(moveButton);
            multiSelecOptions.appendChild(privateButton);
            multiSelecOptions.appendChild(publicButton);
            multiSelecOptions.appendChild(deleteButton);
            renderOtherHeader(multiSelecOptions);
        }
        if (globalMultiSelectBucket.length === 25) {
            showSnack(`Can't select more than 25 items`, colorOrange, 'warning');
            return;
        } else {
            li.style.backgroundColor = "rgba(255, 255, 255, 0.055)";
            fileIcon.innerHTML = `<i class="fa-solid fa-square-check" style="color: var(--color-blueish)"></i>`;
            let index = globalMultiSelectBucket.findIndex((f) => f.hash === file.hash);
            if (index === -1) {
                globalMultiSelectBucket.push(file);
            } else {
                globalMultiSelectBucket.splice(index, 1);
                li.style.backgroundColor = "transparent";
                fileIcon.innerHTML = `<i class="${handleMimeIcon(file.mime)}"></i>`;
            }
            if (globalMultiSelectBucket.length === 0) {
                renderOriginalHeader();
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
    menuOptionSpan.className = 'fa-solid fa-ellipsis';
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
            fileOptionPanel.style.display = 'none';
            modal.style.display = 'flex';
            let warning = document.createElement('p');
            warning.innerHTML = "Preview uses progressive loading, so it may take a while to load large files.";
            warning.className = 'warning';
            warning.style.color = colorOrange;
            modalContent.appendChild(warning);
            modalContent.appendChild(makeSpinnerElem());
            if (file.mime.startsWith('image')) {
                addImageViewer(file);
            } else if (file.mime.startsWith('audio')) {
                addAudioPlayer(file);
            } else if (file.mime.startsWith('video')) {
                addVideoPlayer(file);
            } else if (file.mime.startsWith('application/pdf')) {
                addPDFViewer(file);
            } else if (file.mime.startsWith('text')) {
                addTextViewer(file);
            } else {
                modalContent.innerHTML = '';
                let p = document.createElement('p');
                p.innerHTML = "Sorry, we don't support this file type yet!";
                p.style.color = colorRed;
                modalContent.appendChild(p);
            }
        }
    });
    return li;
}

function newPinnedElem(file) {
    let card = document.createElement('div');
    card.className = 'card';
    card.id = `card-${file.hash}`;
    let unpinDiv = document.createElement('div');
    unpinDiv.className = 'unpin';
    let unpin = document.createElement('span');
    unpin.className = 'material-symbols-rounded';
    unpin.innerHTML = 'cancel';
    unpin.addEventListener('click', (ev) => {
        ev.stopPropagation();
        fetch(`/api/pin/${file.hash}`, {method: "DELETE"})
        .then(() => {
            card.remove();
        })
    });
    unpinDiv.appendChild(unpin);
    let fileIcon = document.createElement('i');
    fileIcon.className = handleMimeIcon(file.mime);
    let fileName = document.createElement('p');
    fileName.innerHTML = file.name;
    card.appendChild(unpinDiv);
    card.appendChild(fileIcon);
    card.appendChild(fileName);
    card.addEventListener('click', () => {
        if (file.type === 'folder') {
            handleFolderClick(file);
        } else {
            handleFileMenuClick(file);
        }
    })
    return card;
}

function buildPinnedContent(data) {
    let pinned = document.createElement('div');
    pinned.className = 'pinned';
    data.forEach((file) => {
        pinned.appendChild(newPinnedElem(file));
    });
    return pinned;
}

function buildRecentUL(data) {
    let ul = document.createElement('ul');
    ul.className = 'recent_files';
    data.forEach((file) => {
        ul.appendChild(newFileElem(file));
    });
    let fileList = document.createElement('div');
    fileList.className = 'file_list';
    fileList.appendChild(ul);
    return fileList;
}

function buildAllFileUL(data) {
    let ul = document.createElement('ul');
    ul.className = 'all_files';
    data.forEach((file) => {
        if (!file.parent) {
            let li = newFileElem(file);
            ul.appendChild(li);
        }
    });
    let fileList = document.createElement('div');
    fileList.className = 'file_list';
    fileList.appendChild(ul);
    return fileList;
}

function buildHomePage(pinnedBlock, recentBlock) {
    let homePage = document.createElement('div');
    homePage.className = 'home_page';
    if (pinnedBlock) {
        let pinnedTitle = document.createElement('p');
        pinnedTitle.innerHTML = 'Pinned';
        homePage.appendChild(pinnedTitle);
        homePage.appendChild(pinnedBlock);
    }
    if (recentBlock) {
        let recentTitle = document.createElement('p');
        recentTitle.innerHTML = 'Recent';
        homePage.appendChild(recentTitle);
        homePage.appendChild(recentBlock);
    }
    return homePage;
}

function buildPrompt() {
    let prompt = document.createElement('div');
    prompt.className = 'prompt';
    let fragment = document.createElement('p');
    fragment.className = 'fragment';
    let backButton = document.createElement('i');
    backButton.className = 'fa-solid fa-chevron-left';
    backButton.addEventListener('click', () => {
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
            myFilesButton.click();
        }
    });
    prompt.appendChild(fragment);
    prompt.appendChild(backButton);
    return prompt;
}

function buildMyFilesBlock(allFilesBlock) {
    let myFiles = document.createElement('div');
    myFiles.className = 'my_files';
    myFiles.appendChild(buildPrompt());
    myFiles.appendChild(allFilesBlock);
    return myFiles;
}

function updatePromptFragment(text = '~') {
    document.querySelector('.fragment').innerHTML = text;
}

function prependQueueElem(file, isUpload = true) {
    let li = document.createElement('li');
    let icon = document.createElement('div');
    icon.className = 'icon';
    icon.innerHTML = `<i class="${handleMimeIcon(file.mime)}"></i>`;
    let info = document.createElement('div');
    info.className = 'info';
    let name = document.createElement('p');
    name.innerHTML = file.name;
    let progress = document.createElement('div');
    progress.className = 'progress';
    let bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.width = '0%';
    if (isUpload) {
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
        success: 'fa-solid fa-check-circle',
        error: 'fa-solid fa-xmark',
        warning: 'fa-solid fa-exclamation-triangle',
        info: 'fa-solid fa-info-circle'
    }
    let snackbar = document.querySelector('.snackbar');
    snackbar.style.display = 'flex';
    snackbar.innerHTML = `
    <div class="snack_content" style="background-color: ${color}">
        <i class="${icons[type]}"></i>
        <p>${text}</p>
    </div>`;
    if (snackTimer) {
        clearTimeout(snackTimer);
    }
    snackTimer = setTimeout(() => {
        snackbar.style.display = 'none';
    }, 3000);
}

function renderFilesByMime(query) {
    sidebarOptionSwitch();
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

function makeSpinnerElem() {
    let spinner = document.createElement('div');
    spinner.className = 'spinner';
    spinner.innerHTML = `<p id="loading-amount"></p><div></div><div></div><div></div><div></div>`;
    return spinner;
}

async function fetchMediaBlob(file) {
    // this will suck at large files
    // will implement streaming later
    // this is just a basic implementation
    let header = {"X-Api-Key": globalSecretKey}
    let projectId = globalSecretKey.split("_")[0];
    let extension = file.name.split('.').pop();
    let qualifiedName = file.hash + "." + extension;
    let url = `https://drive.deta.sh/v1/${projectId}/filebox/files/download?name=${qualifiedName}`;
    const response = await fetch(url, { method: "GET", headers: header });
    let progress = 0;
    let loadingLevel = document.querySelector('#loading-amount');
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
                    loadingLevel.innerHTML = `${Math.round((progress / file.size) * 100)}%`;
                    return pump();
                });
            }
        }
    });
    const blobResponse = new Response(stream);
    let blob = await blobResponse.blob();
    return new Blob([blob], { type: file.mime });
}

function addAudioPlayer(file) {
    fetchMediaBlob(file)
    .then((blob) => {
        let audio = document.createElement('audio');
        audio.controls = true;
        audio.src = URL.createObjectURL(blob);
        globalMediaBlob = audio.src;
        modalContent.innerHTML = '';
        let playerCard = document.createElement('div');
        playerCard.className = 'music_player';
        let title = document.createElement('p');
        title.style.textAlign = 'center';
        title.style.height = '100%';
        title.style.width = '100%';
        title.style.display = 'flex';
        title.style.alignItems = 'center';
        title.style.justifyContent = 'center';
        title.innerHTML = file.name;
        title.style.marginBottom = '10px';
        playerCard.appendChild(title);
        playerCard.appendChild(audio);
        modalContent.appendChild(playerCard);
    });
}

function addImageViewer(file) {
    fetchMediaBlob(file)
    .then((blob) => {
        let image = document.createElement('img');
        image.style.width = '100%';
        image.style.height = '100%';
        image.style.objectFit = 'contain';
        image.src = URL.createObjectURL(blob);
        globalMediaBlob = image.src;
        modalContent.innerHTML = '';
        modalContent.appendChild(image);
    });
}

function addVideoPlayer(file) {
    fetchMediaBlob(file)
    .then((blob) => {
        let video = document.createElement('video');
        video.controls = true;
        video.style.width = '100%';
        video.style.height = '100%';
        video.src = URL.createObjectURL(blob);
        globalMediaBlob = video.src;
        modalContent.innerHTML = '';
        modalContent.appendChild(video);
    })
}

function addPDFViewer(file) {
    fetchMediaBlob(file)
    .then((blob) => {
        let pdf = document.createElement('embed');
        pdf.style.width = '100%';
        pdf.style.height = '100%';
        pdf.src = URL.createObjectURL(blob);
        globalMediaBlob = pdf.src;
        modalContent.innerHTML = '';
        modalContent.appendChild(pdf);
    })
}

function addTextViewer(file) {
    fetchMediaBlob(file)
    .then((blob) => {
        let textView = document.createElement('embed');
        textView.style.width = '100%';
        textView.style.height = '100%';
        textView.src = URL.createObjectURL(blob);
        globalMediaBlob = textView.src;
        modalContent.innerHTML = '';
        modalContent.appendChild(textView);
    })
}

function fileMover(file) {
    let fileMover = document.createElement('div');
    fileMover.className = 'file_mover';
    let cancelButton = document.createElement('button');
    cancelButton.innerHTML = 'Cancel';
    cancelButton.addEventListener('click', () => {
        renderOriginalHeader();
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
                renderOriginalHeader();
                if (document.querySelector(`#file-${file.hash}`)) {
                    showSnack('File is already here!', colorOrange, 'info');
                    return;
                }   
                showSnack('File Moved Successfully!', colorGreen, 'success');
                document.querySelector('#folder-view').appendChild(newFileElem(file))
            } else {
                isFileMoving = false;
                myFilesButton.click();
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

function renderOriginalHeader() {
    isFileMoving = false;
    globalMultiSelectBucket = [];
    let header = document.querySelector('header');
    header.style.paddingLeft = '10px';
    header.style.paddingRight = '10px';
    let icon = document.createElement('i');
    icon.className = 'fa-solid fa-magnifying-glass';
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
            let query = ev.target.value;
            if (query.length === 0) {
                getContextOptionElem(globalContextOption).click();
                return;
            }
            fetch(`/api/query`, {
                method: "POST",
                body: JSON.stringify({"name?contains": query}),
            })
            .then(response => response.json())
            .then(data => {
                if (window.innerWidth < 768) {
                    sidebarEventState(false);
                }
                let resultsPage = document.createElement('div');
                resultsPage.className = 'my_files';
                if (!data) {
                    mainSection.innerHTML = '';
                    let p = document.createElement('p');
                    let symbol = `<i class="fa-solid fa-circle-exclamation"></i> `;
                    p.innerHTML = `${symbol} No results found for '${query}'`;
                    p.style.color = "rgb(247, 70, 70)";
                    resultsPage.appendChild(p);
                    mainSection.appendChild(resultsPage);
                    fileOptionPanel.style.display = 'none';
                    return;
                }
                data = data.filter((file) => {
                    return !(file.type === 'folder');
                });
                let p = document.createElement('p');
                p.innerHTML = `Search results for '${query}'`;
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
        }, 500);
    });
    let newFolderButton = document.createElement('button');
    newFolderButton.innerHTML = '<i class="fa-solid fa-plus"></i>Folder';
    newFolderButton.addEventListener('click', () => {
        createFolder();
    });
    let newHiddenFileInput = document.createElement('input');
    newHiddenFileInput.type = 'file';
    newHiddenFileInput.multiple = true;
    newHiddenFileInput.style.display = 'none';
    let newFileButton = document.createElement('button');
    newFileButton.innerHTML = '<i class="fa-solid fa-paperclip"></i>Upload';
    newFileButton.addEventListener('click', () => {
        newHiddenFileInput.click();
    });
    newHiddenFileInput.addEventListener('change', (ev) => {
        queueButton.click();
        for (let i = 0; i < ev.target.files.length; i++) {
            upload(ev.target.files[i]);
        }
    });
    header.innerHTML = '';
    header.appendChild(icon);
    header.appendChild(inputBar);
    header.appendChild(newFolderButton);
    header.appendChild(newFileButton);
    header.appendChild(newHiddenFileInput);
}

function renderOtherHeader(elem){
    switchToOriginalHeader = true;
    let header = document.querySelector('header');
    header.style.padding = '0px';
    let wrapper = document.createElement('div');
    wrapper.className = 'other';
    header.innerHTML = '';
    wrapper.appendChild(elem);
    header.appendChild(wrapper);
}

function buildDiscoveryModal() {
    let discovery = document.createElement('div');
    discovery.className = 'discovery';
    let h4a = document.createElement('h4');
    h4a.innerHTML = `What is 'Discovery'?`;
    h4a.style.color = 'var(--color-blueish)';
    let pa = document.createElement('p');
    pa.innerHTML = `
        Discovery is a feature that allows you to share specific files with other users on Discovery.
        They will have read-only access to the file, and you can revoke access anytime.
        Any shared file will not be stored on the receiver's drive, so it will not take up any space.
        It's just a reference to the file on the owner's drive. 
    `;
    let h4b = document.createElement('h4');
    h4b.innerHTML = `What are the concerns?`;
    h4b.style.color = 'var(--color-blueish)';
    let pb = document.createElement('p');
    pb.innerHTML = `
        To make this possible, we have to store your instance's API key in our global user collection.
        This API key is used to access your drive and perform limited operations on it. We tried to make it as secure as possible.
        Heavy server-side checks are performed to ensure that a file is served with proper authentication and to a valid user or users.
    `;
    let consentDiv = document.createElement('div');
    let consentP = document.createElement('p');
    consentP.innerHTML = `<input type="checkbox" id="discovery-consent" /> I understand the concerns and I want to enable Discovery*`;
    consentDiv.appendChild(consentP);
    let inputDiv = document.createElement('div');
    let apiKeyInput = document.createElement('input');
    apiKeyInput.type = 'password';
    let enableButton = document.createElement('button');
    enableButton.innerHTML = 'Enable Discovery';
    enableButton.addEventListener('click', () => {
        if (!document.querySelector('#discovery-consent').checked) {
            showSnack('Please check the box to enable Discovery', colorOrange, 'warning');
            return;
        }
        let apiKey = apiKeyInput.value;
        if (apiKey.length < 15) {
            showSnack('Invalid API key', colorOrange, 'warning');
            return;
        }
        fetch('/global/users', {
            method: 'POST',
            body: JSON.stringify({
                "enabled": true,
                "api_key": apiKey,
                "id": globalUserId,
                "pending": {},
                "instance_url": window.location.href,
            }),
        })
        .then((res) => {
            if (res.status === 201) {
                isUserSubscribed = true;
                showSnack('Discovery enabled', colorGreen, 'success');
                modalCloseButton.click();
                let discoveryElem = document.querySelector('#discovery');
                discoveryElem.innerHTML = `Leave Discovery <span class="material-symbols-rounded">public_off</span>`;
            } else {
                showSnack('Something went wrong! Please try again.', colorRed, 'error');
            }
        })
    });
    inputDiv.appendChild(apiKeyInput);
    inputDiv.appendChild(enableButton);
    discovery.appendChild(h4a);
    discovery.appendChild(pa);
    discovery.appendChild(h4b);
    discovery.appendChild(pb);
    discovery.appendChild(consentDiv);
    discovery.appendChild(inputDiv);
    return discovery;
}

function renderFileSenderModal(file) {
    let fileSender = document.querySelector('.file_sender');
    fileSender.innerHTML = '';
    fileSender.style.display = 'flex';
    let filename = document.createElement('p');
    filename.innerHTML = file.name;
    let usernameList = document.createElement('ul');
    let userLi = document.createElement('li');
    userLi.innerHTML = 'Searching...';
    let query = document.createElement('input');
    query.type = 'text';
    query.placeholder = 'Enter user id';
    let recipient = null;
    let inputTimer = null;
    query.addEventListener('input', (ev) => {
        if (inputTimer) {
            clearTimeout(inputTimer);
        }
        inputTimer = setTimeout(() => {
            let username = ev.target.value;
            if (username === globalUserId) {
                userLi.innerHTML = `can't share files with yourself`;
                return;
            }
            if (username.length === 0) {
                userLi.innerHTML = 'Searching...';
                return;
            }
            if (username.length < 3) {
                return;
            }
            userLi.innerHTML = 'Searching...';
            fetch(`/global/has/${username}`)
            .then((res) => {
                let av = `https://api.dicebear.com/5.x/initials/svg?chars=1&fontWeight=900&backgroundType=gradientLinear&seed=`
                if (res.status === 200) {
                    userLi.innerHTML = `<img src="${av}${username}" /> ${username}`;
                    recipient = username;
                    sendButton.disabled = false;
                    sendButton.style.cursor = 'pointer';
                    sendButton.style.opacity = '1';
                }
            })
        }, 500);
    });
    let buttons = document.createElement('div');
    let cancelButton = document.createElement('button');
    cancelButton.innerHTML = 'Cancel';
    cancelButton.addEventListener('click', () => {
        fileSender.style.display = 'none';
    });
    let sendButton = document.createElement('button');
    sendButton.style.backgroundColor = `var(--color-blueish)`;
    sendButton.innerHTML = 'Send';
    sendButton.disabled = true;
    sendButton.style.cursor = 'not-allowed';
    sendButton.style.opacity = '0.5';
    sendButton.addEventListener('click', () => {
        if (file.recipients) {
            if (file.recipients.includes(recipient)) {
                showSnack('This file is already shared with this user', colorOrange, 'warning');
                return;
            }
            file.recipients.push(recipient);
        } else {
            file.recipients = [recipient];
        }
        let fileCopy = JSON.parse(JSON.stringify(file));
        fileCopy["pending"] = true;
        fileCopy["shared"] = true;
        fileCopy["owner"] = globalUserId;
        delete fileCopy.parent;
        delete fileCopy.recipients;
        fetch(`/global/users`, {method: "PATCH", body: JSON.stringify({"id": recipient, "file": fileCopy})})
        .then((resp) => {
            if (resp.status === 200) {
                fetch("/api/metadata", {method: "PATCH", body: JSON.stringify(file)})
                .then((resp) => {
                    if (resp.status === 207) {
                        showSnack('File shared with ' + recipient, colorGreen, 'success');
                        fileSender.style.display = 'none';
                    } else {
                        showSnack('Something went wrong! Please try again.', colorRed, 'error');
                    }
                })
            } else {
                showSnack('Something went wrong! Please try again.', colorRed, 'error');
            }
        })
    });
    buttons.appendChild(cancelButton);
    buttons.appendChild(sendButton);
    fileSender.appendChild(filename);
    fileSender.appendChild(query);
    query.focus();
    usernameList.appendChild(userLi);
    fileSender.appendChild(usernameList);
    fileSender.appendChild(buttons);
}

function appnedPendingFiles(files) {
    let sharedFiles = document.createElement('div');
    sharedFiles.className = 'shared_files';
    files.forEach((file) => {
        let pendingFile = document.createElement('div');
        pendingFile.className = 'pending_file';
        let icon = document.createElement('div');
        icon.className = 'icon';
        icon.innerHTML = `<i class="${handleMimeIcon(file.mime)}"></i>`;
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
            // reject file
        });
        let accept = document.createElement('span');
        accept.className = 'material-symbols-rounded';
        accept.innerHTML = 'check';
        accept.addEventListener('click', () => {
            // accept file
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
    mainSection.appendChild(sharedFiles);
}