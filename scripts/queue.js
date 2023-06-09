let taskCount = -1;

let taskNodes = {}

function prependQueueElem(file, isUpload = true) {
    let li = document.createElement('li');
    let icon = document.createElement('div');
    icon.className = 'icon';
    setIconByMime(file.mime, icon)
    if (isUpload === null) {
        icon.innerHTML = '<span class="material-symbols-rounded">open_in_browser</span>';
    }
    let info = document.createElement('div');
    info.className = 'info';
    let name = document.createElement('p');
    name.innerHTML = file.name;
    let progress = document.createElement('div');
    progress.className = 'progress';
    let bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.width = '0%';
    if (isUpload === null) {
        bar.style.backgroundColor = `#8cb4fc`;
    } else if (isUpload) {
        bar.style.backgroundColor = colorBlue;
    } else {
        bar.style.backgroundColor = colorGreen;
    }
    bar.id = `bar-${file.hash}`;
    progress.appendChild(bar);
    info.appendChild(name);
    info.appendChild(progress);
    let percentage = document.createElement('p');
    percentage.innerHTML = '0%';
    percentage.id = `percentage-${file.hash}`;
    li.appendChild(icon);
    li.appendChild(info);
    li.appendChild(percentage);
    taskNodes[file.hash] = {
        element: li, 
        index: taskCount + 1,
        bar: bar,
        percentage: percentage
    }
    taskCount++;
    renderQueue();
}

function renderQueue() {
    let queue = document.createElement('div');
    queue.className = 'queue';
    let close = document.createElement('div');
    close.className = 'queue_close';
    close.innerHTML = '<span class="material-symbols-rounded">chevron_right</span>';
    close.addEventListener('click', () => {
        hideRightNav();
    });
    let content = document.createElement('div');
    content.className = 'queue_content';
    let p = document.createElement('p');
    p.innerHTML = 'Tasks';
    let tasks = document.createElement('ul');
    let sortedNodes = Object.values(taskNodes).sort((a, b) => b.index - a.index);
    for (let node of sortedNodes) {
        tasks.appendChild(node.element);
    }
    content.appendChild(p);
    content.appendChild(tasks);
    queue.appendChild(close);
    queue.appendChild(content);
    renderInRightNav(queue);
}