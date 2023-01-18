var globalFileBucket = {};
var globalFolderQueue = [];
let globalConsumption = 0;
var globalContextFile = null;
let globalContextOption = null;
let totalSizeWidget = document.querySelector('.bottom-option');
let sidebarState = false;
let sidebar = document.querySelector('.sidebar');
var blurLayer = document.querySelector('.blur-layer');
let mainSection = document.querySelector('#main');
let secondarySection = document.querySelector('#secondary');
var taskQueueElem = document.querySelector('.queue');
const colorRed = "#CB1446";
const colorGreen = "#2AA850";
const colorBlue = "#2E83F3";
const colorOrange = "#FF6700";

function getContextOptionElem(option) {
    let options = {
        "home" : homeButton,
        "all-files" : allFilesButton,
        "pdfs" : pdfButton,
        "images" : imgButton,
        "videos" : videoButton,
        "audios" : audioButton,
        "docs" : docsButton,
        "queue" : queueButton,
        "others" : otherButton,
    }
    return options[option];
}

function switchView(primary = true, secondary = false) {
    if (window.innerWidth < 768) {
        sidebarEventState(false);
    }
    folderOptionPanel.style.display = 'none';
    fileOptionPanel.style.display = 'none';
    let header = document.querySelector('header');
    if (primary) {
        header.style.display = 'flex';
        mainSection.style.display = 'flex';
    } else {
        header.style.display = 'none';
        mainSection.style.display = 'none';
    }
    if (secondary) {
        secondarySection.style.display = 'flex';
        header.style.display = 'none';
    } else {
        secondarySection.style.display = 'none';
        header.style.display = 'flex';
    }
}

function sidebarEventState(enable = true) {
    if (!enable) {
        blurLayer.style.display = 'none';
        sidebar.style.display = 'none';
        floatingMenuButton.innerHTML = `<i class="fa-solid fa-bars"></i>`;
        sidebarState = false;
    } else {
        if (window.innerWidth < 768) {
            blurLayer.style.display = 'block';
        }
        sidebar.style.display = 'flex';
        floatingMenuButton.innerHTML = `<i class="fa-solid fa-times"></i>`;
        sidebarState = true;
    }
}

let floatingMenuButton = document.querySelector('.floating-menu-button');
floatingMenuButton.addEventListener('click', () => {
    if (sidebarState) {
        blurLayer.style.display = 'none';
        sidebar.style.display = 'none';
        floatingMenuButton.innerHTML = `<i class="fa-solid fa-bars"></i>`;
        sidebarState = false;
    } else {
        if (window.innerWidth < 768) {
            blurLayer.style.display = 'block';
        }
        sidebar.style.display = 'flex';
        floatingMenuButton.innerHTML = `<i class="fa-solid fa-times"></i>`;
        sidebarState = true;
    }
});

let uploadButton = document.querySelector('#upload-file');
let fileInput = document.querySelector('#input-file');
uploadButton.addEventListener('click', () => {
    fileInput.click();
});
fileInput.addEventListener('change', () => {
    for (let i = 0; i < fileInput.files.length; i++) {
        upload(fileInput.files[i]);
    }
});

let newFolderButton = document.querySelector('#new-folder');
newFolderButton.addEventListener('click', () => {
    createFolder();
});

let sidebarOptions = document.querySelectorAll('.option');
let previousOption = null;
for (let i = 0; i < sidebarOptions.length; i++) {
    sidebarOptions[i].addEventListener('click', () => {
        let currOption = sidebarOptions[i]
        currOption.style.borderLeft = '5px solid #2e83f3a8';
        currOption.style.backgroundColor = '#ffffff09';
        if (previousOption && previousOption !== currOption) {
            previousOption.style.borderLeft = '5px solid transparent';
            previousOption.style.backgroundColor = 'transparent';
        }
        previousOption = currOption;
    });
}

let fileOptionsPanelCloseButton = document.querySelector('#file-options-panel-close');
fileOptionsPanelCloseButton.addEventListener('click', () => {
    let optionsPanel = document.querySelector('#file-options-panel');
    optionsPanel.style.display = 'none';
    blurLayer.style.display = 'none';
});

