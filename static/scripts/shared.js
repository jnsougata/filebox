const view = document.querySelector("main");
const snackbar = document.querySelector(".snackbar");
const navRight = document.querySelector(".nav_right");
const blurLayer = document.querySelector(".blur_layer");
const tasksElem = document.querySelector("#tasks");
const progressElem = document.querySelector("#progress");

const COLOR_GREEN = "#2AA850";

let root = null;


blurLayer.addEventListener("click", () => {
  closeRightNav();
});

progressElem.addEventListener("click", () => {
  showRightNav();
});


window.addEventListener("DOMContentLoaded", async () => {
  const hash = window.location.href.split("/").pop();
  const resp = await fetch(`/api/metadata/${hash}`);
  const file = await resp.json();
  if (file.type === "folder") {
    root = file.parent;
    await renderFolder(file);
  } else {
    let files = document.createElement("ul");
    files.appendChild(fileElem(file));
    view.appendChild(files);
  }
});

function promptElem(folder) {
  let prompt = document.createElement("div");
  prompt.className = "prompt";
  let fragment = document.createElement("div");
  let text = folder.parent ? `${folder.parent}/${folder.name}` : folder.name;
  fragment.innerHTML = `<p>${text}</p>`
  let div = document.createElement("div");
  let backButton = document.createElement("i");
  backButton.className = "material-symbols-rounded";
  backButton.innerHTML = "arrow_back";
  backButton.style.color = "white";
  backButton.addEventListener("click", async () => {
    if (folder.parent === root) {
      return;
    }
    if (folder.parent) {
      let parent = folder.parent.split("/");
      let name = parent.pop();
      parent = parent.join("/");
      await renderFolder({parent: parent, name: name});
    }
  });
  prompt.appendChild(fragment);
  div.appendChild(backButton);
  prompt.appendChild(div);
  return prompt;
}


function fileElem(file) {
  let li = document.createElement("li");
  li.id = `file-${file.hash}`;
  li.style.padding = "0";
  let fileIcon = document.createElement("div");
  fileIcon.classList.add("file_icon");
  setIconByMime(file.mime, fileIcon);
  fileIcon.style.color = file.color || "var(--icon-span-color)";
  li.appendChild(fileIcon);
  let info = document.createElement("div");
  info.classList.add("info");
  let fileName = document.createElement("p");
  fileName.innerText = file.name;
  let fileSizeAndDate = document.createElement("p");
  fileSizeAndDate.style.fontSize = "12px";
  if (file.type !== "folder") {
    fileSizeAndDate.innerHTML = `${handleSizeUnit(file.size)} • ${formatDateString(file.date)}`;
  } else {
    fileSizeAndDate.innerHTML = `${formatDateString(file.date)}`;
  }
  info.appendChild(fileName);
  info.appendChild(fileSizeAndDate);
  li.appendChild(info);
  let progressEL = document.createElement("span");
  progressEL.style.color = COLOR_GREEN;
  progressEL.style.display = "none";
  progressEL.style.fontSize = "18px";
  progressEL.classList.add("material-symbols-rounded");
  progressEL.innerText = "progress_activity";
  progressEL.addEventListener("click", async () => {
    showRightNav();
  });
  li.appendChild(progressEL);
  let download = document.createElement("span");
  progressEL.style.marginLeft = "10px";
  download.style.fontSize = "22px";
  download.classList.add("material-symbols-rounded");
  download.innerText = "download";
  download.addEventListener("click", async () => {
    blurLayer.style.display = "block";
    navRight.style.display = "flex";
    progressEL.style.display = "block";
    download.style.display = "none";
    let angle = 0;
    let interval = setInterval(() => {
      angle += 3;
      progressEL.style.transform = `rotate(${angle}deg)`;
    }, 10);
    const chunkSize = 1024 * 1024 * 4;
    let taskEL = document.querySelector(`#task-${file.hash}`);
    if (taskEL) {
      taskEL.remove();
    }
    prependQueueElem(file);
    let bar = document.querySelector(`#bar-${file.hash}`);
    let percentage = document.querySelector(`#percentage-${file.hash}`);
    if (file.size < chunkSize) {
      const resp = await fetch(`/api/download/na/${file.hash}/0`);
      if (resp.status === 403) {
        alert(`File access denied by owner!`);
        window.location.reload();
      } else {
        let a = document.createElement("a");
        a.href = URL.createObjectURL(await resp.blob());
        bar.style.width = "100%";
        percentage.innerHTML = "100%";
        a.download = file.name;
        a.click();
      }
    } else {
      let skips = 0;
      if (file.size % chunkSize === 0) {
        skips = file.size / chunkSize;
      } else {
        skips = Math.floor(file.size / chunkSize) + 1;
      }
      let heads = Array.from(Array(skips).keys());
      let promises = [];
      let progress = 0;
      heads.forEach((head) => {
        promises.push(
          fetch(`/api/download/na/${file.hash}/${head}`)
            .then((response) => {
              if (response.status === 403) {
                alert(`File access denied by owner!`);
                window.location.reload();
              } else if (response.status === 502) {
                alert(`Server refused to deliver chunk ${head}, try again!`);
                window.location.reload();
              } else {
                return response.blob();
              }
            })
            .then((blob) => {
              progress++;
              bar.style.width = `${Math.round((progress / skips) * 100)}%`;
              percentage.innerHTML = `${Math.round((progress / skips) * 100)}%`;
              return blob;
            })
        );
      });
      const blobs = await Promise.all(promises);
      let blob = new Blob(blobs, { type: file.mime });
      let a = document.createElement("a");
      a.href = URL.createObjectURL(blob);;
      bar.style.width = "100%";
      percentage.innerHTML = "100%";
      a.download = file.name;
      a.click();
    }
    clearInterval(interval);
    progressEL.style.display = "none";
    download.style.display = "block";
  });
  if (file.type !== "folder") {
    li.appendChild(download);
  }
  if (file.type === "folder") {
    li.addEventListener("click", async () => {
      await renderFolder(file);
    });
  }
  return li;
}

