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