let folderOptionsPanelCloseButton = document.querySelector('#folder-options-panel-close');
folderOptionsPanelCloseButton.addEventListener('click', () => {
    let optionsPanel = document.querySelector('#folder-options-panel');
    optionsPanel.style.display = 'none';
    blurLayer.style.display = 'none';
});

let fileAceessControlButton = document.querySelector('#file-options-panel-access');
fileAceessControlButton.addEventListener('click', () => {
    if (globalContextFile.access === "private") {
        globalFileBucket[globalContextFile.hash].access = "public";
        fetch("/api/file/access", {
            method: 'POST',
            body: JSON.stringify({hash: globalContextFile.hash, access: "public"}),
        })
        .then(() => {
            showSnack("File access changed to public", colorGreen);
        })
        shareButton.innerHTML = `link`;
        embedButton.innerHTML = `code`;
        fileAceessControlButton.innerHTML = `<i class="fa-solid fa-eye"></i>`;
        fileAceessControlButton.style.backgroundColor = '#0561da';
    } else {
        globalFileBucket[globalContextFile.hash].access = "private";
        fetch("/api/file/access", {
            method: 'POST',
            body: JSON.stringify({hash: globalContextFile.hash, access: "private"}),
        })
        .then(() => {
            showSnack("File access changed to private", colorOrange);
        })
        shareButton.innerHTML = `link_off`;
        embedButton.innerHTML = `code_off`;
        fileAceessControlButton.innerHTML = `<i class="fa-solid fa-eye-slash"></i>`;
        fileAceessControlButton.style.backgroundColor = 'rgb(223, 61, 61)';
    }
});

let homeButton = document.querySelector('#home');
homeButton.addEventListener('click', () => {
    globalContextOption = "home";
    switchView();
    globalFileBucket = {};
    let pinnedBlock = null;
    let recentBlock = null;
    Promise.all([
        fetch("/api/query", {
            method: 'POST',
            body: JSON.stringify({"pinned": true}),
        })
        .then(response => response.json())
        .then(data => {
            if (data.length > 0) {
                pinnedBlock = buildPinnedContent(data);
            }
            data.forEach((file) => {
                globalFileBucket[file.hash] = file;
            });
        }),
        fetch("/api/metadata")
        .then(response => response.json())
        .then(data => {
            let sortedData = sortRecentFilesByTimeStamp(data);
            sortedData = sortedData.slice(0, 10);
            if (sortedData.length > 0) {
                recentBlock = buildRecentContent(sortedData);
            }
            sortedData.forEach((file) => {
                globalFileBucket[file.hash] = file;
            });
        })
    ]).then(() => {
        let homePage = buildHomePage(pinnedBlock, recentBlock);
        mainSection.innerHTML = '';
        mainSection.appendChild(homePage);
    });
});

let allFilesButton = document.querySelector('#all-files');
allFilesButton.addEventListener('click', () => {
    globalContextOption = "all-files";
    switchView();
    globalFileBucket = {};
    globalFolderQueue = [];
    fetch("/api/metadata")
    .then(response => response.json())
    .then(data => {
        let folders = [];
        let files = [];
        data.forEach((file) => {
            globalFileBucket[file.hash] = file;
            if (file.type === 'folder') {
                folders.push(file);
            } else {
                files.push(file);
            }
        });
        let allFilesData = folders.concat(files);
        let allFiles = buildAllFilesList(allFilesData);
        mainSection.innerHTML = '';
        mainSection.appendChild(buildAllFilesPage(allFiles));
        if (window.innerWidth < 768) {
            sidebarEventState(false);
        }
        updatePromptFragment();
    })
});

let queueButton = document.querySelector('#queue');
queueButton.addEventListener('click', () => {
    globalContextOption = "queue";
    switchView(false, true);
    if (window.innerWidth < 768) {
        sidebarEventState(false);
    }
});

let pdfButton = document.querySelector('#pdf');
pdfButton.addEventListener('click', () => {
    globalContextOption = "pdfs";
    renderCategory({"mime": "application/pdf"});
    if (window.innerWidth < 768) {
        sidebarEventState(false);
    }
});

let docsButton = document.querySelector('#docs');
docsButton.addEventListener('click', () => {
    globalContextOption = "docs";
    renderCategory({"mime?contains": "text"});
    if (window.innerWidth < 768) {
        sidebarEventState(false);
    }
});

