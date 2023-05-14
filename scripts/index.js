const colorRed = "#CB1446";
const colorGreen = "#2AA850";
const colorBlue = "#2E83F3";
const colorOrange = "#FF6700";
let runningTaskCount = 0;
let isFileMoving = false;
let globalUserId = null;
let globalConsumption = 0;
let globalFolderQueue = [];
let globalSecretKey = null;
let globalTrashFiles = null;
let globalContextFile = null;
let isUserSubscribed = false;
let globalPreviewFile = null;
let globalContextFolder = null;
let globalContextOption = null;
let globalDiscoveryStatus = null;
let globalMultiSelectBucket = [];
let navBar = document.querySelector('nav');
let sidebar = document.querySelector('.sidebar');
let blurLayer = document.querySelector('.blur_layer');
let mainSection = document.querySelector('main');
let taskQueueElem = document.querySelector('.queue');
let totalSizeWidget = document.querySelector('#storage');


const fetchx = window.fetch;
window.fetch = async (...args) => {
    const response = await fetchx(...args);
    if (response.status === 502) {
        showSnack("Bad Gateway! Try again.", colorOrange, 'warning');
    }
    return response;
};

function filterNonDeletedFiles(files) {
    return files.filter((file) => {
        if (file.deleted !== true) {
            return true;
        }
    });
}

function getContextOptionElem() {
    let options = {
        "recent": recentButton,
        "browse": browseButton,
        "pinned": pinnedButton,
        "trash": trashButton,
        "shared": sharedButton,
        "pdfs": pdfButton,
        "images": imgButton,
        "videos": videoButton,
        "audios": audioButton,
        "docs": docsButton,
        "others": otherButton,
    }
    return options[globalContextOption];
}

function sidebarState(enabled = true) {
    if (!enabled) {
        blurLayer.style.display = 'none';
        sidebar.style.display = 'none';
    } else {
        sidebar.style.display = 'flex';
        if (window.innerWidth < 768) {
            blurLayer.style.display = 'block';
        }
    }
}

function sidebarOptionSwitch() {
    if (window.innerWidth < 768) {
        sidebarState(false);
    }
    renderOriginalNav();
    globalContextFolder = null;
    fileOptionPanel.style.display = 'none';
}

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

let recentButton = document.querySelector('#recent');
recentButton.addEventListener('click', () => {
    globalContextOption = "recent";
    globalContextFolder = null;
    fileOptionPanel.style.display = 'none';
    if (window.innerWidth < 768) {
        sidebarState(false);
    }
    renderOriginalNav();
    fetch(`/api/metadata`)
    .then(response => response.json())
    .then(data => {
        if (data) {
            data = sortFileByTimestamp(data)
            mainSection.innerHTML = '';
            mainSection.appendChild(buildRecentContent(data.slice(0, 10)));
        } else {
            let greeted = localStorage.getItem('isGreeted')
            if (!greeted) {
                renderGreetings();
            }
        }
    })
});

let browseButton = document.querySelector('#browse');
browseButton.addEventListener('click', () => {
    globalContextOption = "browse";
    globalContextFolder = null;
    fileOptionPanel.style.display = 'none';
    if (window.innerWidth < 768) {
        sidebarState(false);
    }
    if (!isFileMoving) {
        renderOriginalNav();
    }
    globalFolderQueue = [];
    fetch(`/api/metadata`)
    .then(response => response.json())
    .then(data => {
        let files = [];
        let folders = [];
        data.forEach((file) => {
            if (!file.parent){
                if (file.type === 'folder') {
                    folders.push(file);
                } else {
                    files.push(file);
                }
            }
        });
        let fileView = document.createElement('div');
        fileView.className = 'my_files';
        fileView.appendChild(buildPrompt(files));
        fileView.appendChild(buildFileBrowser(folders.concat(files)));
        mainSection.innerHTML = '';
        mainSection.appendChild(fileView);
        updateFolderStats(folders);
        updatePromptFragment();
    })
});

