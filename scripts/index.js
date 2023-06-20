const colorRed = "#CB1446";
const colorGreen = "#2AA850";
const colorBlue = "#2E83F3";
const colorOrange = "#FF6700";
let runningTaskCount = 0;
let isFileMoving = false;
let globalUserId = null;
let globalConsumption = 0;
let globalSecretKey = null;
let globalTrashFiles = null;
let isUserSubscribed = false;
let globalPreviewFile = null;
let globalContextFolder = null;
let globalContextOption = null;
let globalDiscoveryStatus = null;
let navBar = document.querySelector("nav");
let sidebar = document.querySelector(".nav_left");
let blurLayer = document.querySelector(".blur_layer");
let mainSection = document.querySelector("main");
let totalSizeWidget = document.querySelector("#storage");

const fetchx = window.fetch;
window.fetch = async (...args) => {
  const response = await fetchx(...args);
  if (response.status === 502) {
    showSnack("Bad Gateway! Try again.", colorOrange, "warning");
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
  return options[globalContextOption];
}

function closeSidebar() {
  blurLayer.style.display = "none";
  if (window.innerWidth < 768) {
    sidebar.style.display = "none";
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
recentButton.addEventListener("click", () => {
  globalContextOption = "recent";
  closeSidebar();
  renderOriginalNav();
  fetch(`/api/metadata`)
    .then((response) => response.json())
    .then((data) => {
      mainSection.innerHTML = "";
      if (data) {
        data = sortFileByTimestamp(data).slice(0, 10);
        let list = document.createElement("ul");
        mainSection.appendChild(list);
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
});

let browseButton = document.querySelector("#browse");
browseButton.addEventListener("click", () => {
  globalContextOption = "browse";
  globalContextFolder = null;
  closeSidebar();
  if (!isFileMoving) {
    renderOriginalNav();
  }
  fetch(`/api/root`)
    .then((response) => response.json())
    .then((data) => {
      mainSection.innerHTML = "";
      if (!data) {
        mainSection.innerHTML = `<p>You don't have any file or folder</p>`;
        return;
      }
      let files = [];
      let folders = [];
      data.forEach((file) => {
        file.type === "folder" ? folders.push(file) : files.push(file);
      });
      mainSection.appendChild(buildPrompt({ parent: null }));
      let list = document.createElement("ul");
      mainSection.appendChild(list);
      folders.concat(files).forEach((file) => {
        list.appendChild(newFileElem(file));
      });
      updateFolderStats(folders);
      updatePromptFragment();
    });
});

let pinnedButton = document.querySelector("#pinned");
pinnedButton.addEventListener("click", () => {
  globalContextOption = "pinned";
  closeSidebar();
  renderOriginalNav();
  fetch("/api/query", {
    method: "POST",
    body: JSON.stringify({ pinned: true, "deleted?ne": true }),
  })
    .then((response) => response.json())
    .then((data) => {
      mainSection.innerHTML = "";
      if (!data) {
        mainSection.innerHTML = `<p>You don't have any pinned file or folder</p>`;
        return;
      }
      let files = [];
      let folders = [];
      data.forEach((file) => {
        file.type === "folder" ? folders.push(file) : files.push(file);
      });
      let list = document.createElement("ul");
      mainSection.appendChild(list);
      folders.concat(files).forEach((file) => {
        list.appendChild(newFileElem(file));
      });
    });
});

let sharedButton = document.querySelector("#shared");
sharedButton.addEventListener("click", () => {
  globalContextOption = "shared";
  closeSidebar();
  renderOriginalNav();
  mainSection.innerHTML = "";
  let fileList = document.createElement("div");
  fileList.className = "file_list";
  fetch(`/api/query`, {
    method: "POST",
    body: JSON.stringify({ parent: "~shared" }),
  })
    .then((resp) => {
      if (resp.status === 200) {
        return resp.json();
      }
      return null;
    })
    .then((data) => {
      if (!data) {
        mainSection.innerHTML = `<p>You haven't received any file</p>`;
        return;
      }
      let list = document.createElement("ul");
      mainSection.appendChild(list);
      data.forEach((file) => {
        list.appendChild(newFileElem(file));
      });
    });
});

let trashButton = document.querySelector("#trash");
trashButton.addEventListener("click", () => {
  globalContextOption = "trash";
  renderOriginalNav();
  fetch("/api/query", {
    method: "POST",
    body: JSON.stringify({ deleted: true }),
  })
    .then((response) => response.json())
    .then((data) => {
      mainSection.innerHTML = "";
      if (!data) {
        mainSection.innerHTML = `<p>There is no trash file</p>`;
        return;
      }
      dataMap = {};
      data.forEach((file) => {
        dataMap[file.hash] = file;
      });
      globalTrashFiles = dataMap;
      let list = document.createElement("ul");
      mainSection.appendChild(list);
      data.forEach((file) => {
        list.appendChild(newFileElem(file, true));
      });
    });
  closeSidebar();
});

let sanitizeButton = document.querySelector("#sanitize");
sanitizeButton.addEventListener("click", () => {
  fetch("/api/sanitize")
    .then((response) => response.json())
    .then((data) => {
      showSnack(`${data.sanitized} files sanitized `, colorGreen, "success");
    });
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
  if (!globalUserId) {
    showSnack("Can not extract user id from domain name", colorRed, "error");
    return;
  }
  navigator.clipboard.writeText(globalUserId).then(() => {
    showSnack("User Id copied to clipboard!", colorGreen, "success");
  });
});

mainSection.addEventListener("dragover", (e) => {
  e.preventDefault();
  e.stopPropagation();
});

mainSection.addEventListener("drop", (e) => {
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
  renderOriginalNav();
  let resp = await fetch(`/api/key`);
  let data = await resp.json();
  globalSecretKey = data.key;
  let globalUserIdParts = /-(.*?)\./.exec(window.location.hostname);
  globalUserId = globalUserIdParts ? globalUserIdParts[1] : null;
  document.querySelector("#username").innerHTML = globalUserId
    ? globalUserId
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
  if (e.target.tagName === "DIALOG" && fileContextMenu__GL) {
    fileContextMenu__GL.close();
  }
});

window.addEventListener("resize", () => {
  let navIcon = document.querySelector("#dyn-nav-icon");
  if (navIcon) {
    navIcon.parentNode.replaceChild(buildDynamicNavIcon(), navIcon);
  }
  if (window.innerWidth > 768) {
    sidebar.style.display = "flex";
  } else {
    sidebar.style.display = "none";
    fileContextMenu__GL.close();
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
