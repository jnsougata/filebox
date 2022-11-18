let cardView = document.querySelector(".cards");
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
        cardView.appendChild(newFileChild(data));
        document.getElementById(`progress-${data.hash}`).style.display = "flex";
        progressBar = document.getElementById(`bar-${data.hash}`);
        showSnack("Download started", downloadGreen);
        downloadByChunk(data);
    })
}

function newFileChild(file) {
    let fileDiv = document.createElement("div");
    fileDiv.id = `file-${file.hash}`;
    fileDiv.className = "card";
    let iconDiv = document.createElement("div");
    iconDiv.className = "icon";
    let icon = document.createElement("i");
    if (file.type === "folder") {
        icon.className = "fa-solid fa-folder";
    } else {
        icon.className = handleMimeIcon(file.mime);
    }
    iconDiv.appendChild(icon);
    let detailsDiv = document.createElement("div");
    detailsDiv.className = "details";
    let fileName = document.createElement("p");
    fileName.innerHTML = file.name;
    let fileDetails = document.createElement("p");
    let d = new Date(file.date);
    let date = d.getDate()
        + "/" + (d.getMonth() + 1)
        + "/" + d.getFullYear()
        + " " + d.getHours()
        + ":" + d.getMinutes()
        + ":" + d.getSeconds();
    fileDetails.innerHTML = `
    <i class="fa-solid fa-database" style="margin-left: 0"></i> ${handleSizeUnit(file.size)}
    <i class="fa-solid fa-calendar"></i> ${date}
    `;
    let progressBar = document.createElement("div");
    progressBar.id = `progress-${file.hash}`;
    progressBar.className = "progress";
    let bar = document.createElement("div");
    bar.id = `bar-${file.hash}`;
    bar.className = "bar";
    progressBar.appendChild(bar);
    detailsDiv.appendChild(fileName);
    detailsDiv.appendChild(fileDetails);
    detailsDiv.appendChild(progressBar);
    fileDiv.appendChild(iconDiv);
    fileDiv.appendChild(detailsDiv);
    return fileDiv;
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
    progressBar.style.width = "0%";
    progressBar.style.backgroundColor = downloadGreen;
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
            } else {
                showSnack("File is very powerful. Please try again.", snackbarRed);
            }
        })
    }
}