let sharedButton = document.querySelector('#shared');
sharedButton.addEventListener('click', () => {
    globalContextOption = "shared";
    if (window.innerWidth < 768) {
        sidebarState(false);
    }
    if (!isFileMoving) {
        renderOriginalNav();
    }
    mainSection.innerHTML = '';
    let fileList = document.createElement('div');
    fileList.className = 'file_list';
    fetch(`/api/query`, {method: "POST", body: JSON.stringify({"parent": "~shared"})})
    .then((resp) => {
        if (resp.status === 200) {
            return resp.json();
        }
        return [];
    })
    .then(data => {
        if (data) {
            let pendingFiles = data.filter((file) => file.pending);
            let acceptedFiles = data.filter((file) => !file.pending);
            if (pendingFiles.length > 0) {
                fileList.appendChild(buildTitleP('Pending Files'));
                fileList.appendChild(buildPendingFileList(pendingFiles));
            }
            if (acceptedFiles.length > 0) {
                let ul = document.createElement('ul');
                ul.className = 'all_files';
                fileList.appendChild(buildTitleP('Files Received '));
                data.forEach((file) => {
                    ul.appendChild(newFileElem(file));
                });
                fileList.appendChild(ul);
            } 
            mainSection.appendChild(fileList);
        } else {
            showSnack("You don't have any shared file.", colorOrange, 'info');
        }
    })
});

let pinnedButton = document.querySelector('#pinned');
pinnedButton.addEventListener('click', () => {
    globalContextOption = "pinned";
    if (window.innerWidth < 768) {
        sidebarState(false);
    }
    fetch("/api/query", {method: 'POST', body: JSON.stringify({"pinned": true, "deleted?ne": true}),
    })
    .then(response => response.json())
    .then(data => {
        if (data) {
            let folders = data.filter((file) => {
                return file.type === 'folder';
            });
            let files = data.filter((file) => {
                return file.type !== 'folder';
            });
            data = folders.concat(files);
            mainSection.innerHTML = '';
            mainSection.appendChild(buildPinnedContent(data));

        } else {
            showSnack("You don't have any pinned file.", colorOrange, 'info');
        }
    })
});

let queueModal = document.querySelector('.queue');
let queueModalCloseButton = document.querySelector('.queue_close');
queueModalCloseButton.addEventListener('click', () => {
    blurLayer.style.display = 'none';
    queueModal.style.display = 'none';
});
let queueButton = document.querySelector('#queue');
queueButton.addEventListener('click', () => {
    blurLayer.style.display = 'block';
    if (window.innerWidth < 768) {
        sidebarState(false);
    }
    blurLayer.style.display = 'block';
    queueModal.style.display = 'block';
});

let pdfButton = document.querySelector('#pdfs');
pdfButton.addEventListener('click', () => {
    globalContextOption = "pdfs";
    renderFilesByMime({"mime": "application/pdf"});
});

let docsButton = document.querySelector('#docs');
docsButton.addEventListener('click', () => {
    globalContextOption = "docs";
    renderFilesByMime({"mime?contains": "text"});
});

let imgButton = document.querySelector('#images');
imgButton.addEventListener('click', () => {
    globalContextOption = "images";
    renderFilesByMime({"mime?contains": "image"});
});

let audioButton = document.querySelector('#audios');
audioButton.addEventListener('click', () => {
    globalContextOption = "audios";
    renderFilesByMime({"mime?contains": "audio"});
});

let videoButton = document.querySelector('#videos');
videoButton.addEventListener('click', () => {
    globalContextOption = "videos";
    renderFilesByMime({"mime?contains": "video"});
});

let otherButton = document.querySelector('#others');
otherButton.addEventListener('click', () => {
    globalContextOption = "others";
    renderFilesByMime({"mime?contains": "application", "mime?not_contains": "pdf"});
});

