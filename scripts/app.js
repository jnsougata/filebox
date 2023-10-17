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
const ACTIVITY = document.querySelector("#activity");
const HIDDEN_FILE_INPUT = document.querySelector("#file-input");
const HIDDEN_FOLDER_INPUT = document.querySelector("#folder-input");
const CLEAR_QUERY = document.querySelector("#clear-query");
const SEARCH_INPUT = document.querySelector("#search-input");
const CREATE_NEW_FOLDER = document.querySelector("#create-new-folder");
const DRIVE_FOLDER_UPLOAD = document.querySelector("#drive-folder-upload");
const DRIVE_FILE_UPLOAD = document.querySelector("#upload-file");
const MENU = document.querySelector("#menu");
const SEARCH_ICON = document.querySelector("#search-icon");
const PREVIEW_MODAL = document.querySelector(".file_preview");

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
    browse: browseButton,
    pinned: pinnedButton,
    recent: recentButton,
    shared: sharedButton,
    trash: trashButton,
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
const sidebarOptions = document.querySelectorAll(".nav_left_option");
Array.from(sidebarOptions).forEach((option) => {
  option.addEventListener("click", () => {
    option.style.backgroundColor = "var(--nav-left-option-bg)";
    if (previousOption && previousOption !== option) {
      previousOption.style.backgroundColor = "transparent";
    }
    previousOption = option;
  });
});

const recentButton = document.querySelector("#recent");
recentButton.addEventListener("click", async () => {
  openedFolderGL = null;
  openedOptionGL = "recent";
  closeSidebar();
  const resp = await fetch(`/api/query`, {
    method: "POST",
    body: JSON.stringify({ "deleted?ne": true, "type?ne": "folder" }),
  });
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
    MAIN.innerHTML = `<p>You don't have any file or folder</p>`;
  }
});

