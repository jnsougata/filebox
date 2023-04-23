package main

import (
	"encoding/json"
	"fmt"
	"github.com/gin-gonic/gin"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/jnsougata/deta-go/deta"
)

var d = deta.New(nil)
var drive = d.Drive("filebox")
var base = d.Base("filebox_metadata")
var collectionUrl = os.Getenv("GLOBAL_COLLECTION_URL")

func Action(c *gin.Context) {
	data := drive.Files("", 0, "").Data
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
		resp := base.Get(k).Data
		_, ok := resp["hash"]
		if !ok {
			orphanNames = append(orphanNames, v)
		}
	}
	r := drive.Delete(orphanNames...)
	c.JSON(r.StatusCode, r.Data)
}

func ProjectKey(c *gin.Context) {
	password := c.Param("password")
	userPin := os.Getenv("USER_PASSWORD")
	if userPin == "" {
		c.JSON(http.StatusForbidden, map[string]string{
			"error": "no password set",
		})
		return
	}
	if !MatchPassword(password) {
		c.JSON(http.StatusForbidden, map[string]string{
			"error": "incorrect password",
		})
		return
	}
	c.JSON(http.StatusOK, map[string]interface{}{
		"key": os.Getenv("DETA_API_KEY"),
	})
	return
}

func Metadata(c *gin.Context) {
	password := c.Param("password")
	if !MatchPassword(password) {
		c.String(http.StatusUnauthorized, "Unauthorized")
		return
	}
	switch c.Request.Method {
	case "GET":
		q := deta.NewQuery()
		q.NotEquals("deleted", true)
		resp := base.FetchUntilEnd(q)
		items := resp.Data["items"]
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
			resp := base.FetchUntilEnd(q).Data["items"].([]map[string]interface{})
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
			resp := base.FetchUntilEnd(q).Data["items"].([]map[string]interface{})
			if len(resp) > 0 {
				c.JSON(http.StatusConflict, nil)
				return
			}
		}
		resp := base.Put(deta.Record{Key: key, Value: data})
		c.JSON(resp.StatusCode, resp.Data)
		return

	case "PATCH":
		var data map[string]interface{}
		_ = json.NewDecoder(c.Request.Body).Decode(&data)
		projId, ok := data["project_id"]
		if !ok || !MatchProjectId(projId.(string)) {
			c.String(http.StatusForbidden, "Unauthorized")
			return
		}
		key := data["hash"].(string)
		data["key"] = key
		resp := base.Put(deta.Record{Key: key, Value: data})
		c.JSON(resp.StatusCode, resp.Data)
		return

	case "DELETE":
		metadata, _ := io.ReadAll(c.Request.Body)
		var file map[string]interface{}
		_ = json.Unmarshal(metadata, &file)
		projId, ok := file["project_id"]
		if !ok || !MatchProjectId(projId.(string)) {
			c.String(http.StatusForbidden, "Unauthorized")
		}
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
			children := resp.Data["items"].([]map[string]interface{})
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
	resp := base.Fetch(q).Data["items"]
	c.JSON(http.StatusOK, resp)
}

func EmbedFile(c *gin.Context) {
	hash := c.Param("hash")
	resp := base.Get(hash)
	access, ok := resp.Data["access"]
	if ok && access.(string) == "private" {
		c.String(http.StatusForbidden, "Unauthorized")
	}
	isDeleted, ok := resp.Data["deleted"]
	if ok && isDeleted.(bool) {
		c.String(http.StatusNotFound, "File not found")
		return
	}
	if resp.Data["size"].(float64) > 5*1024*1024 {
		c.String(http.StatusForbidden, "File too large")
		return
	}
	fileName := resp.Data["name"].(string)
	mime := resp.Data["mime"].(string)
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=%s", fileName))
	c.Header("Content-Type", mime)
	streamingResp := drive.Get(FileToDriveSavedName(resp.Data))
	c.Stream(func(w io.Writer) bool {
		_, err := io.Copy(w, streamingResp.Reader)
		if err != nil {
			return false
		}
		return true
	})
}