async function renderFolder(file) {
  let parent = file.parent ? `${file.parent}/${file.name}` : file.name;
  const resp = await fetch(`/api/query`, {
    method: "POST",
    body: JSON.stringify({
      "__union": true,
      "__queries": [
        {
          "parent": parent,
          "type": "folder",
        },
        {
          "parent": parent,
          "access": "public",
        }
      ]
    }),
  })
  let ul = document.createElement("ul");
  let children = await resp.json();
  children = children.sort((a, b) => {
    if (a.type === "folder" && b.type !== "folder") {
      return -1;
    } else if (a.type !== "folder" && b.type === "folder") {
      return 1;
    } else {
      return 0;
    }
  });
  children.forEach((child) => {
    ul.appendChild(fileElem(child)); 
  });
  view.innerHTML = "";
  view.appendChild(promptElem(file));
  view.appendChild(ul);
};


function prependQueueElem(file) {
  let li = document.createElement("li");
  li.id = `task-${file.hash}`;
  let icon = document.createElement("div");
  icon.className = "icon";
  setIconByMime(file.mime, icon);
  let info = document.createElement("div");
  info.className = "info";
  let name = document.createElement("p");
  name.innerHTML = file.name;
  let progress = document.createElement("div");
  progress.className = "progress";
  let bar = document.createElement("div");
  bar.className = "bar";
  bar.style.width = "0%";
  bar.id = `bar-${file.hash}`;
  bar.style.backgroundColor = COLOR_GREEN;
  progress.appendChild(bar);
  info.appendChild(name);
  info.appendChild(progress);
  let percentage = document.createElement("p");
  percentage.innerHTML = "0%";
  percentage.id = `percentage-${file.hash}`;
  li.appendChild(icon);
  li.appendChild(info);
  li.appendChild(percentage);
  tasksElem.appendChild(li);
  showRightNav();
}


function showRightNav() {
  if (navRight.style.display === "none") {
    blurLayer.style.display = "block";
    navRight.style.display = "flex";
  }
}

function closeRightNav() {
  blurLayer.style.display = "none";
  navRight.style.display = "none";
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
