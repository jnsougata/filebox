const colorRed = "#CB1446";
const colorGreen = "#2AA850";
const colorBlue = "#2E83F3";
const colorOrange = "#FF6700";
let sidebarState = false;
let globalSecretKey = null;
let globalFolderQueue = [];
let globalConsumption = 0;
let globalMediaBlob = null;
let globalContextFile = null;
let globalContextFolder = null;
let globalContextOption = null;
let globalTrashFiles = null;
let extraPanelState = false;
let globalMultiSelectBucket = [];
let globalMultiSelectBucketUpdate = true;
let sidebar = document.querySelector('.sidebar');
let blurLayer = document.querySelector('.blur-layer');
let mainSection = document.querySelector('#main');
let taskQueueElem = document.querySelector('.queue');
let totalSizeWidget = document.querySelector('.bottom_option');
let extraRenderingPanel = document.querySelector('.extras');

function filterNonDeletedFiles(files) {
    return files.filter((file) => {
        if (file.deleted !== true) {
            return true;
        }
    });
}

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
        "trash": trashButton,
    }
    return options[option];
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

function sidebarOptionSwitch() {
    if (window.innerWidth < 768) {
        sidebarEventState(false);
    }
    globalContextFolder = null;
    fileOptionPanel.style.display = 'none';
    if (extraPanelState) {
        extraRenderingPanel.style.display = 'flex';
    } else {
        extraRenderingPanel.style.display = 'none';
    }
    if (globalMultiSelectBucketUpdate) {
        globalMultiSelectBucket = [];
        globalMultiSelectBucketUpdate = false;
    }
}

let floatingMenuButton = document.querySelector('.floating_menu');
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
    queueButton.click();
    for (let i = 0; i < fileInput.files.length; i++) {
        upload(fileInput.files[i]);
    }
});

let newFolderButton = document.querySelector('#new-folder');
newFolderButton.addEventListener('click', () => {
    createFolder();
});

let sidebarOptions = document.querySelectorAll('.sidebar_option');
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

let homeButton = document.querySelector('#home');
homeButton.addEventListener('click', () => {
    globalContextOption = "home";
    sidebarOptionSwitch();
    let pinnedBlock = null;
    let recentBlock = null;
    Promise.all([
        fetch("/api/query", {
            method: 'POST',
            body: JSON.stringify({"pinned": true}),
        })
        .then(response => response.json())
        .then(data => {
            data = filterNonDeletedFiles(data);
            if (data.length > 0) {
                pinnedBlock = buildPinnedContent(data);
            }
        }),
        fetch("/api/metadata")
        .then(response => response.json())
        .then(data => {
            data = filterNonDeletedFiles(data);
            let sortedData = sortRecentFilesByTimeStamp(data);
            sortedData = sortedData.slice(0, 9);
            if (sortedData.length > 0) {
                recentBlock = buildRecentContent(sortedData);
            }
        })
    ])
    .then(() => {
        let homePage = buildHomePage(pinnedBlock, recentBlock);
        mainSection.innerHTML = '';
        mainSection.appendChild(homePage);
    });
});

