function randId() {
    return [...Array(16)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
}

function buildFileMetadata(file) {
    let hash = randId();
    let meta = {
        "hash": hash,
        "name": file.name,
        "size": file.size,
        "mime": file.type,
        "access": "private",
        "date": new Date().toISOString(),
    }
    if (globalContextFolder) {
        meta.parent = globalContextFolder.parent ? `${globalContextFolder.parent}/${globalContextFolder.name}` : globalContextFolder.name;
    } else {
        meta.parent = null;
    }
    return meta;
}

function progressHandlerById(hash, percentage) {
    taskNodes[hash].percentage.innerHTML = `${percentage}%`;
    taskNodes[hash].bar.style.width = `${percentage}%`;
}

function createFolder() {
    let name = prompt("Enter folder name", "New Folder");
    if (name === "") {
        showSnack(`Folder name cannot be empty`, colorOrange, 'warning');
        return;
    }
    if (name === "~shared") {
        showSnack(`~shared is a reserved folder name`, colorOrange, 'warning');
        return;
    }
    if (name && name.includes("/")) {
        showSnack(`Folder name cannot contain /`, colorOrange, 'warning');
        return;
    }
    if (!name) {
        return;
    }
    let body = {
        "name": name,
        "type": "folder",
        "hash": randId(),
        "date": new Date().toISOString(),
        "parent": null,
    }
    if (globalContextFolder) {
        if (globalContextFolder.parent) {
            body.parent = `${globalContextFolder.parent}/${globalContextFolder.name}`;
        } else {
            body.parent = globalContextFolder.name;
        }
    }
    fetch(`/api/metadata`, {method: "POST", body: JSON.stringify(body)})
    .then((resp) => {
        if (resp.status === 409) {
            showSnack(`Folder with same name already exists`, colorRed, 'error');
        } else if (resp.status <= 207) {
            showSnack(`Created folder ${name}`, colorGreen, 'success');
            handleFolderClick(body);
        }
    })
}

function upload(file, metadata, progressHandler, refreshList = true) {
    let hash = metadata.hash;
    let header = {"X-Api-Key": globalSecretKey, "Content-Type": file.type}
    let projectId = globalSecretKey.split("_")[0];
    const ROOT = 'https://drive.deta.sh/v1';
    let reader = new FileReader();
    reader.onload = (ev) => {
        progressHandler(0);
        showSnack(`Uploading ${file.name}`, colorBlue, 'info');
        let content = ev.target.result;
        let nameFragments = file.name.split('.');
        let saveAs = nameFragments.length > 1 ? `${hash}.${nameFragments.pop()}` : `${hash}`;
        if (file.size < 10 * 1024 * 1024) {
            fetch(`${ROOT}/${projectId}/filebox/files?name=${saveAs}`, {
                method: 'POST',
                body: content,
                headers: header
            })
            .then(() => {
                fetch(`/api/metadata`, {method: "POST", body: JSON.stringify(metadata)})
                .then(() => {
                    progressHandler(100);
                    showSnack(`Uploaded ${file.name}`, colorBlue, 'success');
                    updateSpaceUsage(file.size);
                    if (!refreshList) {
                        return;
                    }
                    globalContextFolder ? handleFolderClick(globalContextFolder) : currentOption().click();
                    hideRightNav();
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
                            progressHandler(Math.round((progressIndex / finalIndex) * 100))
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
                            progressHandler(100);
                            fetch(`/api/metadata`, {method: "POST", body: JSON.stringify(metadata)})
                            .then(() => {
                                updateSpaceUsage(file.size);
                                showSnack(`Uploaded ${file.name} successfully`, colorBlue, 'success');
                                if (!refreshList) {
                                    return;
                                }
                                globalContextFolder ? handleFolderClick(globalContextFolder) : currentOption().click();
                                hideRightNav();
                            })
                        })
                    } else {
                        taskNodes[hash].bar.style.backgroundColor = colorRed;
                        showSnack(`Failed to upload ${file.name}`, colorRed, 'error');
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

async function fetchFileFromDrive(file, progressHandler) {
    progressHandler(0);
    let header = {"X-Api-Key": globalSecretKey}
    let projectId = globalSecretKey.split("_")[0];
    const ROOT = 'https://drive.deta.sh/v1';
    let extension = file.name.split('.').pop();
    let qualifiedName = file.hash + "." + extension;
    return fetch(`${ROOT}/${projectId}/filebox/files/download?name=${qualifiedName}`, {
        method: 'GET',
        headers: header
    })
    .then((response) => {
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
                        progressHandler(value.length);
                        return pump();
                    });
                }
            }
        })
    })
    .then((stream) => new Response(stream))
    .then((response) => response.blob())
}

