// Description: Handles file uploads
function uploadNew(file) {
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
        showSnack(`Uploading ${file.name}`, colorBlue);
        prependQueueElem(body, true)
        let extension = file.name.split('.').pop();
        let saveAs = "";
        if (extension === file.name) {
            saveAs = `${hash}`;
        } else {
            saveAs = `${hash}.${extension}`;
        }
        let bar = document.getElementById(`bar-${hash}`);
        let percentageElem = document.getElementById(`percentage-${hash}`);
        if (file.size < 10 * 1024 * 1024) {
            fetch(`${ROOT}/${projectId}/filebox/files?name=${saveAs}`, {
                method: 'POST',
                headers: header,
                body: ev.target.result,
            })
            .then(() => {
                fetch("/api/metadata", {method: "POST", body: JSON.stringify(body)})
                .then(() => {
                    bar.style.width = "100%";
                    percentageElem.innerHTML = "";
                    showSnack(`Uploaded ${file.name}`);
                    if (globalContextFolder) {
                        handleFolderClick(globalContextFolder)
                    } else {
                        if (globalContextOption === "all-files" || globalContextOption === "home")
                        getContextOptionElem(globalContextOption).click();
                    }
                })
            })
        } else {
            fetch(`${ROOT}/${projectId}/filebox/uploads?name=${saveAs}`, {
                method: 'POST',
                headers: header
            })
            .then(response => response.json())
            .then(data => {
                let allOk = true;
                let promises = [];
                let name = data.name;
                let uploadId = data["upload_id"];
                let chunkSize = 10 * 1024 * 1024;
                let byteLenthDone = 0; 
                for (let i = 0; i < ev.target.result.byteLength; i += chunkSize) {
                    let chunk = ev.target.result.slice(i, i + chunkSize);
                    let index = (i / chunkSize);
                    promises.push(
                        fetch(`${ROOT}/${projectId}/filebox/uploads/${uploadId}/parts?name=${name}&part=${index+1}`, {
                            method: 'POST',
                            body: chunk,
                            headers: header
                        })
                        .then(response => {
                            if (response.status !== 200) {
                                allOk = false;
                            } else {
                                byteLenthDone += chunk.byteLength;
                            }
                            let percentage = Math.round((byteLenthDone / ev.target.result.byteLength) * 100);
                            bar.style.width = `${percentage}%`;
                            percentageElem.innerHTML = `${percentage}%`;
                        })
                    )
                }
                Promise.all(promises)
                .then(() => {
                    if (allOk) {
                        fetch(`${ROOT}/${projectId}/filebox/uploads/${uploadId}?name=${name}`, {
                            method: 'PATCH',
                            headers: header,
                        })
                        .then(response => response.json())
                        .then(() => {
                            fetch("/api/metadata", {method: "POST", body: JSON.stringify(body)})
                            .then(() => {
                                bar.style.width = "100%";
                                percentageElem.innerHTML = "✓";
                                updateSpaceUsage(file.size);
                                showSnack(`Uploaded ${file.name} successfully!`, colorBlue);
                                if (globalContextFolder) {
                                    handleFolderClick(globalContextFolder)
                                } else {
                                    if (globalContextOption === "all-files" || globalContextOption === "home")
                                    getContextOptionElem(globalContextOption).click();
                                }
                            })
                        })
                    } else {
                        showSnack(`Failed to upload ${file.name}`, colorRed);
                        document.getElementById(`${hash}`).remove();
                        fetch(`${ROOT}/${projectId}/filebox/uploads/${uploadId}?name=${name}`, {
                            method: 'DELETE', 
                            headers: header
                        })
                    }
                })
            })
        }
    };
    reader.readAsArrayBuffer(file);
}