function randId() {
    return [...Array(16)].map(
        () => Math.floor(Math.random() * 16).toString(16)
    ).join('');
}

function closeQueue() {
    if (runningTaskCount === 0) {
        queueModalCloseButton.click();
    }
}

function upload(file) {
    let header = {"X-Api-Key": globalSecretKey, "Content-Type": file.type}
    let hash = randId();
    let projectId = globalSecretKey.split("_")[0];
    const ROOT = 'https://drive.deta.sh/v1';
    let reader = new FileReader();
    reader.onload = (ev) => {
        let body = {
            "hash": hash,
            "name": file.name,
            "size": file.size,
            "mime": file.type,
            "access": "private",
            "date": new Date().toISOString(),
        }
        if (globalContextFolder) {
            if (globalContextFolder.parent) {
                body.parent = `${globalContextFolder.parent}/${globalContextFolder.name}`;
            } else {
                body.parent = globalContextFolder.name;
            }
        }
        showSnack(`Uploading ${file.name}`, colorBlue, 'info');
        let content = ev.target.result;
        prependQueueElem(body, true)
        runningTaskCount ++;
        let nameFragments = file.name.split('.');
        let saveAs = "";
        if (nameFragments.length > 1) {
            saveAs = `${hash}.${nameFragments.pop()}`;
        } else {
            saveAs = `${hash}`;
        }
        let bar = document.getElementById(`bar-${hash}`);
        let percentageElem = document.getElementById(`percentage-${hash}`);
        if (file.size < 10 * 1024 * 1024) {
            fetch(`${ROOT}/${projectId}/filebox/files?name=${saveAs}`, {
                method: 'POST',
                body: content,
                headers: header
            })
            .then(() => {
                fetch(`/api/metadata/${globalUserPassword}`, {method: "POST", body: JSON.stringify(body)})
                .then(() => {
                    bar.style.width = "100%";
                    percentageElem.innerHTML = "✓";
                    showSnack(`Uploaded ${file.name}`, colorBlue, 'success');
                    if (globalContextFolder) {
                        handleFolderClick(globalContextFolder)
                    } else {
                        getContextOptionElem().click();
                    }
                    updateSpaceUsage(file.size);
                    runningTaskCount --;
                    closeQueue();
                })
            })
        } else {
            fetch(`${ROOT}/${projectId}/filebox/uploads?name=${saveAs}`, {method: 'POST', headers: header})
            .then(response => response.json())
            .then(data => {
                let chunks = [];
                let chunkSize = 10 * 1024 * 1024;
                for (let i = 0; i < content.byteLength; i += chunkSize) {
                    chunks.push(content.slice(i, i + chunkSize));
                }
                let allOk = true;
                let promises = [];
                let progressIndex = 0;
                let name = data.name;
                let uploadId = data["upload_id"];
                let finalIndex = chunks.length + 1;
                chunks.forEach((chunk, index) => {
                    promises.push(
                        fetch(`${ROOT}/${projectId}/filebox/uploads/${uploadId}/parts?name=${name}&part=${index+1}`, {
                            method: 'POST',
                            body: chunk,
                            headers: header
                        }).then(response => {
                            if (response.status !== 200) {
                                allOk = false;
                            }
                            progressIndex ++;
                            let percentage = Math.round((progressIndex / finalIndex) * 100);
                            bar.style.width = `${percentage}%`;
                            percentageElem.innerHTML = `${percentage}%`;
                        })
                    )
                })
                Promise.all(promises)
                .then(() => {
                    if (allOk) {
                        fetch(`${ROOT}/${projectId}/filebox/uploads/${uploadId}?name=${name}`, {
                            method: 'PATCH',
                            headers: header,
                        })
                        .then(response => response.json())
                        .then(() => {
                            fetch(`/api/metadata/${globalUserPassword}`, {method: "POST", body: JSON.stringify(body)})
                            .then(() => {
                                bar.style.width = "100%";
                                percentageElem.innerHTML = "✓";
                                updateSpaceUsage(file.size);
                                showSnack(`Uploaded ${file.name} successfully!`, colorBlue, 'success');
                                if (globalContextFolder) {
                                    handleFolderClick(globalContextFolder)
                                } else {
                                    getContextOptionElem().click();
                                }
                            })
                        })
                    } else {
                        showSnack(`Failed to upload ${file.name}`, colorRed, 'error');
                        bar.style.width = "100%";
                        percentageElem.innerHTML = "✕";
                        bar.style.backgroundColor = colorRed;
                        fetch(`${ROOT}/${projectId}/filebox/uploads/${uploadId}?name=${name}`, {
                            method: 'DELETE', 
                            headers: header
                        })
                    }
                    runningTaskCount--;
                    closeQueue();
                })
            })
        }
    };
    reader.readAsArrayBuffer(file);
}