function download(file, progressHandler) {
    showSnack(`Downloading ${file.name}`, colorGreen, 'info');
    progressHandler(0);
    queueButton.click();
    let header = {"X-Api-Key": globalSecretKey}
    let projectId = globalSecretKey.split("_")[0];
    const ROOT = 'https://drive.deta.sh/v1';
    let extension = file.name.split('.').pop();
    let qualifiedName = file.hash + "." + extension;
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
                        progressHandler(Math.round((progress / file.size) * 100));
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
        showSnack(`Downloaded ${file.name}`, colorGreen, 'success');
        hideRightNav();
        a.click();
    })
    .catch((err) => console.error(err));
}

function downloadShared(file, progressHandler) {
    showSnack(`Downloading ${file.name}`, colorGreen, 'info');
    progressHandler(0);
    queueButton.click();
    let size = file.size;
    const chunkSize = 1024 * 1024 * 4
    if (size < chunkSize) {
        fetch(`/api/external/${globalUserId}/${file.owner}/${file.hash}/0`)
        .then((resp) => resp.blob())
        .then((blob) => {
            let a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = file.name;
            progressHandler(100);
            showSnack(`Downloaded ${file.name}`, colorGreen, 'success');
            hideRightNav();
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
                    progressHandler(Math.round((progress / file.size) * 100));
                    return blob;
                }) 
            );
        });
        Promise.all(promises)
        .then((blobs) => {
            progressHandler(100);
            let a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob(blobs, {type: file.mime}));
            a.download = file.name;
            showSnack(`Downloaded ${file.name}`, colorGreen, 'success');
            hideRightNav();
            a.click();
        })
    }
}

async function buildChildrenTree(folder) {
    let node = [];
    let resp = await fetch(`/api/query`, {
        method: "POST", 
        body: JSON.stringify({
            "deleted?ne": true,
            "shared?ne": true,
            "parent": folder.parent ? `${folder.parent}/${folder.name}` : folder.name,
        })}
    )
    let children = await resp.json();
    if (!children) {
        return {tree: node, hash: folder.hash};
    }
    let promises = [];
    children.forEach((child) => {
        if (child.type === "folder") {
            promises.push(buildChildrenTree(child));
            node.push(child);
        } else {
            node.push(child);
        }
    });
    let childrenTree = await Promise.all(promises);
    childrenTree.forEach((childTree) => {
        node.forEach((child) => {
            if (child.hash === childTree.hash) {
                child.children = childTree.tree;
            }
        });
    });
    return {tree: node, hash: folder.hash};
}

function caculateTreeSize(tree) {
    let size = 0;
    tree.forEach((child) => {
        if (child.type === "folder") {
            size += caculateTreeSize(child.children);
        } else {
            size += child.size;
        }
    });
    return size;
}

async function zipFolderRecursive(tree, hash, zip, done, totalSize) {
    let promises = [];
    let recursions = [];
    tree.forEach((child) => {
        if (child.type === "folder") {
            let folder = zip.folder(child.name);
            if (child.children.length > 0) {
                recursions.push(zipFolderRecursive(child.children, hash, folder, done, totalSize));
            }
        } else {
            promises.push(fetchFileFromDrive(child, (progress) => {
                done += progress;
                let percentage = Math.round((done / totalSize) * 100);
                progressHandlerById(hash, percentage);
            }));
        }
    });
    await Promise.all(recursions);
    let blobs = await Promise.all(promises);
    blobs.forEach((blob, index) => {
        zip.file(tree[index].name, blob);
    });
    progressHandlerById(hash, 100);
    return zip;
}