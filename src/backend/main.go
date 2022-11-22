package main

import (
	"encoding/json"
	"fmt"
	"github.com/gorilla/mux"
	"github.com/jnsougata/deta-go/deta"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
)

var d = deta.New()
var base = d.Base("filebox_metadata")
var drive = d.Drive("filebox")

func main() {
	r := mux.NewRouter()
	r.HandleFunc("/secret", HandleSecret).Methods("GET")
	r.HandleFunc("/metadata", HandleMetadata).Methods("GET", "POST", "DELETE")
	r.HandleFunc("/folder/{path:[a-zA-Z0-9=\\-\\/]+}", HandleFolder).Methods("GET")
	r.HandleFunc("/embed/{hash}", HandleEmbed).Methods("GET")
	r.HandleFunc("/shared/chunk/{skip}/{hash}", HandleDownload).Methods("GET")
	r.HandleFunc("/shared/metadata/{hash}", HandleSharedMetadata).Methods("GET")
	r.HandleFunc("/query", QueryHandler).Methods("POST")
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
	vars := mux.Vars(r)
	path := vars["path"]
	q := deta.Query()
	q.Equals(map[string]interface{}{"parent": path})
	resp := base.Fetch(q, "", 0).Data["items"]
	ba, _ := json.Marshal(resp)
	_, _ = w.Write(ba)
}

func HandleEmbed(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	hash := vars["hash"]
	resp := base.Get(hash)
	meta := resp[0].Data
	if meta["size"].(float64) < 5*1024*1024 {
		fileName := meta["name"].(string)
		mime := meta["mime"].(string)
		w.Header().Set("Content-Disposition", fmt.Sprintf("inline; filename=%s", fileName))
		w.Header().Set("Content-Type", mime)
		extension := strings.Split(fileName, ".")[1]
		streamingResp := drive.Get(fmt.Sprintf("%s.%s", hash, extension))
		content, _ := io.ReadAll(streamingResp.Reader)
		_, _ = w.Write(content)
		return
	}
}

func HandleDownload(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	hash := vars["hash"]
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

func QueryHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	var body map[string]interface{}
	_ = json.NewDecoder(r.Body).Decode(&body)
	q := deta.Query()
	q.Equals(body)
	resp := base.Fetch(q, "", 0).Data["items"]
	ba, _ := json.Marshal(resp)
	_, _ = w.Write(ba)
}