function download(file) {
    showSnack(`Downloading ${file.name}`, colorGreen, 'info');
    prependQueueElem(file, false);
    runningTaskCount ++;
    queueButton.click();
    let header = {"X-Api-Key": globalSecretKey}
    let projectId = globalSecretKey.split("_")[0];
    const ROOT = 'https://drive.deta.sh/v1';
    let extension = file.name.split('.').pop();
    let qualifiedName = file.hash + "." + extension;
    let bar = document.getElementById(`bar-${file.hash}`);
    let percentageElem = document.getElementById(`percentage-${file.hash}`);
    fetch(`${ROOT}/${projectId}/filebox/files/download?name=${qualifiedName}`, {
        method: 'GET',
        headers: header
    })
    .then((response) => {
        let progress = 0;
        const reader = response.body.getReader();
        return new ReadableStream({
            start(controller) {
                return pump();
                function pump() {
                    return reader.read().then(({ done, value }) => {
                        if (done) {
                            controller.close();
                            return;
                        }
                        controller.enqueue(value);
                        progress += value.length;
                        let percentage = Math.round((progress / file.size) * 100);
                        bar.style.width = `${percentage}%`;
                        percentageElem.innerHTML = `${percentage}%`;
                        return pump();
                    });
                }
            }
        })
    })
    .then((stream) => new Response(stream))
    .then((response) => response.blob())
    .then((blob) => URL.createObjectURL(blob))
    .then((url) => {
        let a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        bar.style.width = "100%";
        percentageElem.innerHTML = "100%";
        showSnack(`Downloaded ${file.name}`, colorGreen, 'success');
        runningTaskCount --;
        closeQueue();
        a.click();
    })
    .catch((err) => console.error(err));
}

function createFolder() {
    let name = prompt("Enter folder name", "New Folder");
    if (name === "~shared") {
        showSnack(`~shared is a reserved folder name`, colorOrange, 'warning');
        return;
    }
    if (name) {
        let body = {
            "name": name,
            "type": "folder",
            "hash": randId(),
            "date": new Date().toISOString(),
        }
        if (globalContextFolder) {
            if (globalContextFolder.parent) {
                body.parent = `${globalContextFolder.parent}/${globalContextFolder.name}`;
            } else {
                body.parent = globalContextFolder.name;
            }
        }
        fetch(`/api/metadata/${globalUserPassword}`, {method: "POST", body: JSON.stringify(body)})
        .then((resp) => {
            if (resp.status === 409) {
                showSnack(`Folder with same name already exists`, colorRed, 'error');
            } else if (resp.status <= 207) {
                showSnack(`Created folder ${name}`, colorGreen, 'success');
                if (body.parent) {
                    handleFolderClick(globalContextFolder);
                } else {
                    browseButton.click();
                }
            }
        })
    }
}

function downloadShared(file) {
    showSnack(`Downloading ${file.name}`, colorGreen, 'info');
    prependQueueElem(file, false);
    runningTaskCount++;
    queueButton.click();
    let bar = document.getElementById(`bar-${file.hash}`);
    let percentageElem = document.getElementById(`percentage-${file.hash}`);
    let size = file.size;
    const chunkSize = 1024 * 1024 * 4
    if (size < chunkSize) {
        fetch(`/api/external/${globalUserId}/${file.owner}/${file.hash}/0`)
        .then((resp) => resp.blob())
        .then((blob) => {
            let a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = file.name;
            bar.style.width = "100%";
            percentageElem.innerHTML = "100%";
            showSnack(`Downloaded ${file.name}`, colorGreen, 'success');
            runningTaskCount --;
            closeQueue();
            a.click();
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
        heads.forEach((head) => {
            promises.push(
                fetch(`/api/external/${globalUserId}/${file.owner}/${file.hash}/${head}`)
                .then((resp) => {
                    return resp.blob();
                })
                .then((blob) => {
                    progress += blob.size;
                    let percentage = Math.round((progress / file.size) * 100);
                    bar.style.width = `${percentage}%`;
                    percentageElem.innerHTML = `${percentage}%`;
                    return blob;
                }) 
            );
        });
        Promise.all(promises)
        .then((blobs) => {
            let a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob(blobs, {type: file.mime}));
            a.download = file.name;
            bar.style.width = "100%";
            percentageElem.innerHTML = "100%";
            showSnack(`Downloaded ${file.name}`, colorGreen, 'success');
            runningTaskCount --;
            closeQueue();
            a.click();
        })
    }
}