package main

import (
	"net/http"
	"os"

	"github.com/gorilla/mux"
)

func main() {
	r := mux.NewRouter()
	r.HandleFunc("/", HandleIndex).Methods("GET")
	r.HandleFunc("/download/{hash}", HandleDownloadPage).Methods("GET")
	r.HandleFunc("/assets/{filename}", HandleAssets).Methods("GET")
	r.HandleFunc("/scripts/{filename}", HandleScripts).Methods("GET")
	r.HandleFunc("/styles/{filename}", HandleStyles).Methods("GET")
	http.Handle("/", r)
	_ = http.ListenAndServe(":8080", nil)
}

func HandleIndex(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/html")
	content, _ := os.ReadFile("static/index.html")
	_, _ = w.Write([]byte(content))
}

func HandleMock(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/html")
	content, _ := os.ReadFile("static/mock.html")
	_, _ = w.Write([]byte(content))
}

func HandleDownloadPage(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/html")
	content, _ := os.ReadFile("static/download.html")
	_, _ = w.Write([]byte(content))
}

func HandleAssets(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/octet-stream")
	vars := mux.Vars(r)
	filename := vars["filename"]
	content, _ := os.ReadFile("assets/" + filename)
	_, _ = w.Write([]byte(content))
}

func HandleScripts(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/javascript")
	vars := mux.Vars(r)
	filename := vars["filename"]
	content, _ := os.ReadFile("scripts/" + filename)
	_, _ = w.Write([]byte(content))
}

func HandleStyles(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/css")
	vars := mux.Vars(r)
	filename := vars["filename"]
	content, _ := os.ReadFile("styles/" + filename)
	_, _ = w.Write([]byte(content))
}
