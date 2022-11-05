let fileView = document.getElementById('files');
let snackbar = document.getElementById("snackbar");
let progressBar = null;
const downloadGreen = "#25a03d";
const snackbarGreen = "rgba(37, 172, 80)";
const snackbarRed = "rgba(203, 20, 70)";


window.onload = function() {
    let hash = window.location.href.split("/").pop();
    fetch(`/api/shared/metadata/${hash}`)
    .then(res => res.json())
    .then(data => {
        fileView.appendChild(newFileRow(data));
        progressBar = document.getElementById(`bar-${hash}`);
    })
}


function newFileRow(file) {
    let card = document.createElement("div");
    card.id = `card-${file.hash}`;
    card.className = "card";
    let icon = document.createElement("div");
    icon.className = "icon";
    let i = document.createElement("i");
    i.className = handleMimeIcon(file.mime);
    icon.appendChild(i);
    let details = document.createElement("div");
    details.className = "details";
    let name = document.createElement("span");
    name.innerHTML = file.name;
    let size = document.createElement("span");
    size.innerHTML = handleSizeUnit(file.size);
    let date = document.createElement("span");
    let d = new Date(file.date);
    date.innerText = d.getDate()
        + "/" + (d.getMonth() + 1)
        + "/" + d.getFullYear()
        + " " + d.getHours()
        + ":" + d.getMinutes()
        + ":" + d.getSeconds();
    details.appendChild(name);
    details.appendChild(size);
    details.appendChild(date);
    let operations = document.createElement("div");
    operations.className = "operations";
    let deleteButton = document.createElement("button");
    deleteButton.innerHTML = `<i class="fa-solid fa-trash"></i>`;
    deleteButton.onclick = () => {
        showSnack("Shared file cannot be deleted", snackbarRed);
    }
    let shareButton = document.createElement("button");
    shareButton.innerHTML = `<i class="fa-solid fa-share"></i>`;
    shareButton.onclick = () => {
        navigator.clipboard.writeText(window.location.href)
        .then(() => {
            showSnack("URL copied to clipboard");
        })
    }
    let downloadButton = document.createElement("button");
    downloadButton.innerHTML = `<i class="fa-solid fa-download"></i>`;
    downloadButton.onclick = () => {
        downloadByChunk(file);
    }
    operations.appendChild(deleteButton);
    operations.appendChild(shareButton);
    operations.appendChild(downloadButton);
    let progress = document.createElement("div");
    progress.className = "progress";
    progress.id = `progress-${file.hash}`;
    let bar = document.createElement("div");
    bar.className = "bar";
    bar.id = `bar-${file.hash}`;
    progress.appendChild(bar);
    card.appendChild(icon);
    card.appendChild(details);
    card.appendChild(operations);
    card.appendChild(progress);
    return card;
}


function handleMimeIcon(mime) {
    if (mime.startsWith("image")) {
        return "fa-solid fa-image";
    } else if (mime.startsWith("video")) {
        return "fa-solid fa-video";
    } else if (mime.startsWith("audio")) {
        return "fa-solid fa-headphones";
    } else if (mime.startsWith("text")) {
        return  "fa-solid fa-file-lines";
    } else if (mime.startsWith("application/pdf")) {
        return "fa-solid fa-file-pdf";
    } else if (mime.startsWith("application/zip")) {
        return "fa-solid fa-file-zipper";
    } else {
        return "fa-solid fa-file";
    }
}

function handleSizeUnit(size) {
    if (size < 1024) {
        return size + " B";
    } else if (size < 1024 * 1024) {
        return (size / 1024).toFixed(4) + " KB";
    } else if (size < 1024 * 1024 * 1024) {
        return (size / 1024 / 1024).toFixed(4) + " MB";
    } else {
        return (size / 1024 / 1024 / 1024).toFixed(4) + " GB";
    }
}

function showSnack(inner, color = snackbarGreen) {
    snackbar.style.backgroundColor = color;
    snackbar.innerHTML = inner;
    snackbar.style.visibility = "visible";
    setTimeout(() => {
        snackbar.style.visibility = "hidden";
    }, 3000);
}


function downloadByChunk(file) {
    let size = file.size;
    let name = file.name;
    let extension = name.split('.').pop();
    const chunkSize = 1024 * 1024 * 4
    snackbar.style.backgroundColor = snackbarGreen;
    showSnack(`Downloading ${name}`);
    let hashedName = file.hash + "." + extension;
    renderBarMatrix(file.hash, downloadGreen);
    if (size < chunkSize) {
        fetch(`/api/shared/chunk/0/${hashedName}`)
        .then(response => response.blob())
        .then(blob => {
            let url = URL.createObjectURL(blob);
            let a = document.createElement('a');
            a.href = url;
            a.download = name;
            a.click();
            showSnack(`Downloaded ${name}`);
            hideBarMatrix(file.hash);
        })
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
        let allOk = true;
        heads.forEach((head) => {
            promises.push(
                fetch(`/api/shared/chunk/${head}/${hashedName}`)
                .then(response => {
                     if (response.status === 502) {
                         showSnack(`Server refused to deliver chunk ${head}`, snackbarRed);
                         allOk = false;
                     }
                     progress++;
                     progressBar.style.width = (progress / skips * 100) + "%";
                     return response.blob();
                })
                .then(blob => {
                    return blob;
                })
            );
        });
        Promise.all(promises)
        .then(blobs => {
            let blob = new Blob(blobs, {type: file.mime});
            let url = URL.createObjectURL(blob);
            let a = document.createElement('a');
            a.href = url;
            a.download = name;
            if (allOk) {
                a.click();
                progressBar.style.width = "100%";
                progress = 0;
                setTimeout(() => {
                    hideBarMatrix(file.hash);
                    showSnack(`Downloaded... ${name}`);
                }, 500);
            } else {
                showSnack("File is very powerful. Please try again.", snackbarRed);
                hideBarMatrix(file.hash);
                progress = 0;
            }
        })
    }
}

function renderBarMatrix(hash, color) {
    let progressBar = document.getElementById(`progress-${hash}`);
    progressBar.style.visibility = "visible";
    let bar = document.getElementById(`bar-${hash}`);
    bar.style.backgroundColor = color;
}

function hideBarMatrix(hash) {
    let progressBar = document.getElementById(`progress-${hash}`);
    progressBar.style.visibility = "hidden";
    let bar = document.getElementById(`bar-${hash}`);
    bar.style.width = "0%";
}