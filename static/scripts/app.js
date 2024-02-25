const view = document.querySelector("main");
const navTop = document.querySelector("nav");
const navLeft = document.querySelector(".nav_left");
const navRight = document.querySelector(".nav_right");
const blurLayer = document.querySelector(".blur_layer");
const usageElem = document.querySelector("#storage");
const activityElem = document.querySelector("#activity");
const hiddenFileInput = document.querySelector("#file-input");
const hiddenFolderInput = document.querySelector("#folder-input");
const clearQueryButton = document.querySelector("#clear-query");
const searchQueryInput = document.querySelector("#search-input");
const newFolderButton = document.querySelector("#create-new-folder");
const folderUploadButton = document.querySelector("#drive-folder-upload");
const fileUploadButton = document.querySelector("#upload-file");
const menuElem = document.querySelector("#menu");
const searchIcon = document.querySelector("#search-icon");
const previewModal = document.querySelector(".file_preview");
const migrationModal = document.querySelector(".file_migration");
const usernameElem = document.querySelector("#username");

const COLOR_RED = "#CB1446";
const COLOR_GREEN = "#2AA850";
const COLOR_BLUE = "#2E83F3";
const COLOR_ORANGE = "#FF6700";
const COLOR_FILE_LOAD = "#8cb4fc";
const COLOR_DELETE_FOREVER = "#f23a3a";

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
  blurLayer.style.display = "none";
  if (window.innerWidth < 768) {
    navLeft.style.display = "none";
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
  view.innerHTML = "";
  if (data) {
    data = sortFileByTimestamp(data).slice(0, 10);
    let list = document.createElement("ul");
    view.appendChild(list);
    data.forEach((file) => {
      list.appendChild(newFileElem(file));
    });
  } else {
    view.innerHTML = `<p>You don't have any file or folder</p>`;
  }
});

const browseButton = document.querySelector("#browse");
browseButton.addEventListener("click", async () => {
  openedOptionGL = "browse";
  openedFolderGL = null;
  blurLayer.click();
  const resp = await fetch(`/api/query`, {
    method: "POST",
    body: JSON.stringify({ parent: null, "deleted?ne": true }),
  });
  const data = await resp.json();
  view.innerHTML = "";
  if (!data && !localStorage.getItem("isGreeted")) {
    renderGreetings();
    return;
  } else if (!data) {
    view.innerHTML = `<p>You don't have any file or folder</p>`;
    return;
  }
  let files = [];
  let folders = [];
  data.forEach((file) => {
    file.type === "folder" ? folders.push(file) : files.push(file);
  });
  view.appendChild(buildPrompt({ parent: null }));
  let list = document.createElement("ul");
  view.appendChild(list);
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
  blurLayer.click();
  const resp = await fetch("/api/query", {
    method: "POST",
    body: JSON.stringify({ pinned: true, "deleted?ne": true }),
  });
  let data = await resp.json();
  view.innerHTML = "";
  if (!data) {
    view.innerHTML = `<p>You don't have any pinned file or folder</p>`;
    return;
  }
  let files = [];
  let folders = [];
  data.forEach((file) => {
    file.type === "folder" ? folders.push(file) : files.push(file);
  });
  let list = document.createElement("ul");
  view.appendChild(list);
  folders.concat(files).forEach((file) => {
    list.appendChild(newFileElem(file));
  });
});

const sharedButton = document.querySelector("#shared");
sharedButton.addEventListener("click", async () => {
  openedFolderGL = null;
  openedOptionGL = "shared";
  blurLayer.click();
  view.innerHTML = "";
  let fileList = document.createElement("div");
  fileList.className = "file_list";
  const resp = await fetch(`/api/query`, {
    method: "POST",
    body: JSON.stringify({ parent: "~shared" }),
  });
  let data = await resp.json();
  if (!data) {
    view.innerHTML = `<p>You haven't received any file</p>`;
    return;
  }
  let list = document.createElement("ul");
  view.appendChild(list);
  data.forEach((file) => {
    list.appendChild(newFileElem(file));
  });
});

const trashButton = document.querySelector("#trash");
trashButton.addEventListener("click", async () => {
  openedFolderGL = null;
  openedOptionGL = "trash";
  blurLayer.click();
  const resp = await fetch("/api/query", {
    method: "POST",
    body: JSON.stringify({ deleted: true }),
  });
  const data = await resp.json();
  view.innerHTML = "";
  if (!data) {
    view.innerHTML = `<p>There is no trash file</p>`;
    return;
  }
  dataMap = {};
  data.forEach((file) => {
    dataMap[file.hash] = file;
  });
  trashFilesGL = dataMap;
  let list = document.createElement("ul");
  view.appendChild(list);
  data.forEach((file) => {
    list.appendChild(newFileElem(file, true));
  });
});

