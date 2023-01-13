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

function fomatDateString(date) {
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
        r.Data.items.forEach((item) => {
            if (item.size) {
                totalSize += item.size;
            }
        });
    });
    return totalSize;
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
    if (globalFolderQueue.length > 0) {
        let lastFolder = globalFolderQueue[globalFolderQueue.length - 1];
        if (lastFolder.hash !== folder.hash) {
            globalFolderQueue.push(folder);
        }
    } else {
        globalFolderQueue.push(folder);
    }
    let parent = "";
    let fragment = "";
    if (folder.parent) {
        fragment = `/${folder.parent}/${folder.name}`;
        parent = `${folder.parent}/${folder.name}`;
    } else {
        fragment = `/${folder.name}`;
        parent = folder.name;
    }
    fetch(`/api/folder`, {
        method: "POST",
        body: JSON.stringify({parent: parent})
    })
    .then(res => res.json())
    .then(data => {
        let ul = document.createElement('ul');
        data.forEach((file) => {
            globalFileBucket[file.hash] = file;
            ul.appendChild(newFileElem(file));
        });
        updateFileView(ul);
        updatePromptFragment(`~${fragment}`);
    })
}

function handleFileOrFolderClick(hash) {
    globalContextFile = globalFileBucket[hash];
    if (globalContextFile.type === 'folder') {
        handleFolderClick(globalContextFile);
    } else {
        let optionsPanel = document.querySelector('.options-panel');
        if (window.innerWidth < 768) {
            blurLayer.style.display = 'block';
        }
        optionsPanel.style.display = 'flex';
        let fileNameP = document.querySelector('#options-panel-filename');
        fileNameP.innerHTML = globalContextFile.name;
    }
}

function newFileElem(file) {
    let li = document.createElement('li');
    li.id = `file-${file.hash}`
    let fileIcon = document.createElement('i');
    fileIcon.className = handleMimeIcon(file.mime);
    let fileInfo = document.createElement('div');
    fileInfo.className = 'info';
    let fileName = document.createElement('p');
    fileName.innerHTML = file.name;
    let fileSizeAndDate = document.createElement('p');
    fileSizeAndDate.style.fontSize = '12px';
    fileSizeAndDate.innerHTML = handleSizeUnit(file.size) + " • " + fomatDateString(file.date);
    fileInfo.appendChild(fileName);
    fileInfo.appendChild(fileSizeAndDate);
    li.appendChild(fileIcon);
    li.appendChild(fileInfo);
    let pinOptionSpan = document.createElement('span');
    pinOptionSpan.className = 'material-symbols-rounded';
    pinOptionSpan.id = `pin-${file.hash}`;
    pinOptionSpan.innerHTML = 'push_pin';
    pinOptionSpan.addEventListener('click', (ev) => {
        ev.stopPropagation();
        // TODO: do more stuff
    });
    li.appendChild(pinOptionSpan);
    li.addEventListener('click', () => {
        handleFileOrFolderClick(file.hash);
    });
    return li;
}

function buildPinnedContent (data) {
    let pinned = document.createElement('div');
    pinned.className = 'pinned';
    data.forEach((file) => {
        let card = document.createElement('div');
        card.className = 'card';
        let unpinDiv = document.createElement('div');
        unpinDiv.className = 'unpin';
        let unpin = document.createElement('sapn');
        unpin.className = 'material-symbols-rounded';
        unpin.innerHTML = 'do_not_disturb_on';
        unpinDiv.appendChild(unpin);
        let fileIcon = document.createElement('i');
        fileIcon.className = handleMimeIcon(file.mime);
        let fileName = document.createElement('p');
        fileName.innerHTML = file.name;
        card.appendChild(unpinDiv);
        card.appendChild(fileIcon);
        card.appendChild(fileName);
        pinned.appendChild(card);
    });
    return pinned;
}

function buildRecentContent(data) {
    let ul = document.createElement('ul');
    ul.className = 'recent-files';
    data.forEach((file) => {
        if (file.type !== 'folder') {
            let li = newFileElem(file);
            ul.appendChild(li);
        }
    });
    return ul;
}

function buildAllFilesList(data) {
    let ul = document.createElement('ul');
    ul.className = 'all-files';
    data.forEach((file) => {
        if (!file.parent) {
            let li = newFileElem(file);
            ul.appendChild(li);
        }
    });
    return ul;
}

function buildHomePage(pinnedBlock, recentBlock) {
    let homePage = document.createElement('div');
    homePage.className = 'home-page';
    let pinnedTitle = document.createElement('p');
    pinnedTitle.innerHTML = '<i class="fa-solid fa-thumbtack"></i>  Pinned';
    let recentTitle = document.createElement('p');
    recentTitle.innerHTML = '<i class="fa-solid fa-clock-rotate-left"></i>  Recent files';
    homePage.appendChild(pinnedTitle);
    homePage.appendChild(pinnedBlock);
    homePage.appendChild(recentTitle);
    homePage.appendChild(recentBlock);
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
            return;
        }
        if (globalFolderQueue.length > 1) {
            globalFolderQueue.pop();
            let parent = globalFolderQueue[globalFolderQueue.length - 1];
            handleFolderClick(parent);
        } else {
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
    allFilesPage.className = 'my-files';
    allFilesPage.appendChild(buildPrompt());
    allFilesPage.appendChild(allFilesBlock);
    return allFilesPage;
}

function updatePromptFragment(text = '~') {
    let fragment = document.querySelector('.fragment');
    fragment.innerHTML = text;
}

function updateFileView(contentBlock) {
    let fileView = document.querySelector('.my-files');
    fileView.innerHTML = '';
    fileView.appendChild(buildPrompt());
    fileView.appendChild(contentBlock);
}

function queueElem(file, taskType="upload") {
    let task = document.createElement('div');
    task.className = 'task';
    let icon = document.createElement('div');
    icon.className = 'icon';
    let fileIcon = document.createElement('i');
    fileIcon.id = `icon-${file.hash}`;
    if (taskType === "upload") {
        fileIcon.className = 'fa-solid fa-circle-up';
        fileIcon.style.color = colorBlue;
    } else {
        fileIcon.className = 'fa-solid fa-circle-down';
        fileIcon.style.color = colorGreen;
    }
    icon.appendChild(fileIcon);
    let fileName = document.createElement('p');
    fileName.innerHTML = file.name;
    let progress = document.createElement('div');
    progress.className = 'progress';
    let progressBar = document.createElement('div');
    progressBar.className = 'bar';
    progressBar.style.width = '0%';
    progressBar.id = `bar-${file.hash}`;
    if (taskType === "upload") {
        progressBar.style.backgroundColor = colorBlue;
    } else {
        progressBar.style.backgroundColor = colorGreen;
    }
    progress.appendChild(progressBar);
    task.appendChild(icon);
    task.appendChild(fileName);
    task.appendChild(progress);
    return task;
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