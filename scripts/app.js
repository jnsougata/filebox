const COLOR_RED = "#CB1446";
const COLOR_GREEN = "#2AA850";
const COLOR_BLUE = "#2E83F3";
const COLOR_ORANGE = "#FF6700";
const COLOR_FILE_LOAD = "#8cb4fc";
const COLOR_DELETE_FOREVER = "#f23a3a";
const MAIN = document.querySelector("main");
const NAV_TOP = document.querySelector("nav");
const NAV_LEFT = document.querySelector(".nav_left");
const NAV_RIGHT = document.querySelector(".nav_right");
const BLUR_LAYER = document.querySelector(".blur_layer");
const TOTAL_USAGE = document.querySelector("#storage");

let controller;
let multiSelectBucketGL = [];
let isFileMovingGL = false;
let userIdGL = null;
let usageGL = 0;
let secretKeyGL = null;
let trashFilesGL = null;
let openedFolderGL = null;
let openedOptionGL = null;
let taskCountGL = -1;
let taskFactoryGL = {};
var fileContextMenuGL = null;


const fetchx = window.fetch;
window.fetch = async (...args) => {
  const response = await fetchx(...args);
  if (response.status === 502) {
    showSnack("Bad Gateway! Try again.", COLOR_ORANGE, "warning");
  }
  return response;
};

function currentOption() {
  let options = {
    recent: recentButton,
    browse: browseButton,
    pinned: pinnedButton,
    trash: trashButton,
    shared: sharedButton,
  };
  return options[openedOptionGL];
}

function closeSidebar() {
  BLUR_LAYER.style.display = "none";
  if (window.innerWidth < 768) {
    NAV_LEFT.style.display = "none";
  }
}

let previousOption = null;
let sidebarOptions = document.querySelectorAll(".nav_left_option");
Array.from(sidebarOptions).forEach((option) => {
  option.addEventListener("click", () => {
    option.style.borderLeft = "5px solid #2e83f3a8";
    option.style.backgroundColor = "#ffffff09";
    if (previousOption && previousOption !== option) {
      previousOption.style.borderLeft = "5px solid transparent";
      previousOption.style.backgroundColor = "transparent";
    }
    previousOption = option;
  });
});

let recentButton = document.querySelector("#recent");
recentButton.addEventListener("click", async () => {
  openedOptionGL = "recent";
  closeSidebar();
  renderOriginalNav();
  const resp = await fetch(`/api/metadata`);
  let data = await resp.json();
  MAIN.innerHTML = "";
  if (data) {
    data = sortFileByTimestamp(data).slice(0, 10);
    let list = document.createElement("ul");
    MAIN.appendChild(list);
    data.forEach((file) => {
      list.appendChild(newFileElem(file));
    });
  } else {
    let greeted = localStorage.getItem("isGreeted");
    if (!greeted) {
      renderGreetings();
    }
  }
});

let browseButton = document.querySelector("#browse");
browseButton.addEventListener("click", async () => {
  openedOptionGL = "browse";
  openedFolderGL = null;
  closeSidebar();
  if (!isFileMovingGL) {
    renderOriginalNav();
  }
  const resp = await fetch(`/api/root`);
  const data = await resp.json();
  MAIN.innerHTML = "";
  if (!data) {
    MAIN.innerHTML = `<p>You don't have any file or folder</p>`;
    return;
  }
  let files = [];
  let folders = [];
  data.forEach((file) => {
    file.type === "folder" ? folders.push(file) : files.push(file);
  });
  MAIN.appendChild(buildPrompt({ parent: null }));
  let list = document.createElement("ul");
  MAIN.appendChild(list);
  folders.concat(files).forEach((file) => {
    list.appendChild(newFileElem(file));
  });
  updateFolderStats(folders);
  document.querySelector(".fragment").innerText = "home";
});

let pinnedButton = document.querySelector("#pinned");
pinnedButton.addEventListener("click", async () => {
  openedOptionGL = "pinned";
  closeSidebar();
  renderOriginalNav();
  const resp = await fetch("/api/query", {
    method: "POST",
    body: JSON.stringify({ pinned: true, "deleted?ne": true }),
  });
  let data = await resp.json();
  MAIN.innerHTML = "";
  if (!data) {
    MAIN.innerHTML = `<p>You don't have any pinned file or folder</p>`;
    return;
  }
  let files = [];
  let folders = [];
  data.forEach((file) => {
    file.type === "folder" ? folders.push(file) : files.push(file);
  });
  let list = document.createElement("ul");
  MAIN.appendChild(list);
  folders.concat(files).forEach((file) => {
    list.appendChild(newFileElem(file));
  });
});