const migrateV2Button = document.querySelector("#migrateV2");
migrateV2Button?.addEventListener("click", async () => {
  openedFolderGL = null;
  openedOptionGL = "trash";
  blurLayer.click();
  const resp = await fetch("/api/query", {
    method: "POST",
    body: JSON.stringify({})
  });
  migrationModal.innerHTML = "";
  migrationModal.style.display = "flex";
  migrationModal.style.flexDirection = "column";
  migrationModal.style.justifyContent = "flex-start";
  migrationModal.style.outline = "none";
  const data = await resp.json();
  let h3 = document.createElement("h3");
  h3.innerHTML = `Migrating ${data.length} files`;
  migrationModal.appendChild(h3);
  let counter = 0;
  data.forEach(async (file) => {
    migrationModal.showModal();
    const r = await fetch(`/api/v2/migrate`, {
      method: "POST",
      body: JSON.stringify(file)
    });
    let p = document.createElement("p");
    if (r.status === 207) {
      p.innerHTML = `${++counter}. ${file.name} migrated successfully <span style="color: ${COLOR_GREEN}">✔</span>`; 
    } else {
      p.innerHTML = `${++counter}. ${file.name} failed to migrate <span style="color: ${COLOR_RED}">𐄂</span>`;
    }
    migrationModal.appendChild(p);
    migrationModal.scrollTop = migrationModal.scrollHeight;
  })
  let close = document.createElement("button");
  close.innerHTML = `<span class="material-symbols-rounded" style="font-size: 20px">close</span>`;
  close.addEventListener("click", () => {
    migrationModal.style.display = "none";
    migrationModal.close();
  })
  migrationModal.appendChild(close);
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

usernameElem.addEventListener("click", () => {
  navigator.clipboard.writeText(userIdGL).then(() => {
    showSnack("User Id copied to clipboard", COLOR_GREEN, "success");
  });
});

let logo = document.querySelector(".logo")
logo.addEventListener("click", async () => {
  window.open("https://github.com/jnsougata/filebox", "_blank");
})

menuElem.addEventListener("click", (e) => {
  navLeft.style.display = "flex";
  blurLayer.style.display = "block";
});

view.addEventListener("dragover", (e) => {
  e.preventDefault();
  e.stopPropagation();
});

view.addEventListener("drop", (e) => {
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

blurLayer.addEventListener("click", () => {
  closeSidebar();
  hideRightNav();
});

window.addEventListener("DOMContentLoaded", async () => {
  await fetch("/api/sanitize");
  browseButton.click();
  let resp = await fetch(`/api/key`);
  let data = await resp.json();
  secretKeyGL = data.key;
  resp = await fetch("/api/consumption");
  data = await resp.json();
  updateSpaceUsage(data.size);
  resp = await fetch("/api/microid");
  data = await resp.json();
  userIdGL = data.id;
  usernameElem.innerHTML = userIdGL;
});

window.addEventListener("load", () => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/worker.js");
  } else {
    console.log("Service worker not supported");
  }
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
    menuElem.style.display = "none";
    searchIcon.style.display = "flex";
    navLeft.style.display = "flex";
  } else {
    menuElem.style.display = "flex";
    searchIcon.style.display = "none";
    navLeft.style.display = "none";
    if (fileContextMenuGL) {
      fileContextMenuGL.close();
    }
  }
  blurLayer.click();
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
searchQueryInput.addEventListener("input", (ev) => {
  if (searchInputTimer) {
    clearTimeout(searchInputTimer);
  }
  searchInputTimer = setTimeout(() => {
    if (ev.target.value.length > 0) {
      searched = true;
      clearQueryButton.style.display = "flex";
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

newFolderButton.addEventListener("click", () => {
  createFolder();
});

clearQueryButton.addEventListener("click", () => {
  clearQueryButton.style.display = "none";
  currentOption().click();
  searchQueryInput.value = "";
});

fileUploadButton.addEventListener("click", () => {
  hiddenFileInput.click();
});

folderUploadButton.addEventListener("click", () => {
  hiddenFolderInput.click();
});

hiddenFileInput.addEventListener("change", (ev) => {
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

hiddenFolderInput.addEventListener("change", (ev) => {
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


/////////////////////// File Context Menu ///////////////////////

function onSendClick(file) {
  renderFileSenderModal(file);
}

function onRenameClick(file) {
  showRenameModal(file);
}

function onDownloadClick(file) {
  prependQueueElem(file, false);
  download(file, (progress) => {
    progressHandlerById(file.hash, progress);
  });
}

function onShareLinkClick(file) {
  if (file.access === "private") {
    showSnack(`Make file public to share via link`, COLOR_ORANGE, "warning");
  } else {
    window.navigator.clipboard
      .writeText(`${window.location.origin}/shared/${file.hash}`)
      .then(() => {
        showSnack(`Copied sharing URL to clipboard`, COLOR_GREEN, "success");
      });
  }
}

function onEmbedClick(file) {
  if (file.access === "private") {
    showSnack(`Make file public to embed`, COLOR_ORANGE, "warning");
  } else if (file.size > 1024 * 1024 * 4) {
    showSnack(`File is too large (> 4MB) to embed`, COLOR_RED, "error");
  } else {
    window.navigator.clipboard
      .writeText(`${window.location.origin}/embed/${file.hash}`)
      .then(() => {
        showSnack(`Copied embed URL to clipboard`, COLOR_GREEN, "success");
      });
  }
}

function onMoveClick(file) {
  isFileMovingGL = true;
  browseButton.click();
  renderAuxNav(fileMover(file));
}

function onTrashClick(file) {
  if (file.type === "folder") {
    deleteFolderPermanently(file).then(() => {
      showSnack(`Permanently Deleted ${file.name}`, COLOR_RED, "warning");
    });
  } else {
    file.deleted = true;
    fetch(`/api/metadata`, {
      method: "PUT",
      body: JSON.stringify(file),
    }).then(() => {
      showSnack(`Moved to trash ${file.name}`, COLOR_RED, "warning");
      document.getElementById(`file-${file.hash}`).remove();
    });
  }
}

function onColorClick(file) {
  let pickerElem = document.createElement("input");
  pickerElem.type = "color";
  pickerElem.style.display = "none";
  pickerElem.value = file.color || "#ccc";
  pickerElem.addEventListener("change", () => {
    file.color = pickerElem.value;
    file.project_id = globalProjectId;
    fetch(`/api/metadata`, {
      method: "PUT",
      body: JSON.stringify(file),
    }).then(() => {
      let folder = document.getElementById(`file-${file.hash}`);
      let folderIcon = folder.children[0];
      folderIcon.style.color = file.color;
      showSnack(`Folder color changed successfully`, COLOR_GREEN, "success");
    });
  });
  document.body.appendChild(pickerElem);
  pickerElem.click();
}

function onRestoreClick(file) {
  checkFileParentExists(file).then((exists) => {
    if (!exists && file.parent !== undefined) {
      showSnack(`Parent not found. Restoring to root`, COLOR_ORANGE, "warning");
      delete file.parent;
      delete file.deleted;
    } else {
      delete file.deleted;
    }
    fetch(`/api/metadata`, {
      method: "PUT",
      body: JSON.stringify(file),
    }).then(() => {
      document.getElementById(`file-${file.hash}`).remove();
      showSnack(`Restored ${file.name}`, COLOR_GREEN, "success");
      delete trashFilesGL[file.hash];
    });
  });
}

function onDeletePermanentlyClick(file) {
  fetch(`/api/metadata`, { method: "DELETE", body: JSON.stringify(file) }).then(
    () => {
      showSnack(`Permanently Deleted ${file.name}`, COLOR_RED, "warning");
      document.getElementById(`file-${file.hash}`).remove();
      if (!file.shared) {
        updateSpaceUsage(-file.size);
      }
      delete trashFilesGL[file.hash];
    }
  );
}

function onPinUnpinClick(file) {
  if (file.pinned) {
    fetch(`/api/metadata`, { 
      method: "PATCH",
      body: JSON.stringify({ hash: file.hash, pinned: false }), 
    }).then(() => {
      showSnack(`File unpinned successfully`, COLOR_ORANGE, "info");
      let card = document.getElementById(`file-${file.hash}`);
      if (card) {
        card.remove();
      }
      delete file.pinned;
    });
  } else {
    fetch(`/api/metadata`, { 
      method: "PATCH",
      body: JSON.stringify({ hash: file.hash, pinned: true }), 
    }).then(() => {
      showSnack(`File pinned successfully`, COLOR_GREEN, "success");
      let pinnedSection = document.querySelector(".pinned_files");
      if (pinnedSection) {
        pinnedSection.appendChild(newFileElem(file));
      }
      file.pinned = true;
    });
  }
}

const contextOptions = [
  {
    label: "Send",
    icon: "send",
    callback: onSendClick,
    fileOnly: true,
  },
  {
    label: "Rename",
    icon: "edit",
    callback: onRenameClick,
    fileOnly: true,
  },
  {
    label: "Download",
    icon: "download",
    callback: onDownloadClick,
    fileOnly: true,
  },
  {
    label: "Share Link",
    icon: "link",
    callback: onShareLinkClick,
    ownerOnly: true,
  },
  {
    label: "Embed Link",
    icon: "code",
    callback: onEmbedClick,
    fileOnly: true,
    ownerOnly: true,
  },
  {
    label: "Move",
    icon: "arrow_forward",
    callback: onMoveClick,
    fileOnly: true,
  },
  {
    label: "Color",
    icon: "color_lens",
    callback: onColorClick,
    folderOnly: true,
  },
  {
    label: "Download as Zip",
    icon: "archive",
    callback: downloadFolderAsZip,
    folderOnly: true,
  },
  {
    label: "Trash",
    icon: "delete",
    callback: onTrashClick,
    fileOnly: true,
  },
  {
    label: "Delete Permanently",
    icon: "delete",
    callback: onTrashClick,
    folderOnly: true,
  },
  {
    label: "Restore",
    icon: "replay",
    callback: onRestoreClick,
    trashOnly: true,
  },
  {
    label: "Delete Permanently",
    icon: "delete_forever",
    callback: onDeletePermanentlyClick,
    trashOnly: true,
  },
];

class FileContextMenu {
  constructor(event, file) {
    this.file = file;
    this.event = event;
    this.options = contextOptions;
    this.elem = document.querySelector(".context_menu");
  }

  buildItem(label, icon) {
    let li = document.createElement("li");
    let p = document.createElement("p");
    p.innerHTML = label;
    let span = document.createElement("span");
    span.classList.add("material-symbols-rounded");
    span.innerHTML = icon;
    li.appendChild(p);
    li.appendChild(span);
    return li;
  }

  build() {
    let ul = document.createElement("ul");
    let li = this.file.pinned
      ? this.buildItem("Unpin", "remove")
      : this.buildItem("Pin", "add");
    li.addEventListener("click", () => {
      this.close();
      onPinUnpinClick(this.file);
    });
    if (!this.file.deleted) {
      ul.appendChild(li);
    }
    for (let option of this.options) {
      if (this.file.deleted && !option.trashOnly) {
        continue;
      }
      if (!this.file.deleted && option.trashOnly) {
        continue;
      }
      if (this.file.shared && option.ownerOnly) {
        continue;
      }
      if (this.file.type === "folder" && option.fileOnly) {
        continue;
      }
      if (this.file.type !== "folder" && option.folderOnly) {
        continue;
      }
      let li = this.buildItem(option.label, option.icon);
      li.addEventListener("click", () => {
        this.close();
        option.callback(this.file);
      });
      ul.appendChild(li);
    }
    return ul;
  }

  show() {
    this.elem.showModal();
    this.elem.style.display = "flex";
    this.elem.style.left = `${this.event.pageX}px`;
    this.elem.style.top = `${this.event.pageY}px`;
    let menuRect = this.elem.getBoundingClientRect();
    let windowWidth = window.innerWidth;
    let windowHeight = window.innerHeight;
    if (menuRect.right > windowWidth) {
      this.elem.style.left = `${windowWidth - menuRect.width}px`;
    }
    if (menuRect.bottom > windowHeight) {
      this.elem.style.top = `${windowHeight - menuRect.height}px`;
    }
    this.elem.innerHTML = "";
    this.elem.appendChild(this.build());
    let parent = this.event.target.parentElement;
    while (parent.tagName !== "LI") {
      parent = parent.parentElement;
    }
    parent.style.backgroundColor = `var(--color-blackish-hover)`;
    this.elem.id = this.file.hash;
    fileContextMenuGL = this;
  }

  close() {
    this.elem.close();
    this.elem.style.display = "none";
    const fileElem = document.getElementById(`file-${this.elem.id}`);
    if (fileElem) {
      fileElem.style.backgroundColor = `transparent`;
    }
    fileContextMenuGL = null;
  }
}

/////////////////////// Queue Util ///////////////////////

function prependQueueElem(file, isUpload = true) {
  let li = document.createElement("li");
  let icon = document.createElement("div");
  icon.className = "icon";
  setIconByMime(file.mime, icon);
  if (isUpload === null) {
    icon.innerHTML =
      '<span class="material-symbols-rounded">open_in_browser</span>';
  }
  let info = document.createElement("div");
  info.className = "info";
  let name = document.createElement("p");
  name.innerHTML = file.name;
  let progress = document.createElement("div");
  progress.className = "progress";
  let bar = document.createElement("div");
  bar.className = "bar";
  bar.style.width = "0%";
  if (isUpload === null) {
    bar.style.backgroundColor = COLOR_FILE_LOAD;
  } else if (isUpload) {
    bar.style.backgroundColor = COLOR_BLUE;
  } else {
    bar.style.backgroundColor = COLOR_GREEN;
  }
  bar.id = `bar-${file.hash}`;
  progress.appendChild(bar);
  info.appendChild(name);
  info.appendChild(progress);
  let percentage = document.createElement("p");
  percentage.innerHTML = "0%";
  percentage.id = `percentage-${file.hash}`;
  li.appendChild(icon);
  li.appendChild(info);
  li.appendChild(percentage);
  taskFactoryGL[file.hash] = {
    element: li,
    index: taskCountGL + 1,
    bar: bar,
    percentage: percentage,
  };
  taskCountGL++;
  renderQueue();
}

function renderQueue() {
  let queue = document.createElement("div");
  queue.className = "queue";
  let close = document.createElement("div");
  close.className = "queue_close";
  close.innerHTML =
    '<span class="material-symbols-rounded">chevron_right</span>';
  close.addEventListener("click", () => {
    hideRightNav();
  });
  let content = document.createElement("div");
  content.className = "queue_content";
  let p = document.createElement("p");
  p.innerHTML = "Activities";
  let tasks = document.createElement("ul");
  let sortedNodes = Object.values(taskFactoryGL).sort((a, b) => b.index - a.index);
  for (let node of sortedNodes) {
    tasks.appendChild(node.element);
  }
  content.appendChild(p);
  content.appendChild(tasks);
  queue.appendChild(close);
  queue.appendChild(content);
  renderInRightNav(queue);
}

/////////////////////// File Transport Utils ///////////////////////

async function partUploader(hash, index, content, totalSize, handler) {
  console.log(`Uploading part ${index} of ${hash}`);
  const resp = await fetch(`/api/upload/${hash}/${index}`, {
    method: "PUT",
    body: content,
  })
  handler()
  if (resp.status === 200) {
    updateSpaceUsage(content.byteLength)
    handler((content.byteLength / totalSize) * 100)
  }
}

async function chunkedUpload(file, metadata, progressHandler) {
  let hash = metadata.hash;
  const reader = new FileReader();
  reader.onload = async (ev) => {
    const content = ev.target.result;
    let chunks = [];
    let chunkSize = 2 * 1024 * 1024;
    for (let i = 0; i < content.byteLength; i += chunkSize) {
      chunks.push({
        index: i / chunkSize,
        content: content.slice(i, i + chunkSize)
      });
    }
    let allOk = true;
    let batchSize = 5;
    let batches = [];
    for (let i = 0; i < chunks.length; i += batchSize) {
      batches.push(chunks.slice(i, i + batchSize));
    }
    for (let i = 0; i < batches.length; i++) {
      let promises = [];
      let batch = batches[i];
      batch.forEach((chunk, _) => {
        promises.push(
          partUploader(hash, chunk.index, chunk.content, file.size, progressHandler)
        );
      });
      await Promise.all(promises);
    }
    if (allOk) {
      await fetch(`/api/metadata`, {
        method: "POST",
        body: JSON.stringify(metadata),
      });
      progressHandler(100);
      showSnack(`Uploaded ${file.name}`, COLOR_BLUE, "success");
      openedFolderGL
        ? handleFolderClick(openedFolderGL)
        : currentOption().click();
      hideRightNav();
    }
  };
  reader.readAsArrayBuffer(file);
}

function upload(file, metadata, progressHandler, refreshList = true) {
  let hash = metadata.hash;
  let header = { "X-Api-Key": secretKeyGL, "Content-Type": file.type };
  let projectId = secretKeyGL.split("_")[0];
  const ROOT = "https://drive.deta.sh/v1";
  let reader = new FileReader();
  reader.onload = async (ev) => {
    progressHandler(0);
    showSnack(`Uploading ${file.name}`, COLOR_BLUE, "info");
    let content = ev.target.result;
    let nameFragments = file.name.split(".");
    let saveAs =
      nameFragments.length > 1 ? `${hash}.${nameFragments.pop()}` : `${hash}`;
    const chunkSize = 10 * 1024 * 1024;
    if (file.size < chunkSize) {
      await fetch(`${ROOT}/${projectId}/filebox/files?name=${saveAs}`, {
        method: "POST",
        body: content,
        headers: header,
      });
      const resp = await fetch(`/api/metadata`, {
        method: "POST",
        body: JSON.stringify(metadata),
      });
      progressHandler(100);
      showSnack(`Uploaded ${file.name}`, COLOR_BLUE, "success");
      updateSpaceUsage(file.size);
      if (!refreshList) {
        return;
      }
      openedFolderGL
        ? handleFolderClick(openedFolderGL)
        : currentOption().click();
      hideRightNav();
    } else {
      const resp = await fetch(
        `${ROOT}/${projectId}/filebox/uploads?name=${saveAs}`,
        {
          method: "POST",
          headers: header,
        }
      );
      const data = await resp.json();
      let chunks = [];
      for (let i = 0; i < content.byteLength; i += chunkSize) {
        chunks.push({
          index: i / chunkSize,
          content: content.slice(i, i + chunkSize)
        });
      }
      let allOk = true;
      let batches = [];
      let name = data.name;
      let uploadId = data["upload_id"];
      const batchSize = 5;
      for (let i = 0; i < chunks.length; i += batchSize) {
        batches.push(chunks.slice(i, i + batchSize));
      }
      let progress = 0;
      async function uploadPart(chunk) {
        let resp = await fetch(
          `${ROOT}/${projectId}/filebox/uploads/${uploadId}/parts?name=${name}&part=${
            chunk.index + 1
          }`,
          {
            method: "POST",
            body: chunk.content,
            headers: header,
          }
        )
        if (resp.status !== 200) {
          allOk = false;
          return
        }
        progress += chunk.content.byteLength
        progressHandler(Math.round((progress / file.size) * 100));
      }
      for (let i = 0; i < batches.length; i++) {
        let promises = [];
        let batch = batches[i];
        batch.forEach((chunk, _) => {
          promises.push(uploadPart(chunk));
        });
        await Promise.all(promises);
      }
      if (allOk) {
        await fetch(
          `${ROOT}/${projectId}/filebox/uploads/${uploadId}?name=${name}`,
          {
            method: "PATCH",
            headers: header,
          }
        );
        progressHandler(100);
        await fetch(`/api/metadata`, {
          method: "POST",
          body: JSON.stringify(metadata),
        });
        progressHandler(100);
        showSnack(`Uploaded ${file.name}`, COLOR_BLUE, "success");
        updateSpaceUsage(file.size);
        if (!refreshList) {
          return;
        }
        openedFolderGL
          ? handleFolderClick(openedFolderGL)
          : currentOption().click();
        hideRightNav();
      } else {
        taskFactoryGL[hash].bar.style.backgroundColor = COLOR_RED;
        showSnack(`Failed to upload ${file.name}`, COLOR_RED, "error");
        await fetch(
          `${ROOT}/${projectId}/filebox/uploads/${uploadId}?name=${name}`,
          {
            method: "DELETE",
            headers: header,
          }
        );
      }
    }
  };
  reader.readAsArrayBuffer(file);
}

async function fetchFileFromDrive(file, progressHandler) {
  progressHandler(0);
  let header = { "X-Api-Key": secretKeyGL };
  let projectId = secretKeyGL.split("_")[0];
  const ROOT = "https://drive.deta.sh/v1";
  let extension = file.name.split(".").pop();
  let qualifiedName = file.hash + "." + extension;
  return fetch(
    `${ROOT}/${projectId}/filebox/files/download?name=${qualifiedName}`,
    {
      method: "GET",
      headers: header,
    }
  )
    .then((response) => {
      const reader = response.body.getReader();
      return new ReadableStream({
        start(controller) {
          return pump();
          function pump() {
            return reader.read().then(({ done, value }) => {
              if (done) {
                controller.close();
                return;
              }
              controller.enqueue(value);
              progressHandler(value.length);
              return pump();
            });
          }
        },
      });
    })
    .then((stream) => new Response(stream))
    .then((response) => response.blob());
}

async function download(file, progressHandler) {
  showSnack(`Downloading ${file.name}`, COLOR_GREEN, "info");
  progressHandler(0);
  queueButton.click();
  let header = { "X-Api-Key": secretKeyGL };
  let projectId = secretKeyGL.split("_")[0];
  const ROOT = "https://drive.deta.sh/v1";
  let extension = file.name.split(".").pop();
  let qualifiedName = file.hash + "." + extension;
  let resp = await fetch(
    `${ROOT}/${projectId}/filebox/files/download?name=${qualifiedName}`,
    {
      method: "GET",
      headers: header,
    }
  );
  let progress = 0;
  const reader = resp.body.getReader();
  let stream = new ReadableStream({
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
          progressHandler(Math.round((progress / file.size) * 100));
          return pump();
        });
      }
    },
  });
  let blob = await new Response(stream).blob();
  let a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = file.name;
  showSnack(`Downloaded ${file.name}`, COLOR_GREEN, "success");
  hideRightNav();
  a.click();
}

function downloadShared(file, progressHandler) {
  showSnack(`Downloading ${file.name}`, COLOR_GREEN, "info");
  progressHandler(0);
  queueButton.click();
  let size = file.size;
  const chunkSize = 1024 * 1024 * 4;
  if (size < chunkSize) {
    fetch(`/api/external/${userIdGL}/${file.owner}/${file.hash}/0`)
      .then((resp) => resp.blob())
      .then((blob) => {
        let a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        progressHandler(100);
        showSnack(`Downloaded ${file.name}`, COLOR_GREEN, "success");
        hideRightNav();
        a.click();
      });
  } else {
    let skips = 0;
    if (size % chunkSize === 0) {
      skips = size / chunkSize;
    } else {
      skips = Math.floor(size / chunkSize) + 1;
    }
    let heads = Array.from(Array(skips).keys());
    let promises = [];
    let progress = 0;
    heads.forEach((head) => {
      promises.push(
        fetch(`/api/external/${userIdGL}/${file.owner}/${file.hash}/${head}`)
          .then((resp) => {
            return resp.blob();
          })
          .then((blob) => {
            progress += blob.size;
            progressHandler(Math.round((progress / file.size) * 100));
            return blob;
          })
      );
    });
    Promise.all(promises).then((blobs) => {
      progressHandler(100);
      let a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob(blobs, { type: file.mime }));
      a.download = file.name;
      showSnack(`Downloaded ${file.name}`, COLOR_GREEN, "success");
      hideRightNav();
      a.click();
    });
  }
}

/////////////////////// Basic Utils ///////////////////////

function renderInRightNav(elem) {
  navRight.innerHTML = "";
  navRight.appendChild(elem);
  navRight.style.display = "flex";
  blurLayer.style.display = "block";
}

function hideRightNav() {
  navRight.style.display = "none";
  blurLayer.style.display = "none";
}

function dateStringToTimestamp(dateString) {
  let date = new Date(dateString);
  return date.getTime();
}

function sortFileByTimestamp(data) {
  data = data.sort((a, b) => {
    return dateStringToTimestamp(b.date) - dateStringToTimestamp(a.date);
  });
  return data;
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
          ${date.toLocaleString("default", { month: "short" })} 
          ${date.getDate()}, 
          ${date.getFullYear()} 
          ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}
      `;
}

function updateSpaceUsage(incr) {
  usageGL += incr;
  usageElem.innerText = `${handleSizeUnit(usageGL)}`;
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

function randId() {
  return crypto.randomUUID().replace(/-/g, "");
}

function buildFileMetadata(file) {
  let hash = randId();
  let meta = {
    hash: hash,
    name: file.name,
    size: file.size,
    mime: file.type,
    access: "private",
    date: new Date().toISOString(),
  };
  if (openedFolderGL) {
    meta.parent = openedFolderGL.parent
      ? `${openedFolderGL.parent}/${openedFolderGL.name}`
      : openedFolderGL.name;
  } else {
    meta.parent = null;
  }
  return meta;
}

function progressHandlerById(hash, percentage) {
  taskFactoryGL[hash].percentage.innerHTML = `${percentage}%`;
  taskFactoryGL[hash].bar.style.width = `${percentage}%`;
}

async function checkFileParentExists(file) {
  if (!file.parent) {
    return false;
  }
  let body = { type: "folder" };
  let fragments = file.parent.split("/");
  if (fragments.length === 1) {
    body["name"] = file.parent;
  } else {
    body["name"] = fragments[fragments.length - 1];
    body["parent"] = fragments.slice(0, fragments.length - 1).join("/");
  }
  let resp = await fetch(`/api/query`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  let data = await resp.json();
  if (!data) {
    return false;
  }
  return true;
}

async function createFolder() {
  let name = prompt("Enter folder name", "New Folder");
  if (name === "") {
    showSnack(`Folder name cannot be empty`, COLOR_ORANGE, "warning");
    return;
  }
  if (name === "~shared") {
    showSnack(`~shared is a reserved folder name`, COLOR_ORANGE, "warning");
    return;
  }
  if (name && name.includes("/")) {
    showSnack(`Folder name cannot contain /`, COLOR_ORANGE, "warning");
    return;
  }
  if (!name) {
    return;
  }
  let body = {
    name: name,
    type: "folder",
    hash: randId(),
    date: new Date().toISOString(),
    parent: null,
  };
  if (openedFolderGL) {
    body.parent = openedFolderGL.parent
      ? `${openedFolderGL.parent}/${openedFolderGL.name}`
      : openedFolderGL.name;
  }
  let resp = await fetch(`/api/metadata`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (resp.status === 409) {
    showSnack(`Folder with same name already exists`, COLOR_RED, "error");
    return;
  } else if (resp.status <= 207) {
    showSnack(`Created folder ${name}`, COLOR_GREEN, "success");
    handleFolderClick(body);
  }
}

async function buildChildrenTree(folder) {
  let node = [];
  let resp = await fetch(`/api/query`, {
    method: "POST",
    body: JSON.stringify({
      "deleted?ne": true,
      "shared?ne": true,
      parent: folder.parent ? `${folder.parent}/${folder.name}` : folder.name,
    }),
  });
  let children = await resp.json();
  if (!children) {
    return { tree: node, hash: folder.hash };
  }
  let promises = [];
  children.forEach((child) => {
    if (child.type === "folder") {
      promises.push(buildChildrenTree(child));
      node.push(child);
    } else {
      node.push(child);
    }
  });
  let childrenTree = await Promise.all(promises);
  childrenTree.forEach((childTree) => {
    node.forEach((child) => {
      if (child.hash === childTree.hash) {
        child.children = childTree.tree;
      }
    });
  });
  return { tree: node, hash: folder.hash };
}

function caculateTreeSize(tree) {
  let size = 0;
  tree.forEach((child) => {
    if (child.type === "folder") {
      size += caculateTreeSize(child.children);
    } else {
      size += child.size;
    }
  });
  return size;
}

async function zipFolderRecursive(tree, hash, zip, done, totalSize) {
  let promises = [];
  let recursions = [];
  tree.forEach((child) => {
    if (child.type === "folder") {
      let folder = zip.folder(child.name);
      if (child.children.length > 0) {
        recursions.push(
          zipFolderRecursive(child.children, hash, folder, done, totalSize)
        );
      }
    } else {
      promises.push(
        fetchFileFromDrive(child, (progress) => {
          done += progress;
          let percentage = Math.round((done / totalSize) * 100);
          progressHandlerById(hash, percentage);
        })
      );
    }
  });
  await Promise.all(recursions);
  let blobs = await Promise.all(promises);
  blobs.forEach((blob, index) => {
    zip.file(tree[index].name, blob);
  });
  progressHandlerById(hash, 100);
  return zip;
}

/////////////////////// Dynamic Renderer ///////////////////////

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

async function updateFolderStats(folders) {
  if (folders.length === 0) {
    return;
  }
  let resp = await fetch(`/api/count/items`, {
    method: "POST",
    body: JSON.stringify(folders),
  });
  let stat = await resp.json();
  stat.forEach((stat) => {
    let statElem = document.getElementById(`stat-${stat.hash}`);
    if (statElem) {
      statElem.innerHTML = `${stat.count} items • ${statElem.innerHTML}`;
    }
  });
}

async function downloadFolderAsZip(folder) {
  const { tree, _ } = await buildChildrenTree(folder);
  let totalSize = caculateTreeSize(tree);
  let folderData = {
    name: folder.name,
    size: totalSize,
    type: "folder",
    hash: folder.hash,
  };
  prependQueueElem(folderData, false);
  showSnack(`Zipping ${folder.name}...`, COLOR_BLUE, `info`);
  const zip = await zipFolderRecursive(
    tree,
    folder.hash,
    new JSZip(),
    0,
    totalSize
  );
  let content = await zip.generateAsync({ type: "blob" });
  let a = document.createElement("a");
  a.href = window.URL.createObjectURL(content);
  a.download = `${folder.name}.zip`;
  a.click();
}

async function deleteFolderPermanently(folder) {
  let ok = confirm(
    `Are you sure you want to delete folder "${folder.name}" permanently?`
  );
  if (!ok) return;
  const { tree, _ } = await buildChildrenTree(folder);
  let treeSize = caculateTreeSize(tree);
  async function deleteFilesRecursively(tree) {
    await fetch(`/api/metadata`, {
      method: "DELETE",
      body: JSON.stringify(folder),
    });
    let folderElem = document.getElementById(`file-${folder.hash}`);
    if (folderElem) {
      folderElem.remove();
    }
    tree.forEach(async (file) => {
      if (file.type === "folder") {
        await deleteFilesRecursively(file.children);
      }
      await fetch(`/api/metadata`, {
        method: "DELETE",
        body: JSON.stringify(file),
      });
    });
  }
  await deleteFilesRecursively(tree);
  updateSpaceUsage(-treeSize);
}

function handleTrashFileMenuClick(file) {
  let fileOptionPanel = document.createElement("div");
  fileOptionPanel.className = "file_menu";
  let title = document.createElement("div");
  title.className = "title";
  let fileNameElem = document.createElement("p");
  fileNameElem.innerHTML = file.name;
  title.appendChild(fileNameElem);
  let close = document.createElement("span");
  close.className = `material-symbols-rounded`;
  close.innerHTML = `chevron_right`;
  close.addEventListener("click", () => {
    hideRightNav();
  });
  title.appendChild(close);
  fileOptionPanel.appendChild(title);
  let restore = document.createElement("div");
  restore.className = "file_menu_option";
  restore.innerHTML = `<p>Restore</p><span class="material-symbols-rounded">replay</span>`;
  restore.addEventListener("click", async () => {
    delete file.deleted;
    let ok = await checkFileParentExists(file);
    if (!ok && file.parent !== undefined) {
      showSnack(
        `Parent not found. Restoring to root`,
        COLOR_ORANGE,
        "warning"
      );
      file.parent = null;
    }
    await fetch(`/api/metadata`, {
      method: "PUT",
      body: JSON.stringify(file),
    });
    showSnack(`Restored ${file.name}`, COLOR_GREEN, "success");
    document.getElementById(`file-${file.hash}`).remove();
    delete trashFilesGL[file.hash];
    close.click();
  });
  let deleteButton = document.createElement("div");
  deleteButton.className = "file_menu_option";
  deleteButton.innerHTML = `<p>Delete Permanently</p><span class="material-symbols-rounded">delete_forever</span>`;
  deleteButton.addEventListener("click", () => {
    fetch(`/api/metadata`, {
      method: "DELETE",
      body: JSON.stringify(file),
    }).then(() => {
      showSnack(`Permanently deleted ${file.name}`, COLOR_RED, "info");
      document.getElementById(`file-${file.hash}`).remove();
      if (!file.shared) {
        updateSpaceUsage(-file.size);
      }
      close.click();
      if (trashFilesGL.length === 0) {
        navTop.removeChild(navTop.firstChild);
      }
    });
  });
  fileOptionPanel.appendChild(restore);
  fileOptionPanel.appendChild(deleteButton);
  renderInRightNav(fileOptionPanel);
}

function handleFileMenuClick(file) {
  let fileOptionPanel = document.createElement("div");
  fileOptionPanel.className = "file_menu";

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
    hideRightNav();
  });
  title.appendChild(close);
  fileOptionPanel.appendChild(title);

  // Access
  let visibilityOption = document.createElement("div");
  visibilityOption.className = "file_menu_option";
  let visibility = file.access === "private" ? "visibility_off" : "visibility";
  visibilityOption.innerHTML = `<p>Access</p><span class="material-symbols-rounded">${visibility}</span>`;
  visibilityOption.addEventListener("click", () => {
    if (file.access === "private") {
      file.access = "public";
      visibilityOption.innerHTML = `<p>Access</p><span class="material-symbols-rounded">visibility</span>`;
      share.style.opacity = 1;
      file.size > 1024 * 1024 * 4 ? (embed.style.opacity = 0.3) : (embed.style.opacity = 1);
      showSnack("Access changed to public", COLOR_GREEN, "info");
    } else {
      file.access = "private";
      visibilityOption.innerHTML = `<p>Access</p><span class="material-symbols-rounded">visibility_off</span>`;
      share.style.opacity = 0.3;
      embed.style.opacity = 0.3;
      showSnack("Access changed to private", COLOR_ORANGE, "info");
    }
    fetch(`/api/metadata`, {
      method: "PATCH",
      body: JSON.stringify({ hash: file.hash, access: file.access }),
    });
  });
  if (file.type !== "folder") {
    fileOptionPanel.appendChild(visibilityOption);
  }

  // Bookmark
  let bookmarkMode = file.pinned ? "remove" : "add";
  let bookmarkOption = document.createElement("div");
  bookmarkOption.className = "file_menu_option";
  bookmarkOption.innerHTML = `<p>Pin</p><span class="material-symbols-rounded">${bookmarkMode}</span>`;
  bookmarkOption.addEventListener("click", () => {
    if (file.pinned) {
      fetch(`/api/metadata`, { 
        method: "PATCH",
        body: JSON.stringify({ hash: file.hash, pinned: false }), 
      }).then(() => {
        showSnack(`Unpinned successfully`, COLOR_ORANGE, "info");
        let card = document.getElementById(`card-${file.hash}`);
        if (card) {
          card.remove();
        }
        delete file.pinned;
        bookmarkOption.innerHTML = `<p>Pin</p><span class="material-symbols-rounded">add</span>`;
      });
    } else {
      fetch(`/api/metadata`, { 
        method: "PATCH",
        body: JSON.stringify({ hash: file.hash, pinned: true }), 
      }).then(() => {
        showSnack(`Pinned successfully`, COLOR_GREEN, "success");
        let pins = document.querySelector(".pinned_files");
        if (pins) {
          pins.appendChild(newFileElem(file));
        }
        file.pinned = true;
        bookmarkOption.innerHTML = `<p>Pin</p><span class="material-symbols-rounded">remove</span>`;
      });
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
        showSnack("Can't send a file that you don't own", COLOR_ORANGE, "info");
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
    showRenameModal(file);
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
      showSnack(`Make file public to share via link`, COLOR_ORANGE, "warning");
    } else {
      window.navigator.clipboard
        .writeText(`${window.location.origin}/shared/${file.hash}`)
        .then(() => {
          showSnack(`Copied to clipboard`, COLOR_GREEN, "success");
        });
    }
  });

  // Embed
  let embed = document.createElement("div");
  embed.className = "file_menu_option";
  embed.innerHTML = `<p>Embed</p><span class="material-symbols-rounded">code</span>`;
  embed.addEventListener("click", () => {
    if (file.access === "private") {
      showSnack(`Make file public to embed`, COLOR_ORANGE, "warning");
    } else if (file.size > 1024 * 1024 * 4) {
      showSnack(`File is too large to embed`, COLOR_RED, "error");
    } else {
      window.navigator.clipboard
        .writeText(`${window.location.origin}/embed/${file.hash}`)
        .then(() => {
          showSnack(`Copied to clipboard`, COLOR_GREEN, "success");
        });
    }
  });

  // Move
  let move = document.createElement("div");
  move.className = "file_menu_option";
  move.innerHTML = `<p>Move</p><span class="material-symbols-rounded">arrow_forward</span>`;
  move.addEventListener("click", () => {
    close.click();
    renderAuxNav(fileMover(file));
    isFileMovingGL = true;
    browseButton.click();
  });
  if (file.type !== "folder") {
    fileOptionPanel.appendChild(rename);
    fileOptionPanel.appendChild(downloadButton);
    if (file.access === "private") {
      share.style.opacity = 0.3;
    }
    if (file.access === "private" || file.size > 1024 * 1024 * 4) {
      embed.style.opacity = 0.3;
    }
    fileOptionPanel.appendChild(embed);
    fileOptionPanel.appendChild(move);
  }
  fileOptionPanel.appendChild(share);

  // Download as zip
  let downloadZip = document.createElement("div");
  downloadZip.className = "file_menu_option";
  downloadZip.innerHTML = `<p>Download as Zip</p><span class="material-symbols-rounded">archive</span>`;
  downloadZip.addEventListener("click", () => {
    downloadFolderAsZip(file);
  });
  if (file.type === "folder") {
    fileOptionPanel.appendChild(downloadZip);
  }

  // Trash
  let trashButton = document.createElement("div");
  trashButton.className = "file_menu_option";
  if (file.type === "folder") {
    trashButton.innerHTML = `<p>Delete Permanently</p><span class="material-symbols-rounded">delete_forever</span>`;
  } else {
    trashButton.innerHTML = `<p>Trash</p><span class="material-symbols-rounded">delete_forever</span>`;
  }
  trashButton.addEventListener("click", async () => {
    if (file.type === "folder") {
      deleteFolderPermanently(file).then(() => {
        showSnack(
          `Deleted folder "${file.name}" permanently`,
          COLOR_RED,
          "warning"
        );
        close.click();
      });
    } else {
      file.deleted = true;
      fetch(`/api/metadata`, {
        method: "PUT",
        body: JSON.stringify(file),
      }).then(() => {
        showSnack(`Moved to trash ${file.name}`, COLOR_RED, "warning");
        document.getElementById(`file-${file.hash}`).remove();
        close.click();
      });
    }
  });
  fileOptionPanel.appendChild(trashButton);

  // Access Control
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
        fetch(`/api/metadata`, {
          method: "PUT",
          body: JSON.stringify(file),
        }).then(() => {
          showSnack(`Blocked access for ${recipient}`, COLOR_ORANGE, "warning");
          recipientElem.remove();
        });
      });
      fileOptionPanel.appendChild(recipientElem);
    });
  }

  renderInRightNav(fileOptionPanel);
}

async function handleFolderClick(folder) {
  openedFolderGL = folder;
  let parentOf = folder.parent
    ? `${folder.parent}/${folder.name}`
    : folder.name;
  const resp = await fetch(`/api/query`, {
    method: "POST",
    body: JSON.stringify({ "parent": parentOf, "deleted?ne": true}),
  })
  const data = await resp.json()
  view.innerHTML = "";
  view.appendChild(buildPrompt(folder));
  let fragment = parentOf ? `~/${parentOf}` : "home";
  document.querySelector(".fragment").innerText = fragment;
  if (!data) return;
  let folders = [];
  let files = [];
  data.forEach((file) => {
    file.type === "folder" ? folders.push(file) : files.push(file);
  });
  let list = document.createElement("ul");
  view.appendChild(list);
  folders.concat(files).forEach((file) => {
    list.appendChild(newFileElem(file));
  });
  updateFolderStats(folders);
}

function handleMultiSelectMenuClick() {
  let fileOptionPanel = document.createElement("div");
  fileOptionPanel.className = "file_menu";

  // Title
  let title = document.createElement("div");
  title.className = "title";
  let fileNameElem = document.createElement("p");
  fileNameElem.innerHTML = "Options";
  title.appendChild(fileNameElem);
  let close = document.createElement("span");
  close.className = `material-symbols-rounded`;
  close.innerHTML = `chevron_right`;
  close.addEventListener("click", () => {
    hideRightNav();
  });
  title.appendChild(close);
  fileOptionPanel.appendChild(title);

  // Zip Option
  let zipOption = document.createElement("div");
  zipOption.className = "file_menu_option";
  zipOption.innerHTML = `<p>Download as Zip</p><span class="material-symbols-rounded">archive</span>`;
  zipOption.addEventListener("click", () => {
    let zip = new JSZip();
    let totalSize = 0;
    multiSelectBucketGL.forEach((file) => {
      totalSize += parseInt(file.size);
    });
    let randomZipId = randId();
    let zipData = {
      name: `filebox-download-${randomZipId}.zip`,
      mime: "application/zip",
      size: totalSize,
      hash: randomZipId,
    };
    prependQueueElem(zipData);
    queueButton.click();
    let promises = [];
    let completed = 0;
    multiSelectBucketGL.forEach((file) => {
      promises.push(
        fetchFileFromDrive(file, (cmp) => {
          completed += cmp;
          let percentage = Math.round((completed / totalSize) * 100);
          progressHandlerById(zipData.hash, percentage);
        }).then((blob) => {
          zip.file(file.name, new Blob([blob], { type: file.mime }));
        })
      );
    });
    Promise.all(promises).then(() => {
      zip.generateAsync({ type: "blob" }).then((content) => {
        let a = document.createElement("a");
        a.href = window.URL.createObjectURL(content);
        a.download = zipData.name;
        a.click();
      });
    });
  })

  // Move Option
  let moveOption = document.createElement("div");
  moveOption.className = "file_menu_option";
  moveOption.innerHTML = `<p>Move</p><span class="material-symbols-rounded">arrow_forward</span>`;
  moveOption.addEventListener("click", () => {
    isFileMovingGL = true;
    browseButton.click();
    let fileMover = document.createElement("div");
    fileMover.className = "file_mover";
    let cancelButton = document.createElement("button");
    cancelButton.innerHTML = "Cancel";
    cancelButton.addEventListener("click", () => {
      isFileMovingGL = false;
      multiSelectBucketGL = [];
      navTop.removeChild(navTop.firstChild);
    });
    let selectButton = document.createElement("button");
    selectButton.innerHTML = "Select";
    selectButton.style.backgroundColor = "var(--accent-blue)";
    selectButton.addEventListener("click", () => {
      multiSelectBucketGL.forEach((file) => {
        delete file.deleted;
      });
      if (!openedFolderGL) {
        multiSelectBucketGL.forEach((file) => {
          delete file.parent;
        });
      } else {
        multiSelectBucketGL.forEach((file) => {
          if (openedFolderGL.parent) {
            file.parent = `${openedFolderGL.parent}/${openedFolderGL.name}`;
          } else {
            file.parent = openedFolderGL.name;
          }
        });
      }
      fetch(`/api/bulk`, {
        method: "PATCH",
        body: JSON.stringify(multiSelectBucketGL),
      }).then(() => {
        showSnack("Files Moved Successfully", COLOR_GREEN, "success");
        if (openedFolderGL) {
          handleFolderClick(openedFolderGL);
        } else {
          browseButton.click();
        }
        navTop.removeChild(navTop.firstChild);
      });
    });
    let p = document.createElement("p");
    p.innerHTML = "Select Move Destination";
    fileMover.appendChild(cancelButton);
    fileMover.appendChild(p);
    fileMover.appendChild(selectButton);
    navTop.removeChild(navTop.firstChild);
    renderAuxNav(fileMover);
  })

  // Private Option
  let privateOption = document.createElement("div");
  privateOption.className = "file_menu_option";
  privateOption.innerHTML = `<p>Make Private</p><span class="material-symbols-rounded">visibility_off</span>`;
  privateOption.addEventListener("click", () => {
    multiSelectBucketGL.forEach((file) => {
      file.access = "private";
    });
    fetch(`/api/bulk`, {
      method: "PATCH",
      body: JSON.stringify(multiSelectBucketGL),
    }).then(() => {
      showSnack(`Made selected files private`, COLOR_ORANGE, "info");
    });
  })

  // Public Option
  let publicOption = document.createElement("div");
  publicOption.className = "file_menu_option";
  publicOption.innerHTML = `<p>Make Public</p><span class="material-symbols-rounded">visibility</span>`;
  publicOption.addEventListener("click", () => {
    multiSelectBucketGL.forEach((file) => {
      file.access = "public";
    });
    fetch(`/api/bulk`, {
      method: "PATCH",
      body: JSON.stringify(multiSelectBucketGL),
    }).then(() => {
      showSnack(`Made selected files public`, COLOR_ORANGE, "info");
    });
  })

  // Delete Option
  let deleteOption = document.createElement("div");
  deleteOption.className = "file_menu_option";
  deleteOption.innerHTML = `<p>Delete</p><span class="material-symbols-rounded">delete_forever</span>`;
  deleteOption.addEventListener("click", () => {
    let ok = confirm(
      `Do you really want to delete ${multiSelectBucketGL.length} file(s)?`
    );
    if (!ok) {
      return;
    }
    fetch(`/api/bulk`, {
      method: "DELETE",
      body: JSON.stringify(multiSelectBucketGL),
    }).then(() => {
      multiSelectBucketGL.forEach((file) => {
        document.getElementById(`file-${file.hash}`).remove();
      });
      multiSelectBucketGL = [];
      navTop.removeChild(navTop.firstChild);
      showSnack(`Deleted selected files`, COLOR_RED, "info");
    });
  })

  fileOptionPanel.appendChild(zipOption);
  fileOptionPanel.appendChild(moveOption);
  fileOptionPanel.appendChild(privateOption);
  fileOptionPanel.appendChild(publicOption);
  fileOptionPanel.appendChild(deleteOption);

  renderInRightNav(fileOptionPanel);
  
}

function newFileElem(file, trashed = false) {
  let li = document.createElement("li");
  li.dataset.parent = file.parent || "";
  li.dataset.name = file.name;
  li.dataset.hash = file.hash;
  if (file.type === "folder") {
    li.addEventListener("dragover", (ev) => {
      li.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
    });
    li.addEventListener("dragleave", (ev) => {
      li.style.backgroundColor = "";
    });
    li.addEventListener("drop", (ev) => {
      ev.stopPropagation();
      let hash = ev.dataTransfer.getData("hash");
      let pe = ev.target.parentElement;
      let parent = pe.dataset.parent ? `${pe.dataset.parent}/${pe.dataset.name}` : pe.dataset.name;
      fetch(`/api/metadata`, {
        method: "PATCH",
        body: JSON.stringify({
          hash: hash,
          parent: parent,
        }),
      }).then(() => {
        showSnack("File Moved Successfully", COLOR_GREEN, "success");
        document.getElementById(`file-${hash}`).remove();
      });
    });
  } else {
    li.draggable = true;
    li.addEventListener("dragstart", (ev) => {
      ev.dataTransfer.setData("hash", file.hash);
    });
  }
  li.id = `file-${file.hash}`;
  let fileIcon = document.createElement("div");
  fileIcon.style.color = file.color || "var(--icon-span-color)";
  let pickerElem = document.createElement("input");
  pickerElem.type = "color";
  pickerElem.value = file.color || "var(--icon-span-color)";
  pickerElem.addEventListener("change", () => {
    file.color = pickerElem.value;
    fetch(`/api/metadata`, {
      method: "PUT",
      body: JSON.stringify(file),
    }).then(() => {
      fileIcon.style.color = file.color;
      showSnack(`Folder color changed successfully`, COLOR_GREEN, "success");
    });
  });
  fileIcon.appendChild(pickerElem);
  fileIcon.className = "file_icon";
  setIconByMime(file.mime, fileIcon);
  fileIcon.addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (file.type === "folder") {
      pickerElem.click();
      return;
    }
    if (!document.querySelector(".multi_select_options")) {
      let multiSelectOptions = document.createElement("div");
      multiSelectOptions.className = "multi_select_options";
      
      let menuButton = document.createElement("button");
      menuButton.innerHTML =
        '<span class="material-symbols-rounded">more_horiz</span>';
      menuButton.addEventListener("click", () => {
        handleMultiSelectMenuClick();
      });
      let selectCount = document.createElement("p");
      selectCount.style.marginRight = "auto";
      selectCount.id = "selection-count";
      multiSelectOptions.appendChild(selectCount);
      multiSelectOptions.appendChild(menuButton);
      renderAuxNav(multiSelectOptions);
    }
    if (multiSelectBucketGL.length === 25) {
      showSnack(`Can't select more than 25 items`, COLOR_ORANGE, "warning");
      return;
    } else {
      fileIcon.innerHTML = `<span class="material-symbols-rounded" style="color: rgb(48, 166, 48)">done</span>`;
      let index = multiSelectBucketGL.findIndex((f) => f.hash === file.hash);
      if (index === -1) {
        multiSelectBucketGL.push(file);
      } else {
        multiSelectBucketGL.splice(index, 1);
        setIconByMime(file.mime, fileIcon);
      }
      document.getElementById(
        "selection-count"
      ).innerHTML = `${multiSelectBucketGL.length} selected`;
      if (multiSelectBucketGL.length === 0) {
        navTop.removeChild(navTop.firstChild);
      }
    }
  });
  let fileInfo = document.createElement("div");
  fileInfo.className = "info";
  let fileName = document.createElement("p");
  fileName.innerHTML = file.name;
  fileName.id = `filename-${file.hash}`;
  let fileSizeAndDate = document.createElement("p");
  fileSizeAndDate.style.fontSize = "11px";
  fileSizeAndDate.id = `stat-${file.hash}`;
  if (file.type === "folder") {
    fileSizeAndDate.innerHTML = `${formatDateString(file.date)}`;
  } else {
    fileSizeAndDate.innerHTML = `${handleSizeUnit(
      file.size
    )} • ${formatDateString(file.date)}`;
  }
  fileInfo.appendChild(fileName);
  fileInfo.appendChild(fileSizeAndDate);
  li.appendChild(fileIcon);
  li.appendChild(fileInfo);
  let menuOptionSpan = document.createElement("span");
  menuOptionSpan.className = "material-symbols-rounded";
  menuOptionSpan.innerHTML = "more_horiz";
  menuOptionSpan.style.fontSize = "18px";
  menuOptionSpan.addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (trashed) {
      handleTrashFileMenuClick(file);
    } else {
      handleFileMenuClick(file);
    }
  });
  li.appendChild(menuOptionSpan);
  li.addEventListener("click", (ev) => {
    if (file.type === "folder") {
      handleFolderClick(file);
    } else if (fileName.contentEditable === "true") {
      ev.stopPropagation();
      return;
    } else {
      showFilePreview(file);
    }
  });
  li.addEventListener("contextmenu", (ev) => {
    ev.preventDefault();
    if (fileContextMenuGL) {
      fileContextMenuGL.close();
    }
    new FileContextMenu(ev, file).show();
  });
  return li;
}

function buildPinnedContent(data) {
  let ul = document.createElement("ul");
  ul.className = "pinned_files";
  data.forEach((file) => {
    ul.appendChild(newFileElem(file));
  });
  let fileList = document.createElement("div");
  fileList.className = "file_list";
  fileList.appendChild(ul);
  return fileList;
}

function buildRecentContent(data) {
  let ul = document.createElement("ul");
  ul.className = "recent_files";
  data.forEach((file) => {
    if (file.parent !== "~shared") {
      ul.appendChild(newFileElem(file));
    }
  });
  let fileList = document.createElement("div");
  fileList.className = "file_list";
  fileList.appendChild(ul);
  return fileList;
}

function buildFileBrowser(data) {
  let ul = document.createElement("ul");
  ul.className = "all_files";
  data.forEach((file) => {
    ul.appendChild(newFileElem(file));
  });
  let fileList = document.createElement("div");
  fileList.className = "file_list";
  fileList.appendChild(ul);
  return fileList;
}

function buildPrompt(folder) {
  let prompt = document.createElement("div");
  prompt.className = "prompt";
  let fragment = document.createElement("p");
  fragment.className = "fragment";
  let div = document.createElement("div");
  let backButton = document.createElement("i");
  backButton.className = "material-symbols-rounded";
  backButton.innerHTML = "arrow_back";
  backButton.addEventListener("click", () => {
    if (navTop.firstElementChild.className === "other" && !isFileMovingGL) {
      navTop.firstElementChild.remove();
    }
    if (!isFileMovingGL) {
      multiSelectBucketGL = [];
    }
    if (!folder.parent) {
      browseButton.click();
      return;
    }
    let fragments = folder.parent.split("/");
    handleFolderClick({
      name: fragments.pop(),
      parent: fragments.length >= 1 ? fragments.join("/") : null,
    });
  });
  let selectAll = document.createElement("i");
  selectAll.className = "material-symbols-rounded";
  selectAll.innerHTML = "select_all";
  selectAll.addEventListener("click", () => {
    let targets = [];
    let clickedTargets = [];
    let list = view.children[1].children;
    Array.from(list).forEach((li) => {
      let icon = li.firstElementChild.firstElementChild;
      if (icon.innerHTML === "folder") {
        return;
      }
      icon.innerHTML === "done"
        ? clickedTargets.push(icon)
        : targets.push(icon);
    });
    targets.slice(0, 25 - clickedTargets.length).forEach((icon) => {
      icon.click();
    });
    if (targets.length > 0) {
      selectAll.style.display = "none";
      deselectAll.style.display = "block";
    }
  });
  let deselectAll = document.createElement("i");
  deselectAll.id = "deselect-all";
  deselectAll.className = "material-symbols-rounded";
  deselectAll.innerHTML = "deselect";
  deselectAll.style.display = "none";
  deselectAll.addEventListener("click", () => {
    let list = view.children[1].children;
    Array.from(list).forEach((li) => {
      let icon = li.firstElementChild.firstElementChild;
      if (icon.innerHTML === "folder") {
        return;
      }
      icon.innerHTML === "done" ? icon.click() : null;
    });
    deselectAll.style.display = "none";
    selectAll.style.display = "block";
  });
  prompt.appendChild(backButton);
  div.appendChild(fragment);
  div.appendChild(selectAll);
  div.appendChild(deselectAll);
  prompt.appendChild(div);
  return prompt;
}

function updateToCompleted(hash) {
  let icon = document.querySelector(`#icon-${hash}`);
  icon.className = "fa-solid fa-check-circle";
  icon.style.color = "#279627";
}

let snackTimer = null;
function showSnack(text, color = COLOR_GREEN, type = "success") {
  let icons = {
    success: "done",
    error: "cancel",
    warning: "priority_high",
    info: "question_mark",
  };
  let snackbar = document.querySelector(".snackbar");
  snackbar.style.display = "flex";
  let content = document.createElement("div");
  content.className = "snack_content";
  content.style.backgroundColor = color;
  let icon = document.createElement("i");
  icon.className = "material-symbols-rounded";
  icon.style.marginRight = "10px";
  icon.innerHTML = icons[type];
  let p = document.createElement("p");
  p.innerHTML = text;
  let close = document.createElement("i");
  close.className = "material-symbols-rounded";
  close.style.marginLeft = "10px";
  close.innerHTML = "close";
  close.style.cursor = "pointer";
  close.style.backgroundColor = "transparent";
  close.addEventListener("click", () => {
    snackbar.style.display = "none";
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
    snackbar.style.display = "none";
  }, 3000);
}

function renderFilesByQuery(query) {
  sidebarOptionSwitch();
  if (previousOption) {
    previousOption.style.borderLeft = "5px solid transparent";
    previousOption.style.backgroundColor = "transparent";
    previousOption = null;
  }
  query["deleted?ne"] = true;
  fetch("/api/query", { method: "POST", body: JSON.stringify(query) })
    .then((response) => response.json())
    .then((data) => {
      view.innerHTML = "";
      if (!data) {
        showSnack("No files found of this type", COLOR_ORANGE, "warning");
        return;
      }
      let fileList = document.createElement("div");
      fileList.className = "file_list";
      let ul = document.createElement("ul");
      ul.className = "all_files";
      data.forEach((file) => {
        ul.appendChild(newFileElem(file));
      });
      fileList.appendChild(ul);
      view.appendChild(fileList);
    });
}

async function loadSharedFile(file, controller, loaderElem) {
  let size = file.size;
  const chunkSize = 1024 * 1024 * 4;
  if (size < chunkSize) {
    let resp = await fetch(
      `/api/external/${userIdGL}/${file.owner}/${file.hash}/0`,
      { signal: controller.signal }
    );
    loaderElem.innerHTML = "100%";
    return await resp.blob();
  } else {
    let skips = 0;
    let progress = 0;
    if (size % chunkSize === 0) {
      skips = size / chunkSize;
    } else {
      skips = Math.floor(size / chunkSize) + 1;
    }
    let heads = Array.from(Array(skips).keys());
    let promises = [];
    heads.forEach((head) => {
      promises.push(
        fetch(`/api/external/${userIdGL}/${file.owner}/${file.hash}/${head}`)
          .then((resp) => {
            return resp.blob();
          })
          .then((blob) => {
            progress += blob.size;
            let percentage = Math.floor((progress / size) * 100);
            loaderElem.innerHTML = `${percentage}%`;
            return blob;
          })
      );
    });
    let blobs = await Promise.all(promises);
    return new Blob(blobs, { type: file.mime });
  }
}

// this will suck at large files
async function showFilePreview(file) {
  previewModal.innerHTML = "";
  previewModal.style.display = "flex";
  previewModal.style.outline = "none";
  let description = document.createElement("p");
  description.innerHTML = `
    ${file.name}
    <span 
      style="color: ${COLOR_GREEN}; 
      font-size: 15px; 
      margin-left: 10px" 
      id='loader-amount'
    >0%
    </span>
  `;
  previewModal.appendChild(description);
  let openInNew = document.createElement("span");
  openInNew.title = "Open in new tab";
  openInNew.className = "material-symbols-rounded";
  openInNew.innerHTML = "open_in_new";
  openInNew.style.opacity = 0.5;
  openInNew.addEventListener("click", () => {
    window.open(blobURL, "_blank");
  });
  let stop = document.createElement("span");
  stop.title = "Stop loading";
  stop.className = "material-symbols-rounded";
  stop.innerHTML = "close";
  stop.style.color = COLOR_RED;
  stop.style.pointerEvents = "all";
  stop.addEventListener("click", () => {
    controller.abort();
    previewModal.innerHTML = "";
    previewModal.style.display = "none";
    previewModal.close();
  });
  let download = document.createElement("span");
  download.title = "Download";
  download.className = "material-symbols-rounded";
  download.innerHTML = "download";
  download.style.opacity = 0.5;
  download.addEventListener("click", () => {
    let a = document.createElement("a");
    a.href = blobURL;
    a.download = file.name;
    a.click();
  });
  previewModal.appendChild(stop);
  previewModal.appendChild(download);
  previewModal.appendChild(openInNew);
  previewModal.showModal();
  let loaderAmount = document.querySelector("#loader-amount");
  controller = new AbortController();
  let blobURL;
  if (file.shared) {
    let blob = await loadSharedFile(file, controller, loaderAmount);
    blobURL = URL.createObjectURL(new Blob([blob], { type: file.mime }));
    loaderAmount.innerHTML = "100%";
    openInNew.style.opacity = 1;
    download.style.opacity = 1;
    openInNew.style.pointerEvents = "all";
    download.style.pointerEvents = "all";
  } else {
    let extRegex = /(?:\.([^.]+))?$/;
    let extension = extRegex.exec(file.name);
    if (extension && extension[1]) {
      extension = extension[1];
    } else {
      extension = "";
    }
    let filename;
    if (extension === "") {
      filename = file.hash;
    } else {
      filename = `${file.hash}.${extension}`;
    }
    let projectId = secretKeyGL.split("_")[0];
    let url = `https://drive.deta.sh/v1/${projectId}/filebox/files/download?name=${filename}`;
    const response = await fetch(url, {
      headers: { "X-Api-Key": secretKeyGL },
      signal: controller.signal,
    });
    if (response.status !== 200) {
      loaderAmount.style.color = COLOR_RED;
      loaderAmount.innerHTML = `Error ${response.status}`
    } else {
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
              loaderAmount.innerHTML = `${percentage}%`;
              return pump();
            });
          }
        },
      });
      const rs = new Response(stream);
      const blob = await rs.blob();
      blobURL = URL.createObjectURL(new Blob([blob], { type: file.mime }));
      openInNew.style.pointerEvents = "all";
      download.style.pointerEvents = "all";
      openInNew.style.opacity = 1;
      download.style.opacity = 1;
    }
  }
}