let imgButton = document.querySelector('#image');
imgButton.addEventListener('click', () => {
    globalContextOption = "images";
    renderCategory({"mime?contains": "image"});
    if (window.innerWidth < 768) {
        sidebarEventState(false);
    }
});

let audioButton = document.querySelector('#audio');
audioButton.addEventListener('click', () => {
    globalContextOption = "audios";
    renderCategory({"mime?contains": "audio"});
    if (window.innerWidth < 768) {
        sidebarEventState(false);
    }
});

let videoButton = document.querySelector('#video');
videoButton.addEventListener('click', () => {
    globalContextOption = "videos";
    renderCategory({"mime?contains": "video"});
    if (window.innerWidth < 768) {
        sidebarEventState(false);
    }
});

let otherButton = document.querySelector('#others');
otherButton.addEventListener('click', () => {
    globalContextOption = "others";
    renderCategory({"mime?contains": "application", "mime?not_contains": "pdf"});
    if (window.innerWidth < 768) {
        sidebarEventState(false);
    }
});

let renameButton = document.querySelector('#rename-file');
renameButton.addEventListener('click', () => {
    let fileNameElem = document.querySelector('#options-panel-filename');
    fileNameElem.contentEditable = true;
    fileNameElem.spellcheck = false;
    fileNameElem.focus();
    fileNameElem.addEventListener('blur', (e) => {
        let oldName = globalContextFile.name;
        let oldNameExtension = oldName.split(".").pop();
        let updatedName = e.target.innerHTML;
        let updatedExtension = updatedName.split(".").pop();
        if (oldNameExtension !== updatedExtension) {
            e.target.innerHTML = oldName;
            showSnack("File extension cannot be changed", colorOrange);
            return;
        }
        if (updatedName === oldName) {
            return;
        }
        fetch(`/api/rename`, {
            method: "POST",
            body: JSON.stringify({
                hash: globalContextFile.hash,
                name: updatedName
            }),
        })
        .then((res) => {
            if (res.status === 200) {
                globalFileBucket[globalContextFile.hash].name = updatedName;
                document.querySelector(`#filename-${globalContextFile.hash}`).innerHTML = updatedName;
                showSnack(`File renamed to ${updatedName}`);
            }
        })
    });
});

let deleteButton = document.querySelector('#delete-file');
deleteButton.addEventListener('click', () => {
    fetch(`/api/metadata`, {
        method: "DELETE",
        body: JSON.stringify(globalContextFile),
    })
    .then(() => {
        showSnack(`Deleted ${globalContextFile.name}`, colorRed);
        document.getElementById(`file-${globalContextFile.hash}`).remove();
        updateSpaceUsage(-globalContextFile.size);
        fileOptionsPanelCloseButton.click();
    })
});

let pinButton = document.querySelector('#pin-file');
pinButton.addEventListener('click', () => {
    fetch(`/api/pin/${globalContextFile.hash}`, {method: "POST"})
    .then(() => {
        showSnack(`File pinned successfully!`);
        fileOptionsPanelCloseButton.click();
        let pinnedSection = document.querySelector('.pinned');
        if (pinnedSection) {
            pinnedSection.appendChild(newPinnedElem(globalContextFile));
        }
    })
});

let embedButton = document.querySelector('#embed-file');
embedButton.addEventListener('click', () => {
    if (globalContextFile.access === "private") {
        showSnack(`Make file public to embed`, colorOrange);
    } else if (globalContextFile.size > 4 * 1024 * 1024) {
        showSnack(`File is too large to embed`, colorRed);
    } else {
        let embedUrl = `${window.location.origin}/api/embed/${globalContextFile.hash}`;
        window.navigator.clipboard.writeText(embedUrl)
        .then(() => {
            showSnack(`Copied embed URL to clipboard`);
        })
    }
});

let shareButton = document.querySelector('#share-file');
shareButton.addEventListener('click', () => {
    if (globalContextFile.access === "private") {
        showSnack(`Make file public to share via link`, colorOrange);
    } else if (globalContextFile.size > 30 * 1024 * 1024) {
        showSnack(`File is too large to share via link`, colorRed);
    } else {
        let downloadUrl = `${window.location.origin}/shared/${globalContextFile.hash}`;
        window.navigator.clipboard.writeText(downloadUrl)
        .then(() => {
            showSnack(`Copied sharing URL to clipboard`);
        })
    }
});

