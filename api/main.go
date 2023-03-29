package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/gorilla/mux"
	"github.com/jnsougata/deta-go/deta"
)

var d = deta.New(nil)
var drive = d.Drive("filebox")
var base = d.Base("filebox_metadata")
var collectionUrl = os.Getenv("GLOBAL_COLLECTION_URL")

func main() {
	r := mux.NewRouter()
	r.HandleFunc("/key/{pin}", HandleDetaKey).Methods("GET")
	r.HandleFunc("/metadata", HandleMetadata).Methods("GET", "POST", "DELETE", "PATCH")
	r.HandleFunc("/folder", HandleFolder).Methods("POST")
	r.HandleFunc("/embed/{hash}", HandleEmbed).Methods("GET")
	r.HandleFunc("/shared/{recipient}/{hash}/{skip}", HandleDownload).Methods("GET")
	r.HandleFunc("/shared/metadata/{hash}", HandleSharedMetadata).Methods("GET")
	r.HandleFunc("/query", HandleQuery).Methods("POST")
	r.HandleFunc("/rename/{project_id}", HandleRename).Methods("POST")
	r.HandleFunc("/consumption", HandleSpaceUsage).Methods("GET")
	r.HandleFunc("/pin/{project_id}/{hash}", HandlePin).Methods("POST", "DELETE")
	r.HandleFunc("/file/access", HandleFileAccess).Methods("POST")
	r.HandleFunc("/items/count", HandleFolderItemCountBulk).Methods("POST")
	r.HandleFunc("/bulk/{project_id}", HandleBulkFileOps).Methods("DELETE", "PATCH")
	r.HandleFunc("/items/count", HandleFolderItemCountBulk).Methods("POST")
	r.HandleFunc("/external/{recipient}/{owner}/{hash}/{skip}", HandleSharedFileLoad).Methods("GET", "POST")
	r.HandleFunc("/discovery/{user_id}/{pin}", HandleDiscovery).Methods("PUT", "DELETE")
	r.HandleFunc("/discovery/{user_id}/status", HandleDiscoveryStatus).Methods("GET")
	r.HandleFunc("/push/{target_id}/metadata", HandleMetadataPush).Methods("POST")
	http.Handle("/", r)
	_ = http.ListenAndServe(":8080", nil)
}

func matchProjectId(id string) bool {
	return strings.HasPrefix(os.Getenv("DETA_API_KEY"), id)
}

