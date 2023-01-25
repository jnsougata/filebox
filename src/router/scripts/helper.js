let fileOptionPanel = document.querySelector('.file_menu');
let queueTaskList = document.querySelector('#queue-task-list');
let queueContent = document.querySelector('.queue_content');
queueContent.addEventListener('click', () => {
    queueModalCloseButton.click();
});

async function fetchItemCount(folder) {
    let path;
    if (folder.parent) {
        path = `${folder.parent}/${folder.name}`;
    } else {
        path = folder.name;
    }
    let resp = await fetch(`/api/items/count`, {
        method: "POST", 
        body: JSON.stringify({"children_path": path})
    });
    let data = await resp.json();
    return data.count;
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

function getTotalSize(data) {
    let totalSize = 0;
    data.forEach((r) => {
        r['Data'].items.forEach((item) => {
            if (item.size) {
                totalSize += item.size;
            }
        });
    });
    return totalSize;
}

function updateSpaceUsage(incr) {
    globalConsumption += incr;
    totalSizeWidget.innerHTML = `<i class="fa-solid fa-database"></i>Used ${handleSizeUnit(globalConsumption)}`;
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
    restore.innerHTML = `<p>Restore to Root</p><span class="material-symbols-rounded">replay</span>`;
    restore.addEventListener("click", () => {
        if (file.parent) {
            delete file.deleted;
            delete file.parent;
        } else {
            delete file.deleted;
        }
        fetch(`/api/metadata`, {method: "PATCH", body: JSON.stringify(file)})
        .then(() => {
            showSnack(`Restored ${file.name}`, colorGreen);
            document.getElementById(`file-${file.hash}`).remove();
            close.click();
            globalTrashFiles = globalTrashFiles.filter((f) => f.hash !== file.hash);
            if (globalTrashFiles.length === 0) {
                extraRenderingPanel.style.display = 'none';
            }
        })
    });
    let deleteButton = document.createElement("div");
    deleteButton.className = "file_menu_option";
    deleteButton.innerHTML = `<p>Delete Permanently</p><span class="material-symbols-rounded">delete_forever</span>`;
    deleteButton.addEventListener("click", () => {
        fetch(`/api/metadata`, {method: "DELETE", body: JSON.stringify(file)})
        .then(() => {
            showSnack(`Permanently deleted ${file.name}`, colorRed);
            document.getElementById(`file-${file.hash}`).remove();
            updateSpaceUsage(-file.size);
            close.click();
            globalTrashFiles = globalTrashFiles.filter((f) => f.hash !== file.hash);
            if (globalTrashFiles.length === 0) {
                extraRenderingPanel.style.display = 'none';
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
            showSnack("File access changed to public", colorGreen);
        } else {
            visibility.className = `fa-solid fa-eye-slash`;
            file.access = 'private';
            share.style.opacity = 0.3;
            embed.style.opacity = 0.3;
            showSnack("File access changed to private", colorOrange);
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
    let pin = document.createElement("div");
    pin.className = "file_menu_option";
    pin.innerHTML = `<p>Pin</p><span class="material-symbols-rounded">push_pin</span>`;
    pin.addEventListener("click", () => {
        fetch(`/api/pin/${file.hash}`, {method: "POST"})
        .then(() => {
            showSnack(`File pinned successfully!`);
            close.click();
            let pinnedSection = document.querySelector('.pinned');
            if (pinnedSection) {
                pinnedSection.appendChild(newPinnedElem(file));
            }
        })
    });
    fileOptionPanel.appendChild(pin);
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
                showSnack("File extension cannot be changed", colorOrange);
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
                    showSnack(`File renamed to ${newName}`);
                }
            })
        });
    });
    let downloadButton = document.createElement("div");
    downloadButton.className = "file_menu_option";
    downloadButton.innerHTML = `<p>Download</p><span class="material-symbols-rounded">download</span>`;
    downloadButton.addEventListener("click", () => {
        close.click();
        showSnack(`Downloading ${file.name}`);
        queueButton.click();
        download(file);
    });
    let share = document.createElement("div");
    share.className = "file_menu_option";
    share.innerHTML = `<p>Share</p><span class="material-symbols-rounded">link</span>`;
    share.addEventListener("click", () => {
        if (file.access === "private") {
            showSnack(`Make file public to share via link`, colorOrange);
        } else if (file.size > 30 * 1024 * 1024) {
            showSnack(`File is too large to share via link`, colorRed);
        } else {
            window.navigator.clipboard.writeText(`${window.location.origin}/shared/${file.hash}`)
            .then(() => {
                showSnack(`Copied sharing URL to clipboard`);
            })
        }
    });
    let embed = document.createElement("div");
    embed.className = "file_menu_option";
    embed.innerHTML = `<p>Embed</p><span class="material-symbols-rounded">code</span>`;
    embed.addEventListener("click", () => {
        if (file.access === "private") {
            showSnack(`Make file public to embed`, colorOrange);
        } else if (file.size > 4 * 1024 * 1024) {
            showSnack(`File is too large to embed`, colorRed);
        } else {
            window.navigator.clipboard.writeText(`${window.location.origin}/api/embed/${file.hash}`)
            .then(() => {
                showSnack(`Copied embed URL to clipboard`);
            })
        }
    });
    let move = document.createElement("div");
    move.className = "file_menu_option";
    move.innerHTML = `<p>Move</p><span class="material-symbols-rounded">arrow_forward</span>`;
    move.addEventListener("click", () => {
        close.click();
        allFilesButton.click();
        renderFileMover(file);
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
            let body = {"hash": file.hash};
            if (file.parent) {
                body["children_path"] = `${file.parent}/${file.name}`;
            } else {
                body["children_path"] = `${file.name}`;
            }
            fetch(`/api/remove/folder`, {method: "POST", body: JSON.stringify(body)})
            .then((resp) => {
                if (resp.status === 409) {
                    showSnack(`Folder is not empty`, colorOrange);
                    close.click();
                    return;
                }
                if (resp.status === 200) {
                    showSnack(`Permanently Deleted ${file.name}`, colorRed);
                    document.getElementById(`file-${file.hash}`).remove();
                    close.click();
                } 
            })
        } else {
            file.deleted = true;
            fetch(`/api/metadata`, {method: "PATCH", body: JSON.stringify(file)})
            .then(() => {
                showSnack(`Moved to trash ${file.name}`, colorRed);
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
        updatePromptFragment(`~${fragment}`);
    })
}

function newFileElem(file, isTrash = false) {
    let li = document.createElement('li');
    li.id = `file-${file.hash}`
    let fileIcon = document.createElement('i');
    fileIcon.className = handleMimeIcon(file.mime);
    fileIcon.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (file.type === 'folder') {
            return ;
        }
        if (extraRenderingPanel.style.display === 'none') {
            let multiSelecOptions = document.createElement('div');
            multiSelecOptions.className = 'multi_select_options';
            let moveButton = document.createElement('button');
            moveButton.innerHTML = 'Move';
            moveButton.addEventListener("click", () => {
                globalMultiSelectBucketUpdate = false;
                extraPanelState = true;
                allFilesButton.click();
                let fileMover = document.createElement('div');
                fileMover.className = 'file_mover';
                let cancelButton = document.createElement('button');
                cancelButton.innerHTML = 'Cancel';
                cancelButton.addEventListener('click', () => {
                    globalMultiSelectBucket = [];
                    extraPanelState = false;
                    extraRenderingPanel.innerHTML = '';
                    extraRenderingPanel.style.display = 'none';
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
                        extraPanelState = false;
                        globalMultiSelectBucket = [];
                        globalMultiSelectBucketUpdate = true;
                        extraRenderingPanel.innerHTML = '';
                        extraRenderingPanel.style.display = 'none';
                        showSnack('Files Moved Successfully!');
                        if (globalContextFolder) {
                            handleFolderClick(globalContextFolder);
                        } else {
                            allFilesButton.click();
                        }
                    })
                });
                let p = document.createElement('p');
                p.innerHTML = 'Select Move Destination';
                fileMover.appendChild(cancelButton);
                fileMover.appendChild(p);
                fileMover.appendChild(selectButton);
                extraRenderingPanel.innerHTML = '';
                extraRenderingPanel.appendChild(fileMover);
            });
            let privateButton = document.createElement('button');
            privateButton.innerHTML = 'Private';
            privateButton.addEventListener("click", () => {
                globalMultiSelectBucket.forEach((file) => {
                    file.access = 'private';
                });
                fetch(`/api/bulk`, {method: "PATCH", body: JSON.stringify(file)})
                .then(() => {
                    showSnack(`Made selected files private`, colorOrange);
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
                    showSnack(`Made selected files public`, colorGreen);
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
                    globalMultiSelectBucket = [];
                    globalMultiSelectBucketUpdate = true;
                    showSnack(`Deleted selected files`, colorRed);
                    extraRenderingPanel.style.display = 'none';
                })
            });
            multiSelecOptions.appendChild(moveButton);
            multiSelecOptions.appendChild(privateButton);
            multiSelecOptions.appendChild(publicButton);
            multiSelecOptions.appendChild(deleteButton);
            extraRenderingPanel.innerHTML = '';
            extraRenderingPanel.appendChild(multiSelecOptions);
            extraRenderingPanel.style.display = 'flex';
        }
        if (globalMultiSelectBucket.length === 25) {
            showSnack(`Can't select more than 25 items`, colorOrange);
            return;
        } else {
            li.style.backgroundColor = "rgba(255, 255, 255, 0.055)";
            fileIcon.className = "fa-solid fa-check";
            let index = globalMultiSelectBucket.findIndex((f) => f.hash === file.hash);
            if (index === -1) {
                globalMultiSelectBucket.push(file);
            } else {
                globalMultiSelectBucket.splice(index, 1);
                li.style.backgroundColor = "transparent";
                fileIcon.className = handleMimeIcon(file.mime);
            }
            if (globalMultiSelectBucket.length === 0) {
                extraRenderingPanel.style.display = 'none';
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
    if (file.type === 'folder') {
        fetchItemCount(file)
        .then((count) => {
            fileSizeAndDate.innerHTML = `${count} items • ${formatDateString(file.date)}`;
        })
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

function buildRecentContent(data) {
    let ul = document.createElement('ul');
    ul.className = 'recent_files';
    data.forEach((file) => {
        if (file.type !== 'folder') {
            let li = newFileElem(file);
            ul.appendChild(li);
        }
    });
    let fileList = document.createElement('div');
    fileList.className = 'file_list';
    fileList.appendChild(ul);
    return fileList;
}

function buildAllFilesList(data) {
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
        pinnedTitle.innerHTML = '<i class="fa-solid fa-thumbtack"></i>  Pinned';
        homePage.appendChild(pinnedTitle);
        homePage.appendChild(pinnedBlock);
    }
    if (recentBlock) {
        let recentTitle = document.createElement('p');
        recentTitle.innerHTML = '<i class="fa-solid fa-clock-rotate-left"></i>  Recent files';
        homePage.appendChild(recentTitle);
        homePage.appendChild(recentBlock);
    }
    return homePage;
}

function buildPrompt() {
    let prompt = document.createElement('div');
    prompt.className = 'prompt';
    let arrow = document.createElement('div');
    arrow.className = 'arrow';
    let fragment = document.createElement('div');
    fragment.className = 'fragment';
    let backButton = document.createElement('div');
    backButton.className = 'back';
    backButton.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
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
            allFilesButton.click();
        }
    });
    prompt.appendChild(fragment);
    prompt.appendChild(arrow);
    prompt.appendChild(backButton);
    return prompt;
}

