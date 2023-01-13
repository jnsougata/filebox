var globalFileBucket = {};
var globalFolderQueue = [];
let globalConsumption = 0;
var globalContextFile = null;
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


function switchView(primary = true, secondary = false) {
    if (primary) {
        mainSection.style.display = 'flex';
    } else {
        mainSection.style.display = 'none';
    }
    if (secondary) {
        secondarySection.style.display = 'flex';
    } else {
        secondarySection.style.display = 'none';
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

let optionsPanelCloseButton = document.querySelector('#options-panel-close');
optionsPanelCloseButton.addEventListener('click', () => {
    let optionsPanel = document.querySelector('.options-panel');
    optionsPanel.style.display = 'none';
    blurLayer.style.display = 'none';
});

let homeButton = document.querySelector('#home');
homeButton.addEventListener('click', () => {
    switchView();
    globalFileBucket = {};
    fetch("/api/metadata")
    .then(response => response.json())
    .then(data => {
        let pinnedData = data.slice(0, 10);
        let recentData = data.slice(0, 10); 
        let pinnedBlock = buildPinnedContent(pinnedData);
        let recentBlock = buildRecentContent(recentData);
        let homePage = buildHomePage(pinnedBlock, recentBlock);
        mainSection.innerHTML = '';
        mainSection.appendChild(homePage);
        if (window.innerWidth < 768) {
            sidebarEventState(false);
        }
        data.forEach((file) => {
            globalFileBucket[file.hash] = file;
        });
    })
});

let allFilesButton = document.querySelector('#all-files');
allFilesButton.addEventListener('click', () => {
    switchView();
    globalFileBucket = {};
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
    switchView(false, true);
    if (window.innerWidth < 768) {
        sidebarEventState(false);
    }
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
        optionsPanelCloseButton.click();
    })
});

let pinButton = document.querySelector('#pin-file');
pinButton.addEventListener('click', () => {
    // TODO: Pin file
});

let embedButton = document.querySelector('#embed-file');
embedButton.addEventListener('click', () => {
    if (globalContextFile.size > 4 * 1024 * 1024) {
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
    if (globalContextFile.size > 30 * 1024 * 1024) {
        showSnack(`File is too large to share via link`, colorRed);
    } else {
        let downloadUrl = `${window.location.origin}/download/${globalContextFile.hash}`;
        window.navigator.clipboard.writeText(downloadUrl)
        .then(() => {
            showSnack(`Copied download URL to clipboard`);
        })
    }
});

let downloadButton = document.querySelector('#download-file');
downloadButton.addEventListener('click', () => {
    optionsPanelCloseButton.click();
    download(globalContextFile);
    showSnack(`Downloaded ${globalContextFile.name}`);
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