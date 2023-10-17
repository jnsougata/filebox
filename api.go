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
var connection = deta.New(detaProjectKey)
var drive = connection.Drive("filebox")
var base = connection.Base("filebox_metadata")
var metadata = connection.Base("metadata")

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

func ProjectKey(c *gin.Context) {
	c.JSON(http.StatusOK, map[string]interface{}{"key": detaProjectKey})
}

func Metadata(c *gin.Context) {
	switch c.Request.Method {

	case "POST":
		var data map[string]interface{}
		c.BindJSON(&data)
		key := data["hash"].(string)
		data["key"] = key
		_, isFolder := data["type"]
		if isFolder {
			q := deta.NewQuery()
			q.Equals("parent", data["parent"])
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

	case "PUT":
		var data map[string]interface{}
		c.BindJSON(&data)
		key := data["hash"].(string)
		data["key"] = key
		resp := base.Put(deta.Record{Key: key, Value: data})
		c.JSON(resp.StatusCode, resp.JSON())
		return

	case "PATCH":
		var data map[string]interface{}
		c.BindJSON(&data)
		updater := deta.NewUpdater(data["hash"].(string))
		delete(data, "hash")
		for k, v := range data {
			updater.Set(k, v)
		}
		resp := base.Update(updater)
		c.JSON(resp.StatusCode, resp.JSON())
		return

	case "DELETE":
		metadata, _ := io.ReadAll(c.Request.Body)
		var file map[string]interface{}
		_ = json.Unmarshal(metadata, &file)
		_, isFolder := file["type"]
		if isFolder {
			_ = base.Delete(file["hash"].(string))
			c.JSON(http.StatusOK, nil)
			return
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
	delete(data, "project_id")
	c.JSON(http.StatusOK, data)
}

func Query(c *gin.Context) {
	var data map[string]interface{}
	c.BindJSON(&data)
	ok, _ := data["__union"].(bool)
	q := deta.NewQuery()
	if ok {
		raw := data["__queries"].([]interface{})
		var queries []map[string]interface{}
		for _, item := range raw {
			queries = append(queries, item.(map[string]interface{}))
		}
		q.Value = append(q.Value, queries...)
		q.Value = q.Value[1:]
		delete(data, "__union")
		delete(data, "__queries")
	}
	for k, v := range data {
		q.Equals(k, v)
	}
	resp := base.FetchUntilEnd(q).ArrayJSON()
	c.JSON(http.StatusOK, resp)
}

func Consumption(c *gin.Context) {
	q := deta.NewQuery()
	q.NotEquals("type", "folder")
	q.NotEquals("shared", true)
	resp := base.FetchUntilEnd(q)
	consumption := 0
	files := resp.ArrayJSON()
	for _, file := range files {
		size, ok := file["size"]
		if ok {
			consumption += int(size.(float64))
		}
	}
	c.JSON(http.StatusOK, map[string]interface{}{"size": consumption})
}

func FolderChildrenCount(c *gin.Context) {
	var targets []map[string]interface{}
	c.BindJSON(&targets)
	counterMap := map[string]interface{}{}
	for _, target := range targets {
		counterMap[FolderToAsParentPath(target)] = map[string]interface{}{
			"hash": target["hash"], "count": 0,
		}
	}
	q := deta.NewQuery()
	q.Value = []map[string]interface{}{}
	var queries []deta.Query
	for parentPath := range counterMap {
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
		ctxFolder, ok := counterMap[path]
		if ok {
			ctxFolderMap := ctxFolder.(map[string]interface{})
			ctxFolderMap["count"] = ctxFolderMap["count"].(int) + 1
		}
	}
	var counts []interface{}
	for _, v := range counterMap {
		counts = append(counts, v)
	}
	c.JSON(resp.StatusCode, counts)
}

func FileBulkOps(c *gin.Context) {
	switch c.Request.Method {
	case "DELETE":
		var body []map[string]interface{}
		c.BindJSON(&body)
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
		c.BindJSON(&body)
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
	var data map[string]interface{}
	c.BindJSON(&data)
	hash := data["hash"].(string)
	resp := base.Put(deta.Record{Key: hash, Value: data})
	c.JSON(resp.StatusCode, nil)
}

func SanitizeFiles(c *gin.Context) {
	files := base.FetchUntilEnd(deta.NewQuery()).ArrayJSON()
	var sanitized []map[string]interface{}
	for _, file := range files {
		_, ok := file["parent"]
		if !ok {
			file["parent"] = nil
			delete(file, "project_id")
			sanitized = append(sanitized, file)
		}
	}
	var batches [][]map[string]interface{}
	for i := 0; i < len(sanitized); i += 25 {
		end := i + 25
		if end > len(sanitized) {
			end = len(sanitized)
		}
		batches = append(batches, sanitized[i:end])
	}
	var success = 0
	for _, batch := range batches {
		var records []deta.Record
		for _, file := range batch {
			records = append(records, deta.Record{Key: file["hash"].(string), Value: file})
		}
		resp := base.Put(records...)
		if resp.StatusCode == http.StatusMultiStatus {
			success += len(batch)
		}
	}
	c.JSON(http.StatusOK, map[string]interface{}{"sanitized": success})
}

func MigrateV2(c *gin.Context) {
	var files []FileV1
	c.BindJSON(&files)
	var records []deta.Record
	for _, file := range files {
		fv2 := FileV2{
			Key:           file.Key,
			Name:          file.Name,
			Color:         file.Color,
			Path:          file.Parent,
			Deleted:       file.Deleted,
			Size:          file.Size,
			Type:          file.Mime,
			Public:        file.Access == "public" || file.Access == "",
			Folder:        file.Type == "folder",
			Owner:         "",
			Tag:           []string{},
			Partial:       false,
			UploadedUpTo:  file.Size,
			AccessTokens:  []AccessToken{},
			NameLowercase: strings.ToLower(file.Name),
		}
		if file.Parent == "" {
			fv2.Path = "/"
		}
		records = append(records, deta.Record{Value: fv2})
		resp := metadata.Put(records...)
		c.String(resp.StatusCode, "OK")
	}
}