const browseButton = document.querySelector("#browse");
browseButton.addEventListener("click", async () => {
  openedOptionGL = "browse";
  openedFolderGL = null;
  BLUR_LAYER.click();
  const resp = await fetch(`/api/query`, {
    method: "POST",
    body: JSON.stringify({ parent: null, "deleted?ne": true }),
  });
  const data = await resp.json();
  MAIN.innerHTML = "";
  if (!data && !localStorage.getItem("isGreeted")) {
    renderGreetings();
    return;
  } else if (!data) {
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

const pinnedButton = document.querySelector("#pinned");
pinnedButton.addEventListener("click", async () => {
  openedFolderGL = null;
  openedOptionGL = "pinned";
  BLUR_LAYER.click();
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

const sharedButton = document.querySelector("#shared");
sharedButton.addEventListener("click", async () => {
  openedFolderGL = null;
  openedOptionGL = "shared";
  BLUR_LAYER.click();
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

const trashButton = document.querySelector("#trash");
trashButton.addEventListener("click", async () => {
  openedFolderGL = null;
  openedOptionGL = "trash";
  BLUR_LAYER.click();
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
});

const migrateV2Button = document.querySelector("#migrateV2");
migrateV2Button.addEventListener("click", async () => {
  const resp = await fetch("/api/query", {
    method: "POST",
    body: JSON.stringify({})
  });
  const data = await resp.json();
  data.forEach(async (file) => {
    const r = await fetch(`/api/v2/migrate`, {
      method: "POST",
      body: JSON.stringify(file)
    });
    if (r.status === 207) {
     showSnack(`Migration successfull (${file.hash})`, COLOR_GREEN, "success"); 
    } else {
      showSnack(`Migration failed (${file.hash})`, COLOR_ORANGE, "error");
    }
  })
})

const themeButton = document.querySelector("#theme");
themeButton.addEventListener("click", async () => {
  let lightMode = localStorage.getItem("light-mode");
  if (lightMode === "true") {
    localStorage.setItem("light-mode", false);
    document.body.classList.remove("light-mode");
    themeButton.innerHTML = "light_mode";
  } else {
    localStorage.setItem("light-mode", true);
    document.body.classList.add("light-mode");
    themeButton.innerHTML = "dark_mode";
  }
});

const queueButton = document.querySelector("#queue");
queueButton.addEventListener("click", () => {
  closeSidebar();
  renderQueue();
});

let usernameField = document.querySelector("#username");
usernameField.addEventListener("click", () => {
  if (!userIdGL) {
    showSnack("Can not extract user id from domain name", COLOR_RED, "error");
    return;
  }
  navigator.clipboard.writeText(userIdGL).then(() => {
    showSnack("User Id copied to clipboard", COLOR_GREEN, "success");
  });
});

let logo = document.querySelector(".logo")
logo.addEventListener("click", async () => {
  window.open("https://github.com/jnsougata/filebox", "_blank");
})

MENU.addEventListener("click", (e) => {
  NAV_LEFT.style.display = "flex";
  BLUR_LAYER.style.display = "block";
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
    navigator.serviceWorker.register("/worker.js");
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
  if (localStorage.getItem("light-mode") === "true") {
    document.body.classList.add("light-mode");
    themeButton.innerHTML = "dark_mode";
  }
});

document.addEventListener("click", (e) => {
  if (e.target.tagName === "DIALOG" && fileContextMenuGL) {
    fileContextMenuGL.close();
  }
});

window.addEventListener("resize", () => {
  if (window.innerWidth > 768) {
    MENU.style.display = "none";
    SEARCH_ICON.style.display = "flex";
    NAV_LEFT.style.display = "flex";
  } else {
    MENU.style.display = "flex";
    SEARCH_ICON.style.display = "none";
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

window.addEventListener("beforeunload", (e) => {
  if (taskCountGL > 0) {
    e.preventDefault();
    e.returnValue = "";
  }
});

let searched = false;
let searchInputTimer = null;
SEARCH_INPUT.addEventListener("input", (ev) => {
  if (searchInputTimer) {
    clearTimeout(searchInputTimer);
  }
  searchInputTimer = setTimeout(() => {
    if (ev.target.value.length > 0) {
      searched = true;
      CLEAR_QUERY.style.display = "flex";
      let matches = /:(.*?) (.*)/.exec(ev.target.value);
      if (matches) {
        let attr = matches[1];
        let contains = matches[2];
        renderSearchResults({ [`${attr}?contains`]: `${contains}` });
      } else {
        renderSearchResults({ "name?contains": `${ev.target.value}` });
      }
    }
  }, 500);
});

CREATE_NEW_FOLDER.addEventListener("click", () => {
  createFolder();
});

CLEAR_QUERY.addEventListener("click", () => {
  CLEAR_QUERY.style.display = "none";
  currentOption().click();
  SEARCH_INPUT.value = "";
});

DRIVE_FILE_UPLOAD.addEventListener("click", () => {
  HIDDEN_FILE_INPUT.click();
});

DRIVE_FOLDER_UPLOAD.addEventListener("click", () => {
  HIDDEN_FOLDER_INPUT.click();
});

HIDDEN_FILE_INPUT.addEventListener("change", (ev) => {
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

HIDDEN_FOLDER_INPUT.addEventListener("change", (ev) => {
  let relativePaths = [];
  for (let i = 0; i < ev.target.files.length; i++) {
    relativePaths.push(ev.target.files[i].webkitRelativePath);
  }
  let uniqueFolders = [];
  for (let i = 0; i < relativePaths.length; i++) {
    let folderPath = relativePaths[i].split("/");
    folderPath.pop();
    folderPath = folderPath.join("/");
    if (!uniqueFolders.includes(folderPath)) {
      uniqueFolders.push(folderPath);
    }
  }
  let parents = [];
  uniqueFolders.forEach((folder) => {
    let folderPath = folder.split("/");
    let currentPath = "";
    folderPath.forEach((folder) => {
      currentPath += folder + "/";
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
    if (openedFolderGL) {
      if (openedFolderGL.parent) {
        relativePath = `${openedFolderGL.parent}/${openedFolderGL.name}`;
      } else {
        relativePath = openedFolderGL.name;
      }
    }
    let folderName;
    let folderPath = "";
    if (parent.includes("/")) {
      let parentParts = parent.split("/");
      folderName = parentParts.pop();
      folderPath = `${parentParts.join("/")}`;
    } else {
      folderName = parent;
    }
    if (relativePath && folderPath) {
      folderPath = `${relativePath}/${folderPath}`;
    } else if (relativePath) {
      folderPath = relativePath;
    }
    let body = {
      name: folderName,
      type: "folder",
      hash: randId(),
      date: new Date().toISOString(),
    };
    body.parent = folderPath ? folderPath : null;
    fetch(`/api/metadata`, { method: "POST", body: JSON.stringify(body) });
  });
  for (let i = 0; i < ev.target.files.length; i++) {
    let file = ev.target.files[i];
    let relativePath = ev.target.files[i].webkitRelativePath;
    let parentFragments = relativePath.split("/");
    parentFragments.pop();
    let parent = parentFragments.join("/");
    if (openedFolderGL) {
      if (openedFolderGL.parent) {
        parent = `${openedFolderGL.parent}/${openedFolderGL.name}/${parent}`;
      } else {
        parent = `${openedFolderGL.name}/${parent}`;
      }
    }
    let metadata = buildFileMetadata(file);
    metadata.parent = parent;
    prependQueueElem(metadata, true);
    upload(
      file,
      metadata,
      (percentage) => {
        progressHandlerById(metadata.hash, percentage);
      },
      false
    );
  }
});
