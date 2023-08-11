async function partUploader(hash, index, content, totalSize, handler) {
  console.log(`Uploading part ${index} of ${hash}`);
  const resp = await fetch(`/api/upload/${hash}/${index}`, {
    method: "PUT",
    body: content,
  })
  handler()
  if (resp.status === 200) {
    updateSpaceUsage(content.byteLength)
    handler((content.byteLength / totalSize) * 100)
  }
}

async function chunkedUpload(file, metadata, progressHandler) {
  let hash = metadata.hash;
  const reader = new FileReader();
  reader.onload = async (ev) => {
    const content = ev.target.result;
    let chunks = [];
    let chunkSize = 2 * 1024 * 1024;
    for (let i = 0; i < content.byteLength; i += chunkSize) {
      chunks.push({
        index: i / chunkSize,
        content: content.slice(i, i + chunkSize)
      });
    }
    let allOk = true;
    let batchSize = 5;
    let batches = [];
    for (let i = 0; i < chunks.length; i += batchSize) {
      batches.push(chunks.slice(i, i + batchSize));
    }
    for (let i = 0; i < batches.length; i++) {
      let promises = [];
      let batch = batches[i];
      batch.forEach((chunk, _) => {
        promises.push(
          partUploader(hash, chunk.index, chunk.content, file.size, progressHandler)
        );
      });
      await Promise.all(promises);
    }
    if (allOk) {
      await fetch(`/api/metadata`, {
        method: "POST",
        body: JSON.stringify(metadata),
      });
      progressHandler(100);
      showSnack(`Uploaded ${file.name}`, COLOR_BLUE, "success");
      openedFolderGL
        ? handleFolderClick(openedFolderGL)
        : currentOption().click();
      hideRightNav();
    }
  };
  reader.readAsArrayBuffer(file);
}

function upload(file, metadata, progressHandler, refreshList = true) {
  let hash = metadata.hash;
  let header = { "X-Api-Key": secretKeyGL, "Content-Type": file.type };
  let projectId = secretKeyGL.split("_")[0];
  const ROOT = "https://drive.deta.sh/v1";
  let reader = new FileReader();
  reader.onload = async (ev) => {
    progressHandler(0);
    showSnack(`Uploading ${file.name}`, COLOR_BLUE, "info");
    let content = ev.target.result;
    let nameFragments = file.name.split(".");
    let saveAs =
      nameFragments.length > 1 ? `${hash}.${nameFragments.pop()}` : `${hash}`;
    const chunkSize = 10 * 1024 * 1024;
    if (file.size < chunkSize) {
      await fetch(`${ROOT}/${projectId}/filebox/files?name=${saveAs}`, {
        method: "POST",
        body: content,
        headers: header,
      });
      const resp = await fetch(`/api/metadata`, {
        method: "POST",
        body: JSON.stringify(metadata),
      });
      progressHandler(100);
      showSnack(`Uploaded ${file.name}`, COLOR_BLUE, "success");
      updateSpaceUsage(file.size);
      if (!refreshList) {
        return;
      }
      openedFolderGL
        ? handleFolderClick(openedFolderGL)
        : currentOption().click();
      hideRightNav();
    } else {
      const resp = await fetch(
        `${ROOT}/${projectId}/filebox/uploads?name=${saveAs}`,
        {
          method: "POST",
          headers: header,
        }
      );
      const data = await resp.json();
      let chunks = [];
      for (let i = 0; i < content.byteLength; i += chunkSize) {
        chunks.push({
          index: i / chunkSize,
          content: content.slice(i, i + chunkSize)
        });
      }
      let allOk = true;
      let batches = [];
      let name = data.name;
      let uploadId = data["upload_id"];
      const batchSize = 5;
      for (let i = 0; i < chunks.length; i += batchSize) {
        batches.push(chunks.slice(i, i + batchSize));
      }
      let progress = 0;
      async function uploadPart(chunk) {
        let resp = await fetch(
          `${ROOT}/${projectId}/filebox/uploads/${uploadId}/parts?name=${name}&part=${
            chunk.index + 1
          }`,
          {
            method: "POST",
            body: chunk.content,
            headers: header,
          }
        )
        if (resp.status !== 200) {
          allOk = false;
          return
        }
        progress += chunk.content.byteLength
        progressHandler(Math.round((progress / file.size) * 100));
      }
      for (let i = 0; i < batches.length; i++) {
        let promises = [];
        let batch = batches[i];
        batch.forEach((chunk, _) => {
          promises.push(uploadPart(chunk));
        });
        await Promise.all(promises);
      }
      if (allOk) {
        await fetch(
          `${ROOT}/${projectId}/filebox/uploads/${uploadId}?name=${name}`,
          {
            method: "PATCH",
            headers: header,
          }
        );
        progressHandler(100);
        await fetch(`/api/metadata`, {
          method: "POST",
          body: JSON.stringify(metadata),
        });
        progressHandler(100);
        showSnack(`Uploaded ${file.name}`, COLOR_BLUE, "success");
        updateSpaceUsage(file.size);
        if (!refreshList) {
          return;
        }
        openedFolderGL
          ? handleFolderClick(openedFolderGL)
          : currentOption().click();
        hideRightNav();
      } else {
        taskFactoryGL[hash].bar.style.backgroundColor = COLOR_RED;
        showSnack(`Failed to upload ${file.name}`, COLOR_RED, "error");
        await fetch(
          `${ROOT}/${projectId}/filebox/uploads/${uploadId}?name=${name}`,
          {
            method: "DELETE",
            headers: header,
          }
        );
      }
    }
  };
  reader.readAsArrayBuffer(file);
}

