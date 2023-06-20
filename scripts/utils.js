function renderInRightNav(elem) {
  NAV_RIGHT.innerHTML = "";
  NAV_RIGHT.appendChild(elem);
  NAV_RIGHT.style.display = "flex";
  BLUR_LAYER.style.display = "block";
}

function hideRightNav() {
  NAV_RIGHT.style.display = "none";
  BLUR_LAYER.style.display = "none";
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
  TOTAL_USAGE.innerText = `${handleSizeUnit(usageGL)}`;
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
  return [...Array(16)]
    .map(() => Math.floor(Math.random() * 16).toString(16))
    .join("");
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
    if (openedFolderGL.parent) {
      body.parent = `${openedFolderGL.parent}/${openedFolderGL.name}`;
    } else {
      body.parent = openedFolderGL.name;
    }
  }
  let resp = await fetch(`/api/metadata`, { method: "POST", body: JSON.stringify(body) })
  if (resp.status === 409) {
		showSnack(`Folder with same name already exists`, COLOR_RED, "error");
		return;
	} else if (resp.status <= 207) {
		showSnack(`Created folder ${name}`, COLOR_GREEN, "success");
		handleFolderClick(body);
	}
}
