let fileInfo = null;
let isTaskRunning = false;
let progressBar = document.querySelector(".progress");
let fileNameElem = document.querySelector("#filename");
let downloadButton = document.querySelector("#download");
let footer = document.querySelector("footer");
let percentage = document.querySelector("#percentage");
let fileSizeBar = document.querySelector("#size");


window.addEventListener('DOMContentLoaded', async () => {
    let hash = window.location.href.split("/").pop();
    let resp = await fetch(`/api/file/metadata/${hash}`)
    fileInfo = await resp.json();
    fileNameElem.innerHTML = fileInfo.name;
});

downloadButton.addEventListener('click', () => {
    if (!isTaskRunning) {
        footer.style.display = "none";
        progressBar.style.width = "0%";
        downloadByChunk(fileInfo);
    }
});

function downloadByChunk(file) {
    isTaskRunning = true;
    footer.style.display = "block";
    percentage.innerHTML = `Downloaded 0.00%`;
    let size = file.size;
    let fileSizeMB = (size / (1024 * 1024)).toFixed(2);
    fileSizeBar.innerHTML = `0.00 / ${fileSizeMB} MB`;
    let name = file.name;
    const chunkSize = 1024 * 1024 * 4
    if (size < chunkSize) {
        fetch(`/api/file/na/${file.hash}/0`)
        .then((response) => {
            if (response.status === 403) {
                alert(`File access denied by owner!`);
                return;
            } else {
                return response.blob();
            }
        })
        .then(blob => {
            let url = URL.createObjectURL(blob);
            let a = document.createElement('a');
            a.href = url;
            a.download = name;
            percentage.innerHTML = `Downloaded 100%`;
            progressBar.style.width = "100%";
            fileSizeBar.innerHTML = `${fileSizeMB} / ${fileSizeMB} MB`;
            a.click();
            isTaskRunning = false;
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
                fetch(`/api/file/na/${file.hash}/${head}`)
                .then(response => {
                    if (response.status === 403) {
                        alert(`File access denied by owner!`);
                        allOk = false;
                    } else
                    if (response.status === 502) {
                        alert(`Server refused to deliver chunk ${head}, try again!`);
                        allOk = false;
                    }
                    return response.blob();
                })
                .then(blob => {
                    progress++;
                    progressBar.style.width = `${((progress / skips) * 100)}%`;
                    percentage.innerHTML = `Downloaded ${((progress / skips) * 100).toFixed(2)}%`;
                    fileSizeBar.innerHTML = `${(progress * chunkSize / (1024 * 1024)).toFixed(2)} / ${fileSizeMB} MB`;
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
                percentage.innerHTML = `Downloaded 100%`;
                fileSizeBar.innerHTML = `${fileSizeMB} / ${fileSizeMB} MB`;
            } else {
                alert("File is very powerful. Please try again.");
            }
            isTaskRunning = false;
        })
    }
}
