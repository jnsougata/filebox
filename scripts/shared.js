const MAIN = document.querySelector("main");
const SNACKBAR = document.querySelector(".snackbar");
const NAV_RIGHT = document.querySelector(".nav_right");
const NAV_LEFT = document.querySelector(".nav_left");
const BLUR_LAYER = document.querySelector(".blur_layer");
const TASKS = document.querySelector("#tasks");
const COLOR_GREEN = "#2AA850";


BLUR_LAYER.addEventListener("click", () => {
  closeRightNav();
  if( window.innerWidth < 768) {
    NAV_LEFT.style.display = "none";
  }
});

window.addEventListener("resize", () => {
  if( window.innerWidth < 768) {
    NAV_LEFT.style.display = "none";
  } else {
    NAV_LEFT.style.display = "flex";
  }
});



window.addEventListener("DOMContentLoaded", async () => {
  const hash = window.location.href.split("/").pop();
  const resp = await fetch(`/api/metadata/${hash}`);
  const file = await resp.json();
  let files = document.createElement("ul");
  files.appendChild(fileElem(file));
  MAIN.appendChild(files);
});


function fileElem(file) {
  let li = document.createElement("li");
  li.id = `file-${file.hash}`;
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
  fileSizeAndDate.innerHTML = `${handleSizeUnit(file.size)} • ${formatDateString(file.date)}`;
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
  download.style.fontSize = "18px";
  download.classList.add("material-symbols-rounded");
  download.innerText = "download";
  download.addEventListener("click", async () => {
    BLUR_LAYER.style.display = "block";
    NAV_RIGHT.style.display = "flex";
    progressEL.style.display = "block";
    download.style.display = "none";
    // keep it rotating until download is complete clock-wise
    let angle = 0;
    let interval = setInterval(() => {
      angle += 3;
      progressEL.style.transform = `rotate(${angle}deg)`;
    }, 10);

    let fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
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
      console.log(skips);
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
  li.appendChild(download);
  return li;
}

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
  TASKS.appendChild(li);
  showRightNav();
}


function showRightNav() {
  if (NAV_RIGHT.style.display === "none") {
    BLUR_LAYER.style.display = "block";
    NAV_RIGHT.style.display = "flex";
  }
}

function closeRightNav() {
  BLUR_LAYER.style.display = "none";
  NAV_RIGHT.style.display = "none";
}