func HandleMetadata(w http.ResponseWriter, r *http.Request) {

	switch r.Method {

	case "GET":
		w.Header().Set("Content-Type", "application/json")
		q := deta.NewQuery()
		q.NotEquals("deleted", true)
		resp := base.FetchUntilEnd(q)
		items := resp.Data["items"]
		ba, _ := json.Marshal(items)
		_, _ = w.Write(ba)
		return

	case "POST":
		w.Header().Set("Content-Type", "application/json")
		var data map[string]interface{}
		_ = json.NewDecoder(r.Body).Decode(&data)
		key := data["hash"].(string)
		data["key"] = key
		_, hasPrent := data["parent"]
		_, isFolder := data["type"]
		if !hasPrent && isFolder {
			q := deta.NewQuery()
			q.Equals("name", data["name"].(string))
			resp := base.FetchUntilEnd(q).Data["items"].([]map[string]interface{})
			var temp []map[string]interface{}
			for _, item := range resp {
				if _, ok := item["parent"]; !ok {
					temp = append(temp, item)
				}
			}
			if len(temp) > 0 {
				w.WriteHeader(http.StatusConflict)
				return
			}
		}
		if hasPrent && isFolder {
			q := deta.NewQuery()
			q.Equals("parent", data["parent"].(string))
			q.Equals("name", data["name"].(string))
			resp := base.FetchUntilEnd(q).Data["items"].([]map[string]interface{})
			if len(resp) > 0 {
				w.WriteHeader(http.StatusConflict)
				return
			}
		}
		resp := base.Put(deta.Record{Key: key, Value: data})
		w.WriteHeader(resp.StatusCode)
		ba, _ := json.Marshal(resp.Data)
		_, _ = w.Write(ba)
		return

	case "PATCH":

		w.Header().Set("Content-Type", "application/json")
		var data map[string]interface{}
		_ = json.NewDecoder(r.Body).Decode(&data)
		projId, ok := data["project_id"]
		if !ok || !matchProjectId(projId.(string)) {
			w.WriteHeader(http.StatusForbidden)
			return
		}
		key := data["hash"].(string)
		data["key"] = key
		resp := base.Put(deta.Record{Key: key, Value: data})
		w.WriteHeader(resp.StatusCode)
		return

	case "DELETE":
		metadata, _ := io.ReadAll(r.Body)
		var file map[string]interface{}
		_ = json.Unmarshal(metadata, &file)
		projId, ok := file["project_id"]
		if !ok || !matchProjectId(projId.(string)) {
			w.WriteHeader(http.StatusForbidden)
			return
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
				w.WriteHeader(http.StatusConflict)
				return
			} else {
				_ = base.Delete(file["hash"].(string))
				w.WriteHeader(http.StatusOK)
				return
			}
		}
		hash := file["hash"].(string)
		_ = base.Delete(hash)
		_ = drive.Delete(fileToDriveSavedName(file))
		w.WriteHeader(http.StatusOK)
		return

	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func HandleFolder(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	var body map[string]interface{}
	_ = json.NewDecoder(r.Body).Decode(&body)
	parent := body["parent"].(string)
	q := deta.NewQuery()
	q.Equals("parent", parent)
	resp := base.Fetch(q).Data["items"]
	ba, _ := json.Marshal(resp)
	_, _ = w.Write(ba)
}

func HandleEmbed(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	hash := vars["hash"]
	resp := base.Get(hash)
	access, ok := resp.Data["access"]
	if ok && access.(string) == "private" {
		w.WriteHeader(http.StatusForbidden)
		return
	}
	if resp.Data["size"].(float64) < 5*1024*1024 {
		fileName := resp.Data["name"].(string)
		mime := resp.Data["mime"].(string)
		w.Header().Set("Content-Disposition", fmt.Sprintf("inline; filename=%s", fileName))
		w.Header().Set("Content-Type", mime)
		extension := strings.Split(fileName, ".")[1]
		streamingResp := drive.Get(fmt.Sprintf("%s.%s", hash, extension))
		content, _ := io.ReadAll(streamingResp.Reader)
		_, _ = w.Write(content)
	}
}

func HandleDownload(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	hash := vars["hash"]
	resp := base.Get(hash)
	recipient := vars["recipient"]
	if recipient == "na" {
		access, ok := resp.Data["access"]
		if ok && access.(string) == "private" {
			w.WriteHeader(http.StatusForbidden)
			return
		}
	} else {
		recipients, ok := resp.Data["recipients"]
		if !ok {
			w.WriteHeader(http.StatusForbidden)
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
			w.WriteHeader(http.StatusForbidden)
			return
		}
	}
	skip, _ := strconv.Atoi(vars["skip"])
	projectKey := os.Getenv("DETA_PROJECT_KEY")
	projectId := strings.Split(projectKey, "_")[0]
	url := fmt.Sprintf(
		"https://drive.deta.sh/v1/%s/filebox/files/download?name=%s",
		projectId,
		fileToDriveSavedName(resp.Data))
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("X-API-Key", projectKey)
	if (skip+1)*4*1024*1024 > int(resp.Data["size"].(float64)) {
		req.Header.Set("Range", fmt.Sprintf("bytes=%d-", skip*4*1024*1024))
	} else {
		req.Header.Set("Range", fmt.Sprintf("bytes=%d-%d", skip*4*1024*1024, (skip+1)*4*1024*1024-1))
	}
	client := &http.Client{}
	fResp, _ := client.Do(req)
	content, _ := io.ReadAll(fResp.Body)
	w.Header().Set("Content-Type", "application/octet-stream")
	_, _ = w.Write(content)
}

func HandleSharedMetadata(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	vars := mux.Vars(r)
	hash := vars["hash"]
	resp := base.Get(hash)
	ba, _ := json.Marshal(resp.Data)
	_, _ = w.Write(ba)
}

func HandleQuery(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	var body map[string]interface{}
	_ = json.NewDecoder(r.Body).Decode(&body)
	q := deta.NewQuery()
	for k, v := range body {
		q.Equals(k, v)
	}
	resp := base.FetchUntilEnd(q).Data["items"]
	ba, _ := json.Marshal(resp)
	_, _ = w.Write(ba)
}

func HandleRename(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	projectId := vars["project_id"]
	if !matchProjectId(projectId) {
		w.WriteHeader(http.StatusForbidden)
		return
	}
	var body map[string]interface{}
	_ = json.NewDecoder(r.Body).Decode(&body)
	u := deta.NewUpdater(body["hash"].(string))
	u.Set("name", body["name"].(string))
	resp := base.Update(u)
	w.WriteHeader(resp.StatusCode)
}

func HandleSpaceUsage(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	q := deta.NewQuery()
	q.NotEquals("type", "folder")
	q.NotEquals("shared", true)
	resp := base.FetchUntilEnd(q)
	size := 0
	files := resp.Data["items"].([]map[string]interface{})
	for _, file := range files {
		size += int(file["size"].(float64))
	}
	ba, _ := json.Marshal(map[string]interface{}{"size": size})
	w.WriteHeader(resp.StatusCode)
	_, _ = w.Write(ba)
}

func HandlePin(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	vars := mux.Vars(r)
	hash := vars["hash"]
	projId := vars["project_id"]
	if !matchProjectId(projId) {
		w.WriteHeader(http.StatusForbidden)
		return
	}
	switch r.Method {

	case "POST":
		updater := deta.NewUpdater(hash)
		updater.Set("pinned", true)
		resp := base.Update(updater)
		w.WriteHeader(resp.StatusCode)
		return
	case "DELETE":
		updater := deta.NewUpdater(hash)
		updater.Delete("pinned")
		resp := base.Update(updater)
		w.WriteHeader(resp.StatusCode)
		return
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func HandleFileAccess(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	var body map[string]interface{}
	_ = json.NewDecoder(r.Body).Decode(&body)
	updater := deta.NewUpdater(body["hash"].(string))
	updater.Set("access", body["access"].(string))
	resp := base.Update(updater)
	w.WriteHeader(resp.StatusCode)
}

func folderToAsParentPath(folder map[string]interface{}) string {
	var path string
	_, ok := folder["parent"]
	if ok {
		path = folder["parent"].(string) + "/" + folder["name"].(string)
	} else {
		path = folder["name"].(string)
	}
	return path
}

func HandleFolderItemCountBulk(w http.ResponseWriter, r *http.Request) {
	var folders []map[string]interface{}
	_ = json.NewDecoder(r.Body).Decode(&folders)
	parentMap := map[string]interface{}{}
	for _, folder := range folders {
		parentMap[folderToAsParentPath(folder)] = map[string]interface{}{
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
	ba, _ := json.Marshal(counts)
	w.WriteHeader(resp.StatusCode)
	_, _ = w.Write(ba)
}

func fileToDriveSavedName(file map[string]interface{}) string {
	hash := file["hash"].(string)
	fragment := strings.Split(file["name"].(string), ".")
	var driveFilename string
	if len(fragment) > 1 {
		driveFilename = fmt.Sprintf("%s.%s", hash, fragment[len(fragment)-1])
	} else {
		driveFilename = hash
	}
	return driveFilename
}

func HandleBulkFileOps(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	projId := vars["project_id"]
	if !matchProjectId(projId) {
		w.WriteHeader(http.StatusForbidden)
		return
	}
	switch r.Method {
	case "DELETE":
		var body []map[string]interface{}
		_ = json.NewDecoder(r.Body).Decode(&body)
		var hashes []string
		var driveNames []string
		for _, item := range body {
			hashes = append(hashes, item["hash"].(string))
			driveNames = append(driveNames, fileToDriveSavedName(item))
		}
		_ = base.Delete(hashes...)
		_ = drive.Delete(driveNames...)
		w.WriteHeader(http.StatusOK)
		return
	case "PATCH":
		var body []map[string]interface{}
		_ = json.NewDecoder(r.Body).Decode(&body)
		var files []deta.Record
		for _, item := range body {
			record := deta.Record{Key: item["hash"].(string), Value: item}
			files = append(files, record)
		}
		_ = base.Put(files...)
		w.WriteHeader(http.StatusOK)
	}
}

func HandleDetaKey(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	password := vars["pin"]
	userPin := os.Getenv("USER_PASSWORD")
	if userPin == "" {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	if password != os.Getenv("USER_PASSWORD") {
		w.WriteHeader(http.StatusForbidden)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	data := map[string]interface{}{
		"key": os.Getenv("DETA_API_KEY"),
	}
	ba, _ := json.Marshal(data)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(ba)
}

func HandleSharedFileLoad(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	owner := vars["owner"]
	recipient := vars["recipient"]
	hash := vars["hash"]
	skip := vars["skip"]
	oresp, _ := http.Get(fmt.Sprintf("%s/users/%s", collectionUrl, owner))
	var ownerData map[string]interface{}
	_ = json.NewDecoder(oresp.Body).Decode(&ownerData)
	ownerInstanceUrl := ownerData["url"].(string)
	ownerInstanceApiKey := ownerData["api_key"].(string)
	req, err := http.NewRequest(
		"GET",
		fmt.Sprintf("%s/api/shared/%s/%s/%s", ownerInstanceUrl, recipient, hash, skip),
		nil)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	req.Header.Set("X-Space-App-Key", ownerInstanceApiKey)
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	defer func(Body io.ReadCloser) {
		err := Body.Close()
		if err != nil {
			log.Println(err)
		}
	}(resp.Body)
	w.Header().Set("Content-Type", "application/octet-stream")
	w.WriteHeader(resp.StatusCode)
	ba, _ := io.ReadAll(resp.Body)
	_, _ = w.Write(ba)
}

func HandleDiscoveryStatus(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userId := vars["user_id"]
	req, _ := http.Get(fmt.Sprintf("%s/users/%s/status", collectionUrl, userId))
	ba, _ := io.ReadAll(req.Body)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(req.StatusCode)
	_, _ = w.Write(ba)
}

func HandleDiscovery(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userId := vars["user_id"]
	pin := vars["pin"]

	switch r.Method {
	case "PUT":
		req, _ := http.NewRequest("PUT", fmt.Sprintf("%s/users/%s/%s", collectionUrl, userId, pin), r.Body)
		req.Header.Set("Content-Type", "application/json")
		client := &http.Client{}
		resp, _ := client.Do(req)
		defer func(Body io.ReadCloser) {
			err := Body.Close()
			if err != nil {
				log.Println(err)
			}
		}(resp.Body)
		w.WriteHeader(resp.StatusCode)
		return

	case "DELETE":
		req, _ := http.NewRequest("DELETE", fmt.Sprintf("%s/users/%s/%s", collectionUrl, userId, pin), nil)
		client := &http.Client{}
		resp, _ := client.Do(req)
		defer func(Body io.ReadCloser) {
			err := Body.Close()
			if err != nil {
				log.Println(err)
			}
		}(resp.Body)
		w.WriteHeader(resp.StatusCode)
		return
	}
}

func HandleMetadataPush(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	targetId := vars["target_id"]
	resp, _ := http.Get(fmt.Sprintf("%s/users/%s", collectionUrl, targetId))
	var owner map[string]interface{}
	_ = json.NewDecoder(resp.Body).Decode(&owner)
	instanceURL, ok := owner["url"]
	if !ok {
		w.WriteHeader(http.StatusNotFound)
	}
	ownerInstanceApiKey := owner["api_key"].(string)
	req, _ := http.NewRequest("POST", fmt.Sprintf("%s/api/metadata", instanceURL.(string)), r.Body)
	req.Header.Set("X-Space-App-Key", ownerInstanceApiKey)
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{}
	resp, _ = client.Do(req)
	w.WriteHeader(resp.StatusCode)
}