let sharedButton = document.querySelector("#shared");
sharedButton.addEventListener("click", async () => {
  openedOptionGL = "shared";
  closeSidebar();
  renderOriginalNav();
  MAIN.innerHTML = "";
  let fileList = document.createElement("div");
  fileList.className = "file_list";
  const resp = await fetch(`/api/query`, {
    method: "POST",
    body: JSON.stringify({ parent: "~shared" }),
  });
  let data = await resp.json();
  if (!data) {
    MAIN.innerHTML = `<p>You haven't received any file</p>`;
    return;
  }
  let list = document.createElement("ul");
  MAIN.appendChild(list);
  data.forEach((file) => {
    list.appendChild(newFileElem(file));
  });
});

let trashButton = document.querySelector("#trash");
trashButton.addEventListener("click", async () => {
  openedOptionGL = "trash";
  renderOriginalNav();
  const resp = await fetch("/api/query", {
    method: "POST",
    body: JSON.stringify({ deleted: true }),
  });
  const data = await resp.json();
  MAIN.innerHTML = "";
  if (!data) {
    MAIN.innerHTML = `<p>There is no trash file</p>`;
    return;
  }
  dataMap = {};
  data.forEach((file) => {
    dataMap[file.hash] = file;
  });
  trashFilesGL = dataMap;
  let list = document.createElement("ul");
  MAIN.appendChild(list);
  data.forEach((file) => {
    list.appendChild(newFileElem(file, true));
  });
  closeSidebar();
});

let sanitizeButton = document.querySelector("#sanitize");
sanitizeButton.addEventListener("click", async () => {
  const resp = await fetch("/api/sanitize");
	const data = await resp.json();
	showSnack(`${data.sanitized} files sanitized `, COLOR_GREEN, "success");
});

let queueButton = document.querySelector("#queue");
queueButton.addEventListener("click", () => {
  closeSidebar();
  renderQueue();
});

let filePreviewModal = document.querySelector(".file_preview");
filePreviewModal.addEventListener("click", () => {
  filePreviewModal.innerHTML = "";
  filePreviewModal.close();
  controller.abort();
});

let usernameField = document.querySelector("#username");
usernameField.addEventListener("click", () => {
  if (!userIdGL) {
    showSnack("Can not extract user id from domain name", COLOR_RED, "error");
    return;
  }
  navigator.clipboard.writeText(userIdGL).then(() => {
    showSnack("User Id copied to clipboard!", COLOR_GREEN, "success");
  });
});

MAIN.addEventListener("dragover", (e) => {
  e.preventDefault();
  e.stopPropagation();
});

MAIN.addEventListener("drop", (e) => {
  e.preventDefault();
  if (e.dataTransfer.items) {
    [...e.dataTransfer.items].forEach((item) => {
      let file = item.getAsFile();
      let metadata = buildFileMetadata(file);
      prependQueueElem(metadata, true);
      upload(file, metadata, (percentage) => {
        progressHandlerById(metadata.hash, percentage);
      });
    });
  }
});

BLUR_LAYER.addEventListener("click", () => {
  closeSidebar();
  hideRightNav();
});

window.addEventListener("DOMContentLoaded", async () => {
  await fetch("/api/sanitize");
  browseButton.click();
  renderOriginalNav();
  let resp = await fetch(`/api/key`);
  let data = await resp.json();
  secretKeyGL = data.key;
  let globalUserIdParts = /-(.*?)\./.exec(window.location.hostname);
  userIdGL = globalUserIdParts ? globalUserIdParts[1] : null;
  document.querySelector("#username").innerHTML = userIdGL
    ? userIdGL
    : "Anonymous";
  resp = await fetch("/api/consumption");
  data = await resp.json();
  updateSpaceUsage(data.size);
});

window.addEventListener("load", () => {
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

document.addEventListener("click", (e) => {
  if (e.target.tagName === "DIALOG" && fileContextMenuGL) {
    fileContextMenuGL.close();
  }
});

window.addEventListener("resize", () => {
  let navIcon = document.querySelector("#dyn-nav-icon");
  if (navIcon) {
    navIcon.parentNode.replaceChild(buildDynamicNavIcon(), navIcon);
  }
  if (window.innerWidth > 768) {
    NAV_LEFT.style.display = "flex";
  } else {
    NAV_LEFT.style.display = "none";
    if (fileContextMenuGL) {
      fileContextMenuGL.close();
    }
  }
  BLUR_LAYER.click();
});

window.addEventListener("paste", (e) => {
  let items = e.clipboardData.items;
  if (items.length) {
    [...items].forEach((item) => {
      if (item.kind === "file") {
        let file = item.getAsFile();
        let metadata = buildFileMetadata(file);
        prependQueueElem(metadata, true);
        upload(file, metadata, (percentage) => {
          progressHandlerById(metadata.hash, percentage);
        });
      }
    });
  }
});
