let isTaskRunning = false;
let progressBar = document.querySelector(".progress");
let fileNameElem = document.querySelector("#filename");
let downloadButton = document.querySelector("#download");
let footer = document.querySelector("footer");
let percentage = document.querySelector("#percentage");
let fileInfo = null;


window.onload = function() {
    let hash = window.location.href.split("/").pop();
    fetch(`/api/shared/metadata/${hash}`)
    .then(res => res.json())
    .then(data => {
        fileNameElem.innerHTML = data.name;
        fileInfo = data;
    })
}

downloadButton.addEventListener('click', () => {
    if (!isTaskRunning) {
        footer.style.display = "none";
        progressBar.style.width = "0%";
        downloadByChunk(fileInfo);
    }
});

function downloadByChunk(file) {
    isTaskRunning = true;
    percentage.innerHTML = `Downloaded 0.00%`;
    footer.style.display = "block";
    let size = file.size;
    let name = file.name;
    let extension = name.split('.').pop();
    const chunkSize = 1024 * 1024 * 4
    let hashedName = file.hash + "." + extension;
    if (size < chunkSize) {
        fetch(`/api/shared/chunk/0/${hashedName}`)
        .then((response) => {
            if (response.status === 403) {
                alert(`File access denied by owner!`);
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
                fetch(`/api/shared/chunk/${head}/${hashedName}`)
                .then(response => {
                    if (response.status === 403) {
                        alert(`File access denied by owner!`);
                        allOk = false;
                    } else
                    if (response.status === 502) {
                        alert(`Server refused to deliver chunk ${head}`);
                        allOk = false;
                    }
                    progress++;
                    progressBar.style.width = `${(progress / skips * 100)}%`;
                    percentage.innerHTML = `Downloaded ${(progress / skips * 100).toFixed(2)}%`;
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
                percentage.innerHTML = `Downloaded 100%`;
                isTaskRunning = false;
            } else {
                isTaskRunning = false;
                alert("File is very powerful. Please try again.");
            }
        })
    }
}