function fileMover(file) {
  let fileMover = document.createElement("div");
  fileMover.className = "file_mover";
  let cancelButton = document.createElement("button");
  cancelButton.innerHTML = "Cancel";
  cancelButton.addEventListener("click", () => {
    navTop.removeChild(navTop.firstChild);
  });
  let selectButton = document.createElement("button");
  selectButton.innerHTML = "Select";
  selectButton.style.backgroundColor = "var(--accent-blue)";
  selectButton.addEventListener("click", () => {
    if (!openedFolderGL) {
      file.parent = null;
    } else {
      if (openedFolderGL.parent) {
        file.parent = `${openedFolderGL.parent}/${openedFolderGL.name}`;
      } else {
        file.parent = openedFolderGL.name;
      }
    }
    fetch(`/api/metadata`, {
      method: "PATCH",
      body: JSON.stringify({
        hash: file.hash,
        parent: file.parent,
      }),
    }).then(() => {
      if (document.querySelector(`#file-${file.hash}`)) {
        showSnack("File is already here", COLOR_ORANGE, "info");
        return;
      }
      showSnack("File Moved Successfully", COLOR_GREEN, "success");
      navTop.removeChild(navTop.firstChild);
      if (openedFolderGL) {
        handleFolderClick(openedFolderGL);
      } else {
        browseButton.click();
      }
    });
  });
  let p = document.createElement("p");
  p.innerHTML = "Select Move Destination";
  fileMover.appendChild(cancelButton);
  fileMover.appendChild(p);
  fileMover.appendChild(selectButton);
  return fileMover;
}