function buildAllFilesPage(allFilesBlock) {
    let allFilesPage = document.createElement('div');
    allFilesPage.className = 'my_files';
    allFilesPage.appendChild(buildPrompt());
    allFilesPage.appendChild(allFilesBlock);
    return allFilesPage;
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
function showSnack(text, color=colorGreen) {
    let snackbar = document.querySelector('.snackbar');
    snackbar.style.display = 'flex';
    snackbar.innerHTML = `
    <div class="content" style="background-color: ${color}">
        <p>${text}</p>
    </div>`;
    if (snackTimer) {
        clearTimeout(snackTimer);
    }
    snackTimer = setTimeout(() => {
        snackbar.style.display = 'none';
    }, 3000);
}

function renderCategory(query) {
    sidebarOptionSwitch();
    fetch("/api/query", {method: "POST", body: JSON.stringify(query)})
    .then(response => response.json())
    .then(data => {
        let fileList = document.createElement('div');
        fileList.className = 'file_list';
        let ul = document.createElement('ul');
        ul.className = 'all_files';
        data.forEach((file) => {
            ul.appendChild(newFileElem(file));
        });
        fileList.appendChild(ul);
        mainSection.innerHTML = '';
        mainSection.appendChild(fileList);
    });
}

function dateStringToTimestamp(dateString) {
    let date = new Date(dateString);
    return date.getTime();
}

function sortRecentFilesByTimeStamp(data) {
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

function renderFileMover(file) {
    let fileMover = document.createElement('div');
    fileMover.className = 'file_mover';
    let cancelButton = document.createElement('button');
    cancelButton.innerHTML = 'Cancel';
    cancelButton.addEventListener('click', () => {
        extraPanelState = false;
        extraRenderingPanel.innerHTML = '';
        extraRenderingPanel.style.display = 'none';
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
            extraPanelState = false;
            extraRenderingPanel.innerHTML = '';
            extraRenderingPanel.style.display = 'none';
            showSnack('File Moved Successfully!');
            if (globalContextFolder) {
                let view = document.querySelector('#folder-view');
                view.appendChild(newFileElem(file));
            } else {
                allFilesButton.click();
            }
        })
    });
    let p = document.createElement('p');
    p.innerHTML = 'Select Move Destination';
    fileMover.appendChild(cancelButton);
    fileMover.appendChild(p);
    fileMover.appendChild(selectButton);
    extraRenderingPanel.innerHTML = '';
    extraRenderingPanel.appendChild(fileMover);
    extraRenderingPanel.style.display = 'flex';
    extraPanelState = true;
}