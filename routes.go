package main

import (
	"backend/deta"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

var detaProjectKey = os.Getenv("DETA_PROJECT_KEY")
var con = deta.New(detaProjectKey)
var drive = con.Drive("filebox")
var base = con.Base("filebox_metadata")

func Ping(c *gin.Context) {
	c.String(http.StatusOK, "pong")
}

func SharedPage(c *gin.Context) {
	hash := c.Param("hash")
	metadata := base.Get(hash).JSON()
	_, ok := metadata["hash"].(string)
	if !ok {
		c.String(http.StatusNotFound, "Not Found")
		return
	}
	access, _ := metadata["access"].(string)
	if access == "private" {
		c.String(http.StatusForbidden, "Forbidden")
		return
	}
	c.File("static/shared.html")
}

func Action(c *gin.Context) {
	data := drive.Files("", 0, "").JSON()
	names := data["names"].([]interface{})
	hashes := map[string]string{}
	for _, name := range names {
		fragments := strings.Split(name.(string), ".")
		if len(fragments) > 1 {
			hashes[fragments[0]] = name.(string)
		} else {
			hashes[name.(string)] = name.(string)
		}
	}
	var orphanNames []string
	for k, v := range hashes {
		resp := base.Get(k).JSON()
		_, ok := resp["hash"]
		if !ok {
			orphanNames = append(orphanNames, v)
		}
	}
	r := drive.Delete(orphanNames...)
	c.JSON(r.StatusCode, r.JSON())
}

func ProjectKey(c *gin.Context) {
	c.JSON(http.StatusOK, map[string]interface{}{"key": detaProjectKey})
}

func Root(c *gin.Context) {
	q := deta.NewQuery()
	q.NotEquals("deleted", true)
	resp := base.FetchUntilEnd(q)
	items := resp.ArrayJSON()
	if items == nil {
		c.JSON(http.StatusOK, nil)
		return
	}
	var root []map[string]interface{}
	for _, item := range items {
		if _, ok := item["parent"]; !ok {
			root = append(root, item)
		}
	}
	c.JSON(http.StatusOK, root)
}

func Metadata(c *gin.Context) {
	switch c.Request.Method {
	case "GET":
		q := deta.NewQuery()
		q.NotEquals("deleted", true)
		resp := base.FetchUntilEnd(q)
		items := resp.ArrayJSON()
		c.JSON(http.StatusOK, items)
		return

	case "POST":
		var data map[string]interface{}
		_ = json.NewDecoder(c.Request.Body).Decode(&data)
		key := data["hash"].(string)
		data["key"] = key
		_, hasPrent := data["parent"]
		_, isFolder := data["type"]
		if !hasPrent && isFolder {
			q := deta.NewQuery()
			q.Equals("name", data["name"].(string))
			resp := base.FetchUntilEnd(q).ArrayJSON()
			var tmp []map[string]interface{}
			for _, item := range resp {
				if _, ok := item["parent"]; !ok {
					tmp = append(tmp, item)
				}
			}
			if len(tmp) > 0 {
				c.JSON(http.StatusConflict, nil)
				return
			}
		}
		if hasPrent && isFolder {
			q := deta.NewQuery()
			q.Equals("parent", data["parent"].(string))
			q.Equals("name", data["name"].(string))
			resp := base.FetchUntilEnd(q).ArrayJSON()
			if len(resp) > 0 {
				c.JSON(http.StatusConflict, nil)
				return
			}
		}
		resp := base.Put(deta.Record{Key: key, Value: data})
		c.JSON(resp.StatusCode, resp.JSON())
		return

	case "PATCH":
		var data map[string]interface{}
		_ = json.NewDecoder(c.Request.Body).Decode(&data)
		key := data["hash"].(string)
		data["key"] = key
		resp := base.Put(deta.Record{Key: key, Value: data})
		c.JSON(resp.StatusCode, resp.JSON())
		return

	case "DELETE":
		metadata, _ := io.ReadAll(c.Request.Body)
		var file map[string]interface{}
		_ = json.Unmarshal(metadata, &file)
		_, isFolder := file["type"]
		if isFolder {
			var childrenPath string
			_, hasParent := file["parent"]
			if hasParent {
				childrenPath = fmt.Sprintf("%s/%s", file["parent"].(string), file["name"].(string))
			} else {
				childrenPath = file["name"].(string)
			}
			q := deta.NewQuery()
			q.Equals("parent", childrenPath)
			q.NotEquals("deleted", true)
			resp := base.FetchUntilEnd(q)
			children := resp.ArrayJSON()
			if len(children) > 0 {
				c.JSON(http.StatusConflict, nil)
			} else {
				_ = base.Delete(file["hash"].(string))
				c.JSON(http.StatusOK, nil)
			}
		}
		hash := file["hash"].(string)
		_ = base.Delete(hash)
		_ = drive.Delete(FileToDriveSavedName(file))
		c.JSON(http.StatusOK, nil)
		return

	default:
		c.JSON(http.StatusMethodNotAllowed, nil)
		return
	}
}

func ExtraFolderMeta(c *gin.Context) {
	var body map[string]interface{}
	_ = json.NewDecoder(c.Request.Body).Decode(&body)
	parent := body["parent"].(string)
	q := deta.NewQuery()
	q.Equals("parent", parent)
	resp := base.Fetch(q).ArrayJSON()
	c.JSON(http.StatusOK, resp)
}

func EmbedFile(c *gin.Context) {
	hash := c.Param("hash")
	resp := base.Get(hash)
	metadata := resp.JSON()
	access, ok := metadata["access"]
	if ok && access.(string) == "private" {
		c.String(http.StatusForbidden, "Unauthorized")
	}
	isDeleted, ok := metadata["deleted"]
	if ok && isDeleted.(bool) {
		c.String(http.StatusNotFound, "File not found")
		return
	}
	if metadata["size"].(float64) > 5*1024*1024 {
		c.String(http.StatusForbidden, "File too large")
		return
	}
	fileName := metadata["name"].(string)
	mime := metadata["mime"].(string)
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=%s", fileName))
	streamingResp := drive.Get(FileToDriveSavedName(metadata))
	c.Data(http.StatusOK, mime, streamingResp.Bytes)
}

func DownloadFile(c *gin.Context) {
	hash := c.Param("hash")
	part := c.Param("part")
	recipient := c.Param("recipient")
	resp := base.Get(hash)
	metadata := resp.JSON()
	if recipient == "na" {
		access, ok := metadata["access"]
		if ok && access.(string) == "private" {
			c.String(http.StatusForbidden, "Unauthorized")
			return
		}
	} else {
		recipients, ok := metadata["recipients"]
		if !ok {
			c.String(http.StatusForbidden, "Unauthorized")
			return
		}
		recipientsList := recipients.([]interface{})
		found := false
		for _, rec := range recipientsList {
			if rec.(string) == recipient {
				found = true
				break
			}
		}
		if !found {
			c.String(http.StatusForbidden, "Unauthorized")
			return
		}
	}
	skip, _ := strconv.Atoi(part)
	ProjectId := strings.Split(detaProjectKey, "_")[0]
	url := fmt.Sprintf(
		"https://drive.deta.sh/v1/%s/filebox/files/download?name=%s",
		ProjectId,
		FileToDriveSavedName(metadata),
	)
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("X-API-Key", detaProjectKey)
	if (skip+1)*4*1024*1024 > int(metadata["size"].(float64)) {
		req.Header.Set("Range", fmt.Sprintf("bytes=%d-", skip*4*1024*1024))
	} else {
		req.Header.Set("Range", fmt.Sprintf("bytes=%d-%d", skip*4*1024*1024, (skip+1)*4*1024*1024-1))
	}
	client := &http.Client{}
	fResp, _ := client.Do(req)
	data, _ := io.ReadAll(fResp.Body)
	c.Data(http.StatusOK, "application/octet-stream", data)
}

func SharedMeta(c *gin.Context) {
	hash := c.Param("hash")
	resp := base.Get(hash)
	data := resp.JSON()
	delete(data, "key")
	delete(data, "deleted")
	delete(data, "recipients")
	delete(data, "access")
	delete(data, "parent")
	delete(data, "project_id")
	c.JSON(http.StatusOK, data)
}

func Query(c *gin.Context) {
	var body map[string]interface{}
	_ = json.NewDecoder(c.Request.Body).Decode(&body)
	q := deta.NewQuery()
	for k, v := range body {
		q.Equals(k, v)
	}
	resp := base.FetchUntilEnd(q).ArrayJSON()
	c.JSON(http.StatusOK, resp)
}

func Rename(c *gin.Context) {
	var body map[string]interface{}
	_ = json.NewDecoder(c.Request.Body).Decode(&body)
	u := deta.NewUpdater(body["hash"].(string))
	u.Set("name", body["name"].(string))
	resp := base.Update(u)
	c.JSON(resp.StatusCode, resp)
}

func Consumption(c *gin.Context) {
	q := deta.NewQuery()
	q.NotEquals("type", "folder")
	q.NotEquals("shared", true)
	resp := base.FetchUntilEnd(q)
	size := 0
	files := resp.ArrayJSON()
	for _, file := range files {
		size += int(file["size"].(float64))
	}
	c.JSON(http.StatusOK, map[string]interface{}{"size": size})
}

func Bookmark(c *gin.Context) {
	hash := c.Param("hash")
	switch c.Request.Method {
	case "POST":
		updater := deta.NewUpdater(hash)
		updater.Set("pinned", true)
		resp := base.Update(updater)
		c.JSON(resp.StatusCode, resp.JSON())
		return

	case "DELETE":
		updater := deta.NewUpdater(hash)
		updater.Delete("pinned")
		resp := base.Update(updater)
		c.JSON(resp.StatusCode, resp.JSON())
		return

	default:
		c.String(http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
}

func Access(c *gin.Context) {
	var body map[string]interface{}
	_ = json.NewDecoder(c.Request.Body).Decode(&body)
	updater := deta.NewUpdater(body["hash"].(string))
	updater.Set("access", body["access"].(string))
	resp := base.Update(updater)
	c.JSON(resp.StatusCode, resp.JSON())
}

func FolderItemCountBulk(c *gin.Context) {
	var folders []map[string]interface{}
	_ = json.NewDecoder(c.Request.Body).Decode(&folders)
	parentMap := map[string]interface{}{}
	for _, folder := range folders {
		parentMap[FolderToAsParentPath(folder)] = map[string]interface{}{
			"hash":  folder["hash"],
			"count": 0,
		}
	}
	q := deta.NewQuery()
	q.Value = []map[string]interface{}{}
	var queries []deta.Query
	for parentPath := range parentMap {
		nq := deta.NewQuery()
		nq.Equals("parent", parentPath)
		nq.NotEquals("deleted", true)
		queries = append(queries, *nq)
	}
	q.Union(queries...)
	resp := base.FetchUntilEnd(q)
	items := resp.ArrayJSON()
	for _, item := range items {
		path := item["parent"].(string)
		record, ok := parentMap[path]
		if ok {
			parentMap[path].(map[string]interface{})["count"] = record.(map[string]interface{})["count"].(int) + 1
		}
	}
	var counts []interface{}
	for _, v := range parentMap {
		counts = append(counts, v.(map[string]interface{}))
	}
	c.JSON(resp.StatusCode, counts)
}

func FileBulkOps(c *gin.Context) {
	switch c.Request.Method {
	case "DELETE":
		var body []map[string]interface{}
		_ = json.NewDecoder(c.Request.Body).Decode(&body)
		var hashes []string
		var driveNames []string
		for _, item := range body {
			hashes = append(hashes, item["hash"].(string))
			driveNames = append(driveNames, FileToDriveSavedName(item))
		}
		ch := make(chan bool, len(hashes)) 
		for _, hash := range hashes {
			go func(hash string) {
				_ = base.Delete(hash)
				ch <- true
			}(hash)
		}
		for i := 0; i < len(hashes); i++ {
			<-ch
		}
		_ = drive.Delete(driveNames...)
		c.String(http.StatusOK, "OK")
		return

	case "PATCH":
		var body []map[string]interface{}
		_ = json.NewDecoder(c.Request.Body).Decode(&body)
		var files []deta.Record
		for _, item := range body {
			record := deta.Record{Key: item["hash"].(string), Value: item}
			files = append(files, record)
		}
		_ = base.Put(files...)
		c.String(http.StatusOK, "OK")
		return

	default:
		c.String(http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
}

func DownloadFileExtern(c *gin.Context) {
	hash := c.Param("hash")
	skip := c.Param("part")
	owner := c.Param("owner")
	recipient := c.Param("recipient")
	req, err := http.NewRequest(
		"GET",
		fmt.Sprintf("https://filebox-%s.deta.app/api/download/%s/%s/%s", owner, recipient, hash, skip),
		nil)
	if err != nil {
		c.String(http.StatusInternalServerError, "Internal Server Error")
		return
	}
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		c.String(http.StatusInternalServerError, "Internal Server Error")
		return
	}
	data, _ := io.ReadAll(resp.Body)
	c.Data(http.StatusOK, "application/octet-stream", data)
}

func PushFileMeta(c *gin.Context) {
	targetId := c.Param("id")
	resp, _ := http.Post(
		fmt.Sprintf("https://filebox-%s.deta.app/api/accept", targetId),
		"application/json",
		c.Request.Body,
	)
	c.JSON(resp.StatusCode, nil)
}

func AcceptFileMeta(c *gin.Context) {
	var file map[string]interface{}
	_ = json.NewDecoder(c.Request.Body).Decode(&file)
	record := deta.Record{Key: file["hash"].(string), Value: file}
	resp := base.Put(record)
	c.JSON(resp.StatusCode, nil)
}
