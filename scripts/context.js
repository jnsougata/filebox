var fileContextMenu__GL = null;

function onSendClick(file) {
  renderFileSenderModal(file);
}

function onRenameClick(file) {
  let elem = document.querySelector(`#filename-${file.hash}`);
  elem.contentEditable = true;
  elem.style.zIndex = "9999";
  elem.focus();
  elem.addEventListener("blur", (ev) => {
    elem.contentEditable = false;
    elem.style.zIndex = "1";
    if (ev.target.innerText === file.name) {
      return;
    }
    let extPattern = /\.[0-9a-z]+$/i;
    let oldext = extPattern.exec(file.name);
    oldext = oldext ? oldext[0] : "";
    let newext = extPattern.exec(ev.target.innerText);
    newext = newext ? newext[0] : "";
    if (oldext !== newext) {
      ev.target.innerHTML = file.name;
      showSnack("File extension cannot be changed", colorOrange, "warning");
      return;
    }
    fetch(`/api/rename`, {
      method: "POST",
      body: JSON.stringify({ hash: file.hash, name: ev.target.innerText }),
    }).then((res) => {
      if (res.status === 200) {
        file.name = ev.target.innerText;
        elem.innerHTML = ev.target.innerText;
        showSnack(
          `File renamed to ${ev.target.innerText}`,
          colorGreen,
          "success"
        );
      }
    });
  });
}

function onDownloadClick(file) {
  prependQueueElem(file, false);
  download(file, (progress) => {
    progressHandlerById(file.hash, progress);
  });
}

function onShareLinkClick(file) {
  if (file.access === "private") {
    showSnack(`Make file public to share via link`, colorOrange, "warning");
  } else {
    window.navigator.clipboard
      .writeText(`${window.location.origin}/shared/${file.hash}`)
      .then(() => {
        showSnack(`Copied sharing URL to clipboard`, colorGreen, "success");
      });
  }
}

function onEmbedClick(file) {
  if (file.access === "private") {
    showModal;
    showSnack(`Make file public to embed`, colorOrange, "warning");
  } else if (file.size > 1024 * 1024 * 4) {
    showSnack(`File is too large to embed`, colorRed, "error");
  } else {
    window.navigator.clipboard
      .writeText(`${window.location.origin}/embed/${file.hash}`)
      .then(() => {
        showSnack(`Copied embed URL to clipboard`, colorGreen, "success");
      });
  }
}

function onMoveClick(file) {
  isFileMoving = true;
  browseButton.click();
  renderAuxNav(fileMover(file));
}

function onTrashClick(file) {
  if (file.type === "folder") {
    deleteFolderPermanently(file).then(() => {
      showSnack(`Permanently Deleted ${file.name}`, colorRed, "warning");
    });
  } else {
    file.deleted = true;
    fetch(`/api/metadata`, {
      method: "PATCH",
      body: JSON.stringify(file),
    }).then(() => {
      showSnack(`Moved to trash ${file.name}`, colorRed, "warning");
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
      method: "PATCH",
      body: JSON.stringify(file),
    }).then(() => {
      let folder = document.getElementById(`file-${file.hash}`);
      let folderIcon = folder.children[0];
      folderIcon.style.color = file.color;
      showSnack(`Folder color changed successfully`, colorGreen, "success");
    });
  });
  document.body.appendChild(pickerElem);
  pickerElem.click();
}

function onRestoreClick(file) {
  checkFileParentExists(file).then((exists) => {
    if (!exists && file.parent !== undefined) {
      showSnack(`Parent not found. Restoring to root`, colorOrange, "warning");
      delete file.parent;
      delete file.deleted;
    } else {
      delete file.deleted;
    }
    fetch(`/api/metadata`, {
      method: "PATCH",
      body: JSON.stringify(file),
    }).then(() => {
      document.getElementById(`file-${file.hash}`).remove();
      showSnack(`Restored ${file.name}`, colorGreen, "success");
      delete globalTrashFiles[file.hash];
    });
  });
}

function onDeletePermanentlyClick(file) {
  fetch(`/api/metadata`, { method: "DELETE", body: JSON.stringify(file) }).then(
    () => {
      showSnack(`Permanently Deleted ${file.name}`, colorRed, "warning");
      document.getElementById(`file-${file.hash}`).remove();
      if (!file.shared) {
        updateSpaceUsage(-file.size);
      }
      delete globalTrashFiles[file.hash];
    }
  );
}

function onPinUnpinClick(file) {
  if (file.pinned) {
    fetch(`/api/bookmark/${file.hash}`, { method: "DELETE" }).then(() => {
      showSnack(`File unpinned successfully`, colorOrange, "info");
      let card = document.getElementById(`file-${file.hash}`);
      if (card) {
        card.remove();
      }
      delete file.pinned;
    });
  } else {
    fetch(`/api/bookmark/${file.hash}`, { method: "POST" }).then(() => {
      showSnack(`File pinned successfully`, colorGreen, "success");
      let pinnedSection = document.querySelector(".pinned_files");
      if (pinnedSection) {
        pinnedSection.appendChild(newFileElem(file));
      }
      file.pinned = true;
    });
  }
}

const contextOptions = [
  { label: "Send", icon: "send", callback: onSendClick, fileOnly: true },
  { label: "Rename", icon: "edit", callback: onRenameClick, fileOnly: true },
  { label: "Download", icon: "download", callback: onDownloadClick, fileOnly: true,},
  { label: "Share Link", icon: "link", callback: onShareLinkClick, fileOnly: true, ownerOnly: true,},
  { label: "Embed Link", icon: "code", callback: onEmbedClick, fileOnly: true, ownerOnly: true,},
  { label: "Move", icon: "arrow_forward", callback: onMoveClick, fileOnly: true,},
  { label: "Color", icon: "color_lens", callback: onColorClick,folderOnly: true,},
  { label: "Download as Zip", icon: "archive", callback: downloadFolderAsZip, folderOnly: true,},
  { label: "Trash", icon: "delete", callback: onTrashClick, fileOnly: true,},
  { label: "Delete Permanently", icon: "delete", callback: onTrashClick, folderOnly: true,},
  { label: "Restore", icon: "replay", callback: onRestoreClick, trashOnly: true,},
  { label: "Delete Permanently", icon: "delete_forever", callback: onDeletePermanentlyClick, trashOnly: true,},
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
    fileContextMenu__GL = this;
  }

  close() {
    this.elem.close();
    this.elem.style.display = "none";
    const fileElem = document.getElementById(`file-${this.elem.id}`);
    if (fileElem) {
      fileElem.style.backgroundColor = `transparent`;
    }
    fileContextMenu__GL = null;
  }
}
