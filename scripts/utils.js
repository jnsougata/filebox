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