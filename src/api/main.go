package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/gorilla/mux"
	"github.com/jnsougata/deta-go/deta"
)

var d = deta.New()
var base = d.Base("filebox_metadata")
var drive = d.Drive("filebox")

func main() {
	r := mux.NewRouter()
	r.HandleFunc("/secret", HandleSecret).Methods("GET")
	r.HandleFunc("/metadata", HandleMetadata).Methods("GET", "POST", "DELETE")
	r.HandleFunc("/folder", HandleFolder).Methods("POST")
	r.HandleFunc("/embed/{hash}", HandleEmbed).Methods("GET")
	r.HandleFunc("/shared/chunk/{skip}/{hash}", HandleDownload).Methods("GET")
	r.HandleFunc("/shared/metadata/{hash}", HandleSharedMetadata).Methods("GET")
	r.HandleFunc("/query", HandleQuery).Methods("POST")
	r.HandleFunc("/remove/folder", HandleFolderDelete).Methods("POST")
	r.HandleFunc("/rename", HandleRename).Methods("POST")
	r.HandleFunc("/consumption", HandleSpaceUsage).Methods("GET")
	r.HandleFunc("/pin/{hash}", HandlePin).Methods("POST", "DELETE")
	r.HandleFunc("/file/access", HandleFileAccess).Methods("POST")
	r.HandleFunc("/items/count", HandleItemCount).Methods("POST")
	http.Handle("/", r)
	_ = http.ListenAndServe(":8080", nil)
}

func HandleSecret(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/plain")
	_, _ = w.Write([]byte(os.Getenv("DETA_PROJECT_KEY")))
}

func HandleMetadata(w http.ResponseWriter, r *http.Request) {

	switch r.Method {

	case "GET":
		w.Header().Set("Content-Type", "application/json")
		resps := base.Get()
		items := resps[0].Data["items"]
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
			q := deta.Query()
			q.Equals(map[string]interface{}{"name": data["name"].(string)})
			resp := base.Fetch(q, "", 0).Data["items"].([]interface{})
			var temp []map[string]interface{}
			for _, item := range resp {
				record := item.(map[string]interface{})
				if _, ok := record["parent"]; !ok {
					temp = append(temp, record)
				}
			}
			if len(temp) > 0 {
				w.WriteHeader(http.StatusConflict)
				return
			}
		}
		if hasPrent && isFolder {
			q := deta.Query()
			q.Equals(map[string]interface{}{"parent": data["parent"].(string), "name": data["name"].(string)})
			resp := base.Fetch(q, "", 0).Data["items"].([]interface{})
			if len(resp) > 0 {
				w.WriteHeader(http.StatusConflict)
				return
			}
		}
		resp := base.Put(data)
		w.WriteHeader(resp[0].StatusCode)
		ba, _ := json.Marshal(resp[0].Data)
		_, _ = w.Write(ba)
		return

	case "DELETE":
		metadata, _ := io.ReadAll(r.Body)
		var file map[string]interface{}
		_ = json.Unmarshal(metadata, &file)
		hash := file["hash"].(string)
		_ = base.Delete(hash)
		extension := strings.Split(file["name"].(string), ".")[1]
		_ = drive.Delete(fmt.Sprintf("%s.%s", hash, extension))
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
	q := deta.Query()
	q.Equals(map[string]interface{}{"parent": parent})
	resp := base.Fetch(q, "", 0).Data["items"]
	ba, _ := json.Marshal(resp)
	_, _ = w.Write(ba)
}

func HandleEmbed(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	hash := vars["hash"]
	resp := base.Get(hash)
	meta := resp[0].Data
	access, ok := meta["access"]
	if ok && access.(string) == "private" {
		w.WriteHeader(http.StatusForbidden)
		return
	}
	if meta["size"].(float64) < 5*1024*1024 {
		fileName := meta["name"].(string)
		mime := meta["mime"].(string)
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
	var recordHash string
	fragments := strings.Split(hash, ".")
	if len(fragments) > 1 {
		recordHash = fragments[0]
	} else {
		recordHash = hash
	}
	resp := base.Get(recordHash)
	meta := resp[0].Data
	access, ok := meta["access"]
	if ok && access.(string) == "private" {
		w.WriteHeader(http.StatusForbidden)
		return
	}
	skip, _ := strconv.Atoi(vars["skip"])
	streamingResp := drive.Get(hash)
	ChunkSize := 4 * 1024 * 1024
	content, _ := io.ReadAll(streamingResp.Reader)
	w.Header().Set("Content-Type", "application/octet-stream")
	if (skip+1)*ChunkSize > len(content) {
		_, _ = w.Write(content[skip*ChunkSize:])
		return
	} else {
		_, _ = w.Write(content[skip*ChunkSize : (skip+1)*ChunkSize])
		return
	}
}

func HandleSharedMetadata(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	vars := mux.Vars(r)
	hash := vars["hash"]
	resp := base.Get(hash)
	ba, _ := json.Marshal(resp[0].Data)
	_, _ = w.Write(ba)
}

func HandleQuery(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	var body map[string]interface{}
	_ = json.NewDecoder(r.Body).Decode(&body)
	q := deta.Query()
	q.Equals(body)
	resp := base.Fetch(q, "", 0).Data["items"]
	ba, _ := json.Marshal(resp)
	_, _ = w.Write(ba)
}

func HandleFolderDelete(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	_ = json.NewDecoder(r.Body).Decode(&body)
	q := deta.Query()
	q.Equals(map[string]interface{}{"parent": body["children_path"].(string)})
	children := base.Fetch(q, "", 0).Data["items"].([]interface{})
	if len(children) > 0 {
		w.WriteHeader(http.StatusConflict)
	} else {
		base.Delete(body["hash"].(string))
		w.WriteHeader(http.StatusOK)
	}
}

func HandleRename(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	_ = json.NewDecoder(r.Body).Decode(&body)
	updater := base.Update(body["hash"].(string))
	updater.Set(map[string]interface{}{"name": body["name"].(string)})
	updater.Do()
}

func HandleSpaceUsage(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	resp := base.Get()
	ba, _ := json.Marshal(resp)
	_, _ = w.Write(ba)
}

func HandlePin(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	vars := mux.Vars(r)
	hash := vars["hash"]
	switch r.Method {

	case "POST":
		updater := base.Update(hash)
		updater.Set(map[string]interface{}{"pinned": true})
		updater.Do()
		w.WriteHeader(http.StatusOK)
		return
	case "DELETE":
		updater := base.Update(hash)
		updater.Delete("pinned")
		updater.Do()
		w.WriteHeader(http.StatusOK)
		return
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func HandleFileAccess(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	var body map[string]interface{}
	_ = json.NewDecoder(r.Body).Decode(&body)
	updater := base.Update(body["hash"].(string))
	updater.Set(map[string]interface{}{"access": body["access"].(string)})
	updater.Do()
	w.WriteHeader(http.StatusOK)
}

func HandleItemCount(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	_ = json.NewDecoder(r.Body).Decode(&body)
	q := deta.Query()
	q.Equals(map[string]interface{}{"parent": body["children_path"].(string)})
	children := base.Fetch(q, "", 0).Data["items"].([]interface{})
	ba, _ := json.Marshal(map[string]interface{}{"count": len(children)})
	_, _ = w.Write(ba)
}