let downloadButton = document.querySelector('#download-file');
downloadButton.addEventListener('click', () => {
    fileOptionsPanelCloseButton.click();
    download(globalContextFile);
    showSnack(`Downloaded ${globalContextFile.name}`);
});

let deleteFolderButton = document.querySelector('#delete-folder');
deleteFolderButton.addEventListener('click', () => {
    let folder = globalContextFile;
    let body = {
        "hash": folder.hash,
    };
    if (folder.parent) {
        body["children_path"] = `${folder.parent}/${folder.name}`;
    } else {
        body["children_path"] = `${folder.name}`;
    }
    fetch(`/api/remove/folder`, {
        method: "POST",
        body: JSON.stringify(body),
    })
    .then((resp) => {
        if (resp.status == 409) {
            showSnack(`Folder is not empty`, colorOrange);
            folderOptionsPanelCloseButton.click();
            return;
        }
        if (resp.status == 200) {
            showSnack(`Deleted ${folder.name}`, colorRed);
            document.getElementById(`file-${folder.hash}`).remove();
            folderOptionsPanelCloseButton.click();
        } 
    })
});

let pinFolderButton = document.querySelector('#pin-folder');
pinFolderButton.addEventListener('click', () => {
    fetch(`/api/pin/${globalContextFile.hash}`, {method: "POST"})
    .then(() => {
        showSnack(`File pinned successfully!`);
        fileOptionsPanelCloseButton.click();
    })
});

let searchBar = document.querySelector('#search-bar');
let inputTimer = null;
searchBar.addEventListener('input', () => {
    if (inputTimer) {
        clearTimeout(inputTimer);
    }
    inputTimer = setTimeout(() => {
        let query = searchBar.value;
        if (query.length == 0) {
            getContextOptionElem(globalContextOption).click();
            return;
        }
        fetch(`/api/query`, {
            method: "POST",
            body: JSON.stringify({"name?contains": query}),
        })
        .then(response => response.json())
        .then(data => {
            data = data.filter((file) => {
                return !(file.type === 'folder');
            });
            data.forEach((file) => {
                globalFileBucket[file.hash] = file;
            });
            let resultsPage = document.createElement('div');
            resultsPage.className = 'my-files';
            if (data.length > 0) {
                let p = document.createElement('p');
                p.innerHTML = `Search results for '${query}'`;
                resultsPage.appendChild(p);
                resultsPage.appendChild(buildAllFilesList(data));
                mainSection.innerHTML = '';
                mainSection.appendChild(resultsPage);
                switchView();
            } else {
                mainSection.innerHTML = '';
                let p = document.createElement('p');
                let symbol = `<i class="fa-solid fa-circle-exclamation"></i> `;
                p.innerHTML = `${symbol} No results found for '${query}'`;
                p.style.color = "rgb(247, 70, 70)";
                resultsPage.appendChild(p);
                mainSection.appendChild(resultsPage);
                switchView();
            }
        })
    }, 500);
});

mainSection.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
});

mainSection.addEventListener("drop", (e) => {
    e.preventDefault();
    if (e.dataTransfer.items) {
        [...e.dataTransfer.items].forEach((item) => {
            upload(item.getAsFile());
        })
    }
});

window.addEventListener('DOMContentLoaded', () => {
    mainSection.style.display = 'none';
    secondarySection.style.display = 'none';
    fetch("/api/consumption")
    .then(response => response.json())
    .then(data => {
        globalConsumption = getTotalSize(data);
        let totalSizeString = handleSizeUnit(globalConsumption);
        totalSizeWidget.innerHTML = `<i class="fa-solid fa-database"></i>Used ${totalSizeString}`;
    })
    homeButton.click();
});

window.addEventListener('resize', () => {
    blurLayer.style.display = 'none';
    if (window.innerWidth > 768) {
        sidebar.style.display = 'flex';
        sidebarState = true;
    } else {
        sidebar.style.display = 'none';
        floatingMenuButton.display = 'block';
        floatingMenuButton.innerHTML = `<i class="fa-solid fa-bars"></i>`;
        sidebarState = false;
    }
});

window.addEventListener("paste", (e) => {
    let items = e.clipboardData.items;
    if (items) {
        [...items].forEach((item) => {
            if (item.kind === "file") {
                upload(item.getAsFile());
            }
        })
    }
});