let allFilesButton = document.querySelector('#my-files');
allFilesButton.addEventListener('click', () => {
    globalContextOption = "all-files";
    globalContextFolder = null;
    sidebarOptionSwitch();
    globalFolderQueue = [];
    fetch("/api/metadata")
    .then(response => response.json())
    .then(data => {
        data = filterNonDeletedFiles(data);
        let folders = [];
        let files = [];
        data.forEach((file) => {
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

let queueModal = document.querySelector('.queue');
let queueModalCloseButton = document.querySelector('.queue_close');
queueModalCloseButton.addEventListener('click', () => {
    queueModal.style.display = 'none';
});
let queueButton = document.querySelector('#queue');
queueButton.addEventListener('click', () => {
    globalContextOption = "queue";
    queueModal.style.display = 'block';
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

let trashButton = document.querySelector('#trash');
trashButton.addEventListener('click', () => {
    sidebarOptionSwitch();
    globalContextOption = "trash";
    fetch("/api/query", {method: "POST", body: JSON.stringify({"deleted": true})})
    .then(response => response.json())
    .then(data => {
        let fileList = document.createElement('div');
        fileList.className = 'file_list';
        let ul = document.createElement('ul');
        ul.className = 'all_files';
        globalTrashFiles = data;
        data.forEach((file) => {
            ul.appendChild(newFileElem(file, true));
        });
        fileList.appendChild(ul);
        let trashOptios = document.createElement('div');
        trashOptios.className = ('trash_options');
        let p = document.createElement('p');
        p.innerHTML = 'Empty trash?';
        p.style.color = 'white';
        p.style.fontSize = '14px';
        trashOptios.appendChild(p);
        let emptyTrash = document.createElement('button');
        emptyTrash.innerHTML = '<i class="fa-solid fa-trash"></i>';
        if (data.length === 0) {
            extraRenderingPanel.style.display = 'none';
            showSnack("There's nothing in the trash!", colorOrange);
        }
        emptyTrash.addEventListener('click', () => {
            if (globalTrashFiles.length === 0) {
                extraRenderingPanel.style.display = 'none';
            }
            fetch('/api/bulk', {method: 'DELETE', body: JSON.stringify(globalTrashFiles)})
            .then(() => {
                showSnack('Trash Emptied Successfully!');
                let totalSpaceFreed = 0;
                globalTrashFiles.forEach((file) => {
                    totalSpaceFreed += file.size;
                });
                updateSpaceUsage(-totalSpaceFreed);
                fileList.innerHTML = '';
                extraRenderingPanel.style.display = 'none';
            })
        });
        mainSection.innerHTML = '';
        if (data.length > 0) {
            trashOptios.appendChild(emptyTrash);
            extraRenderingPanel.innerHTML = '';
            extraRenderingPanel.appendChild(trashOptios);
            extraRenderingPanel.style.display = 'flex';
            mainSection.appendChild(fileList);
            extraPanelState = false;
        }
    });
    if (window.innerWidth < 768) {
        sidebarEventState(false);
    }    
});

let searchBar = document.querySelector('#search-bar');
let inputTimer = null;
searchBar.addEventListener('input', () => {
    if (inputTimer) {
        clearTimeout(inputTimer);
    }
    inputTimer = setTimeout(() => {
        let query = searchBar.value;
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
            data = data.filter((file) => {
                return !(file.type === 'folder');
            });
            let resultsPage = document.createElement('div');
            resultsPage.className = 'my_files';
            if (data.length > 0) {
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
                sidebarOptionSwitch();
            } else {
                mainSection.innerHTML = '';
                let p = document.createElement('p');
                let symbol = `<i class="fa-solid fa-circle-exclamation"></i> `;
                p.innerHTML = `${symbol} No results found for '${query}'`;
                p.style.color = "rgb(247, 70, 70)";
                resultsPage.appendChild(p);
                mainSection.appendChild(resultsPage);
                sidebarOptionSwitch();
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

let modal = document.querySelector('.modal');
let modalContent = document.querySelector('.modal_content');
modalContent.addEventListener('click', () => {
    handleModalClose();
});
let modalCloseButton = document.querySelector('.modal_close');
modalCloseButton.addEventListener('click', () => {
    handleModalClose();
});

function handleModalClose() {
    modal.style.display = 'none';
    modalContent.innerHTML = '';
    if (globalMediaBlob) {
        URL.revokeObjectURL(globalMediaBlob);
        globalMediaBlob = null;
    }
}

window.addEventListener('DOMContentLoaded', () => {
    fetch("/api/consumption")
    .then(response => response.json())
    .then(data => {
        globalConsumption = getTotalSize(data);
        let totalSizeString = handleSizeUnit(globalConsumption);
        totalSizeWidget.innerHTML = `<i class="fa-solid fa-database"></i>Used ${totalSizeString}`;
    })
    homeButton.click();
    fetch("/api/secret")
    .then(response => response.text())
    .then(data => {
        globalSecretKey = data;
    })
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
        queueButton.click();
        [...items].forEach((item) => {
            if (item.kind === "file") {
                upload(item.getAsFile());
            }
        })
    }
});