func DownloadFile(c *gin.Context) {
	hash := c.Param("hash")
	part := c.Param("part")
	recipient := c.Param("recipient")
	resp := base.Get(hash)
	if recipient == "na" {
		access, ok := resp.Data["access"]
		if ok && access.(string) == "private" {
			c.String(http.StatusForbidden, "Unauthorized")
			return
		}
	} else {
		recipients, ok := resp.Data["recipients"]
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
	ProjectKey := os.Getenv("DETA_PROJECT_KEY")
	ProjectId := strings.Split(ProjectKey, "_")[0]
	url := fmt.Sprintf(
		"https://drive.deta.sh/v1/%s/filebox/files/download?name=%s",
		ProjectId,
		FileToDriveSavedName(resp.Data),
	)
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("X-API-Key", ProjectKey)
	if (skip+1)*4*1024*1024 > int(resp.Data["size"].(float64)) {
		req.Header.Set("Range", fmt.Sprintf("bytes=%d-", skip*4*1024*1024))
	} else {
		req.Header.Set("Range", fmt.Sprintf("bytes=%d-%d", skip*4*1024*1024, (skip+1)*4*1024*1024-1))
	}
	client := &http.Client{}
	fResp, _ := client.Do(req)
	c.Header("Content-Type", "application/octet-stream")
	c.Stream(func(w io.Writer) bool {
		_, err := io.Copy(w, fResp.Body)
		if err != nil {
			return false
		}
		return true
	})
}

func SharedMeta(c *gin.Context) {
	hash := c.Param("hash")
	resp := base.Get(hash)
	data := resp.Data
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
	resp := base.FetchUntilEnd(q).Data["items"]
	c.JSON(http.StatusOK, resp)
}

func Rename(c *gin.Context) {
	if !MatchPassword(c.Param("password")) {
		c.String(http.StatusForbidden, "Unauthorized")
		return
	}
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
	files := resp.Data["items"].([]map[string]interface{})
	for _, file := range files {
		size += int(file["size"].(float64))
	}
	c.JSON(http.StatusOK, map[string]interface{}{"size": size})
}

func Bookmark(c *gin.Context) {
	hash := c.Param("hash")
	password := c.Param("password")
	if !MatchPassword(password) {
		c.String(http.StatusForbidden, "Unauthorized")
		return
	}
	switch c.Request.Method {
	case "POST":
		updater := deta.NewUpdater(hash)
		updater.Set("pinned", true)
		resp := base.Update(updater)
		c.JSON(resp.StatusCode, resp.Data)
		return

	case "DELETE":
		updater := deta.NewUpdater(hash)
		updater.Delete("pinned")
		resp := base.Update(updater)
		c.JSON(resp.StatusCode, resp.Data)
		return

	default:
		c.String(http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
}

func Access(c *gin.Context) {
	password := c.Param("password")
	if !MatchPassword(password) {
		c.String(http.StatusForbidden, "Unauthorized")
		return
	}
	var body map[string]interface{}
	_ = json.NewDecoder(c.Request.Body).Decode(&body)
	updater := deta.NewUpdater(body["hash"].(string))
	updater.Set("access", body["access"].(string))
	resp := base.Update(updater)
	c.JSON(resp.StatusCode, resp.Data)
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
	items := resp.Data["items"].([]map[string]interface{})
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
	password := c.Param("password")
	if !MatchPassword(password) {
		c.String(http.StatusForbidden, "Unauthorized")
		return
	}
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
		_ = base.Delete(hashes...)
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

func ExtFileDownload(c *gin.Context) {
	hash := c.Param("hash")
	skip := c.Param("part")
	owner := c.Param("owner")
	recipient := c.Param("recipient")
	oresp, _ := http.Get(fmt.Sprintf("%s/users/%s", collectionUrl, owner))
	var ownerData map[string]interface{}
	_ = json.NewDecoder(oresp.Body).Decode(&ownerData)
	ownerInstanceUrl := ownerData["url"].(string)
	ownerInstanceApiKey := ownerData["api_key"].(string)
	req, err := http.NewRequest(
		"GET",
		fmt.Sprintf("%s/api/file/%s/%s/%s", ownerInstanceUrl, recipient, hash, skip),
		nil)
	if err != nil {
		c.String(http.StatusInternalServerError, "Internal Server Error")
		return
	}
	req.Header.Set("X-Space-App-Key", ownerInstanceApiKey)
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		c.String(http.StatusInternalServerError, "Internal Server Error")
		return
	}
	defer func(Body io.ReadCloser) {
		err := Body.Close()
		if err != nil {
			log.Println(err)
		}
	}(resp.Body)
	c.Header("Content-Type", "application/octet-stream")
	c.Stream(func(w io.Writer) bool {
		_, _ = io.Copy(w, resp.Body)
		return false
	})
}

func Discovery(c *gin.Context) {
	userId := c.Param("id")
	password := c.Param("password")

	switch c.Request.Method {
	case "PUT":
		req, _ := http.NewRequest(
			"PUT",
			fmt.Sprintf("%s/users/%s/%s", collectionUrl, userId, password), c.Request.Body,
		)
		req.Header.Set("Content-Type", "application/json")
		client := &http.Client{}
		resp, _ := client.Do(req)
		defer func(Body io.ReadCloser) {
			err := Body.Close()
			if err != nil {
				log.Println(err)
			}
		}(resp.Body)
		c.String(resp.StatusCode, "OK")
		return

	case "DELETE":
		req, _ := http.NewRequest("DELETE", fmt.Sprintf("%s/users/%s/%s", collectionUrl, userId, password), nil)
		client := &http.Client{}
		resp, _ := client.Do(req)
		defer func(Body io.ReadCloser) {
			err := Body.Close()
			if err != nil {
				log.Println(err)
			}
		}(resp.Body)
		c.String(resp.StatusCode, "OK")
		return

	default:
		c.String(http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
}

func UserStatus(c *gin.Context) {
	userId := c.Param("id")
	resp, _ := http.Get(fmt.Sprintf("%s/users/%s/status", collectionUrl, userId))
	defer func(Body io.ReadCloser) {
		err := Body.Close()
		if err != nil {
			log.Println(err)
		}
	}(resp.Body)
	c.JSON(resp.StatusCode, resp.Body)
}

func PushFileMeta(c *gin.Context) {
	targetId := c.Param("id")
	resp, _ := http.Get(fmt.Sprintf("%s/users/%s", collectionUrl, targetId))
	var owner map[string]interface{}
	_ = json.NewDecoder(resp.Body).Decode(&owner)
	instanceURL, ok := owner["url"]
	if !ok {
		c.String(http.StatusNotFound, "Not Found")
		return
	}
	ownerInstanceApiKey := owner["api_key"].(string)
	req, _ := http.NewRequest("POST", fmt.Sprintf("%s/api/metadata", instanceURL.(string)), c.Request.Body)
	req.Header.Set("X-Space-App-Key", ownerInstanceApiKey)
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{}
	resp, _ = client.Do(req)
	c.JSON(resp.StatusCode, nil)
}