function renderSearchResults(query) {
  fetch(`/api/query`, {
    method: "POST",
    body: JSON.stringify(query),
  })
    .then((response) => response.json())
    .then((data) => {
      let key = Object.keys(query)[0];
      let attr = key.replace("?contains", "");
      let value = query[key];
      view.innerHTML = "";
      if (!data) {
        let p = document.createElement("p");
        let symbol = `<i class="fa-solid fa-circle-exclamation"></i> `;
        p.innerHTML = `${symbol} No results found for ${attr}: *${value}*`;
        p.style.backgroundColor = "#e44d27";
        view.appendChild(p);
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
      let p = document.createElement("p");
      p.innerHTML = `Search results for ${attr}: *${value}*`;
      p.style.backgroundColor = "#317840";
      view.appendChild(p);
      let list = document.createElement("ul");
      view.appendChild(list);
      data.forEach((file) => {
        list.appendChild(newFileElem(file));
      });
    });
}

function renderAuxNav(elem) {
  let wrapper = document.createElement("div");
  wrapper.className = "other";
  wrapper.appendChild(elem);
  navTop.prepend(wrapper);
}

function renderFileSenderModal(file) {
  if (!userIdGL) {
    showSnack(
      "File sending is not available for this instance",
      COLOR_ORANGE,
      "info"
    );
    return;
  }
  let fileSender = document.createElement("div");
  fileSender.className = "file_sender";
  let filename = document.createElement("p");
  filename.innerHTML = file.name;
  let userIdField = document.createElement("input");
  userIdField.placeholder = "Type user instance id";
  userIdField.type = "text";
  userIdField.spellcheck = false;
  let buttons = document.createElement("div");
  let cancelButton = document.createElement("button");
  cancelButton.innerHTML = "Cancel";
  cancelButton.addEventListener("click", () => {
    hideRightNav();
  });
  let sendButton = document.createElement("button");
  sendButton.innerHTML = "Send";
  sendButton.style.backgroundColor = COLOR_GREEN;
  sendButton.addEventListener("click", () => {
    if (userIdField.value === userIdGL) {
      showSnack("You can't send a file to yourself", COLOR_ORANGE, "warning");
      return;
    }
    let fileClone = structuredClone(file);
    delete fileClone.recipients;
    delete fileClone.pinned;
    fileClone.owner = userIdGL;
    fileClone.shared = true;
    fileClone.parent = "~shared";
    fetch(`/api/push/${userIdField.value}`, {
      method: "POST",
      body: JSON.stringify(fileClone),
    }).then((resp) => {
      if (resp.status !== 207) {
        fileSender.style.display = "none";
        showSnack("Something went wrong. Please try again", COLOR_RED, "error");
        return;
      }
      if (file.recipients) {
        if (!file.recipients.includes(userIdField.value)) {
          file.recipients.push(userIdField.value);
        }
      } else {
        file.recipients = [userIdField.value];
      }
      fetch(`/api/metadata`, {
        method: "PUT",
        body: JSON.stringify(file),
      }).then((resp) => {
        if (resp.status === 207) {
          showSnack(
            `File shared with ${userIdField.value}`,
            COLOR_GREEN,
            "success"
          );
          fileSender.style.display = "none";
        } else {
          showSnack(
            "Something went wrong. Please try again",
            COLOR_RED,
            "error"
          );
        }
      });
    });
  });
  buttons.appendChild(cancelButton);
  buttons.appendChild(sendButton);
  fileSender.appendChild(filename);
  fileSender.appendChild(userIdField);
  fileSender.appendChild(buttons);
  renderInRightNav(fileSender);
}

function renderGreetings() {
  let greetings = document.createElement("div");
  greetings.className = "greetings";
  let skip = document.createElement("div");
  skip.className = "skip";
  skip.innerHTML = "<p>skip</p>";
  skip.addEventListener("click", () => {
    localStorage.setItem("isGreeted", true);
    greetings.remove();
  });
  let innerOne = document.createElement("div");
  innerOne.className = "inner";
  innerOne.innerHTML = '<img src="../assets/app_icon.png" alt="icon">';
  let innerTwo = document.createElement("div");
  innerTwo.className = "inner";
  let h1 = document.createElement("h1");
  h1.innerHTML = "Welcome to Filebox";
  let p = document.createElement("p");
  p.innerHTML = `Let's upload your first file`;
  let dropSection = document.createElement("div");
  let dropSectionSpan = document.createElement("span");
  dropSectionSpan.innerHTML = "Drop your file here or click to select";
  dropSection.className = "drop";
  dropSection.appendChild(dropSectionSpan);
  let pseudoInput = document.createElement("input");
  pseudoInput.type = "file";
  pseudoInput.style.display = "none";
  pseudoInput.addEventListener("change", () => {
    dropSectionSpan.innerHTML = pseudoInput.files[0].name;
    uploadButton.disabled = false;
    uploadButton.style.opacity = "1";
  });
  dropSection.appendChild(pseudoInput);
  dropSection.addEventListener("click", () => {
    pseudoInput.click();
  });
  dropSection.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropSection.style.border = "2px dashed #cccccc8f";
  });
  dropSection.addEventListener("dragleave", (e) => {
    e.preventDefault();
    dropSection.style.border = "2px dashed var(--color-blackish-hover)";
  });
  dropSection.addEventListener("drop", (e) => {
    e.preventDefault();
    dropSection.style.border = "2px dashed var(--color-blackish-hover)";
    pseudoInput.files = e.dataTransfer.files;
    dropSectionSpan.innerHTML = pseudoInput.files[0].name;
    uploadButton.disabled = false;
    uploadButton.style.opacity = "1";
  });
  let uploadButton = document.createElement("button");
  uploadButton.innerHTML = "Upload";
  uploadButton.disabled = true;
  uploadButton.style.opacity = "0.5";
  uploadButton.addEventListener("click", () => {
    let file = pseudoInput.files[0];
    let metadata = buildFileMetadata(file);
    prependQueueElem(metadata, true);
    upload(file, metadata, (percentage) => {
      progressHandlerById(metadata.hash, percentage);
    });
    localStorage.setItem("isGreeted", true);
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

function showRenameModal(file) {
  let renameModal = document.createElement("div");
  renameModal.className = "rename";
  let input = document.createElement("input");
  input.type = "text";
  input.value = file.name;
  input.autofocus = true;
  input.placeholder = "Enter new name";
  input.spellcheck = false;
  input.addEventListener("input", () => {
    if (file.name === input.value) {
      renameButton.style.opacity = "0.5";
      renameButton.disabled = true;
      return;
    }
    let pattern = /\.[0-9a-z]+$/i;
    let oldExtension = pattern.exec(file.name);
    oldExtension = oldExtension ? oldExtension[0] : "";
    let newExtension = pattern.exec(input.value);
    newExtension = newExtension ? newExtension[0] : "";
    if (oldExtension !== newExtension) {
      renameButton.style.opacity = "0.5";
      renameButton.disabled = true;
      return;
    }
    renameButton.style.opacity = "1";
    renameButton.disabled = false;
  });
  let buttons = document.createElement("div");
  buttons.style.display = "flex";
  buttons.style.width = "100%";
  buttons.style.justifyContent = "flex-end";
  let cancelButton = document.createElement("button");
  cancelButton.innerHTML = "Cancel";
  cancelButton.style.marginRight = "10px";
  cancelButton.style.backgroundColor = COLOR_RED + "6f";
  cancelButton.addEventListener("click", () => {
    renameModal.remove();
    previewModal.style.display = "none";
    previewModal.close();
  });
  let renameButton = document.createElement("button");
  renameButton.style.opacity = "0.5";
  renameButton.disabled = true;
  renameButton.innerHTML = "Rename";
  renameButton.style.backgroundColor = COLOR_GREEN + "6f";
  renameButton.addEventListener("click", () => {
    fetch(`/api/metadata`, {
      method: "PATCH",
      body: JSON.stringify({ hash: file.hash, name:input.value }),
    }).then((res) => {
      if (res.status === 200) {
        file.name = input.value;
        document.querySelector(`#filename-${file.hash}`).innerHTML = file.name;
        cancelButton.click();
        showSnack("File renamed successfully", COLOR_GREEN, "info");
      }
    });
  });
  buttons.appendChild(cancelButton);
  buttons.appendChild(renameButton);
  renameModal.appendChild(input);
  renameModal.appendChild(buttons);
  previewModal.appendChild(renameModal);
  previewModal.style.display = "flex";
  previewModal.showModal();
}