let trashButton = document.querySelector('#trash');
trashButton.addEventListener('click', () => {
    renderOriginalNav();
    sidebarOptionSwitch();
    globalContextOption = "trash";
    fetch("/api/query", {method: "POST", body: JSON.stringify({"deleted": true})})
    .then(response => response.json())
    .then(data => {
        mainSection.innerHTML = '';
        if (!data) {
            showSnack("There's nothing in the trash", colorOrange, 'info');
            return;
        }
        let fileList = document.createElement('div');
        fileList.className = 'file_list';
        let ul = document.createElement('ul');
        ul.className = 'all_files';
        globalTrashFiles = data;
        data.forEach((file) => {
            ul.appendChild(newFileElem(file, true));
        });
        fileList.appendChild(ul);
        let trashOptions = document.createElement('div');
        trashOptions.className = ('trash_options');
        let p = document.createElement('p');
        p.innerHTML = 'Empty trash?';
        p.style.color = 'white';
        p.style.fontSize = '14px';
        trashOptions.appendChild(p);
        mainSection.appendChild(fileList);
    });
    if (window.innerWidth < 768) {
        sidebarState(false);
    }    
});

let usernameField = document.querySelector('#username');
usernameField.addEventListener('click', () => {
    if (!globalUserId) {
        showSnack('Can not extract user id from domain name', colorRed, 'error');
        return;
    }
    navigator.clipboard.writeText(globalUserId)
    .then(() => {
        showSnack('User Id copied to clipboard!', colorGreen, 'success');
    })
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

function handleModalClose() {
    modal.style.display = 'none';
    modalContent.innerHTML = '';
}

let modal = document.querySelector('.modal');
let modalContent = document.querySelector('.modal_content');
let modalCloseButton = document.querySelector('.modal_close');
modalCloseButton.addEventListener('click', () => {
    handleModalClose();
});

blurLayer.addEventListener('click', () => {
    if (sidebar.style.display === 'flex' && window.innerWidth < 768) {
        sidebarState(false);
    }
    if (fileOptionPanel.style.display === 'flex') {
        fileOptionPanel.style.display = 'none';
        
    }
    if (queueModal.style.display === 'block') {
        queueModal.style.display = 'none';
    }
    blurLayer.style.display = 'none';
});

window.addEventListener('DOMContentLoaded', () => {
    renderOriginalNav();
    fetch(`/api/key`)
    .then((response) => response.json())
    .then((data) => {
        handleStartup(data.key);
    })
});


window.addEventListener('load', () => {
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/service-worker.js");
    } else {
        console.log("Service worker not supported");
    }
    // let isNotificationsEnabled = localStorage.getItem('notifications');
    // if (isNotificationsEnabled === null) {
    //     return;
    // } else if (isNotificationsEnabled === 'granted') {
    //     return;
    // } else if (isNotificationsEnabled === 'denied') {
    //     return;
    // } else {
    //     Notification.requestPermission().then((result) => {
    //         if (result === 'granted') {
    //             localStorage.setItem('notifications', true);
    //         }
    //     });
    // }
});

window.addEventListener('resize', () => {
    let navIcon = document.querySelector('#dyn-nav-icon');
    if (navIcon) {
        navIcon.parentNode.replaceChild(buildDynamicNavIcon(), navIcon);
    }
    if (window.innerWidth > 768) {
        sidebar.style.display = 'flex';
    } else {
        sidebar.style.display = 'none';
        cm.style.display = 'none';
    }
});

window.addEventListener("paste", (e) => {
    let items = e.clipboardData.items;
    let newTaskStarted = false;
    if (items.length) {
        [...items].forEach((item) => {
            if (item.kind === "file") {
                upload(item.getAsFile());
                newTaskStarted = true;
            }
        })
    }
    if (newTaskStarted) {
        queueButton.click();
    }
});