async function fetchFileFromDrive(file, progressHandler) {
  progressHandler(0);
  let header = { "X-Api-Key": secretKeyGL };
  let projectId = secretKeyGL.split("_")[0];
  const ROOT = "https://drive.deta.sh/v1";
  let extension = file.name.split(".").pop();
  let qualifiedName = file.hash + "." + extension;
  return fetch(
    `${ROOT}/${projectId}/filebox/files/download?name=${qualifiedName}`,
    {
      method: "GET",
      headers: header,
    }
  )
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
        },
      });
    })
    .then((stream) => new Response(stream))
    .then((response) => response.blob());
}

async function download(file, progressHandler) {
  showSnack(`Downloading ${file.name}`, COLOR_GREEN, "info");
  progressHandler(0);
  queueButton.click();
  let header = { "X-Api-Key": secretKeyGL };
  let projectId = secretKeyGL.split("_")[0];
  const ROOT = "https://drive.deta.sh/v1";
  let extension = file.name.split(".").pop();
  let qualifiedName = file.hash + "." + extension;
  let resp = await fetch(
    `${ROOT}/${projectId}/filebox/files/download?name=${qualifiedName}`,
    {
      method: "GET",
      headers: header,
    }
  );
  let progress = 0;
  const reader = resp.body.getReader();
  let stream = new ReadableStream({
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
    },
  });
  let blob = await new Response(stream).blob();
  let a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = file.name;
  showSnack(`Downloaded ${file.name}`, COLOR_GREEN, "success");
  hideRightNav();
  a.click();
}

function downloadShared(file, progressHandler) {
  showSnack(`Downloading ${file.name}`, COLOR_GREEN, "info");
  progressHandler(0);
  queueButton.click();
  let size = file.size;
  const chunkSize = 1024 * 1024 * 4;
  if (size < chunkSize) {
    fetch(`/api/external/${userIdGL}/${file.owner}/${file.hash}/0`)
      .then((resp) => resp.blob())
      .then((blob) => {
        let a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        progressHandler(100);
        showSnack(`Downloaded ${file.name}`, COLOR_GREEN, "success");
        hideRightNav();
        a.click();
      });
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
        fetch(`/api/external/${userIdGL}/${file.owner}/${file.hash}/${head}`)
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
    Promise.all(promises).then((blobs) => {
      progressHandler(100);
      let a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob(blobs, { type: file.mime }));
      a.download = file.name;
      showSnack(`Downloaded ${file.name}`, COLOR_GREEN, "success");
      hideRightNav();
      a.click();
    });
  }
}
