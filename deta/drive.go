package deta

import (
	"encoding/json"
	"fmt"
)

const DriveHost = "https://drive.deta.sh/v1"
const maxChunkSize = 1024 * 1024 * 10

type drive struct {
	Name    string
	service *service
}

// Put uploads the file with the given name.
// If the file already exists, it is overwritten.
func (d *drive) Put(saveAs string, content []byte) *Response {
	if len(content) <= maxChunkSize {
		resp, err := Request(Config{
			Prefix:      DriveHost,
			Body:        content,
			Method:      "POST",
			Path:        fmt.Sprintf("/%s/%s/files?name=%s", d.service.projectId, d.Name, saveAs),
			AuthToken:   d.service.key,
			ContentType: "application/octet-stream",
		})
		return NewResponse(resp, err, 201)
	}
	chunks := len(content) / maxChunkSize
	if len(content)%maxChunkSize != 0 {
		chunks++
	}
	var parts [][]byte
	for i := 0; i < chunks; i++ {
		start := i * maxChunkSize
		end := start + maxChunkSize
		if end > len(content) {
			end = len(content)
		}
		parts = append(parts, content[start:end])
	}
	initResp, err := Request(Config{
		Prefix:    DriveHost,
		Method:    "POST",
		Path:      fmt.Sprintf("/%s/%s/uploads?name=%s", d.service.projectId, d.Name, saveAs),
		AuthToken: d.service.key,
	})
	if err != nil {
		panic(err)
	}
	var resp struct {
		Name      string `json:"name"`
		UploadId  string `json:"upload_id"`
		ProjectId string `json:"project_id"`
		DriveName string `json:"drive_name"`
	}
	err = json.NewDecoder(initResp.Body).Decode(&resp)
	if err != nil {
		panic(err)
	}
	codes := make(chan int, len(parts))
	for i, part := range parts {
		go func(i int, part []byte) {
			r, _ := Request(Config{
				Prefix:      DriveHost,
				Body:        part,
				Method:      "POST",
				Path:        fmt.Sprintf("/%s/%s/uploads/%s/parts?name=%s&part=%d", d.service.projectId, d.Name, resp.UploadId, resp.Name, i+1),
				AuthToken:   d.service.key,
				ContentType: "application/octet-stream",
			})
			codes <- r.StatusCode
		}(i, part)
	}
	for i := 0; i < len(parts); i++ {
		<-codes
	}
	for i := 0; i < len(parts); i++ {
		code := <-codes
		if code != 200 {
			return NewResponse(nil, fmt.Errorf("error uploading part %d", i+1), 200)
		}
	}
	final, err := Request(Config{
		Prefix:    DriveHost,
		Method:    "PATCH",
		Path:      fmt.Sprintf("/%s/%s/uploads/%s?name=%s", d.service.projectId, d.Name, resp.UploadId, resp.Name),
		AuthToken: d.service.key,
	})
	return NewResponse(final, err, 200)
}

// Get returns the file as ReadCloser with the given name.
func (d *drive) Get(name string) *Response {
	resp, err := Request(Config{
		Prefix:    DriveHost,
		Method:    "GET",
		Path:      fmt.Sprintf("/%s/%s/files/download?name=%s", d.service.projectId, d.Name, name),
		AuthToken: d.service.key,
	})
	return NewResponse(resp, err, 200)
}

// Delete deletes the files with the given names.
func (d *drive) Delete(names ...string) *Response {
	resp, err := Request(Config{
		Prefix:    DriveHost,
		Method:    "DELETE",
		Path:      fmt.Sprintf("/%s/%s/files", d.service.projectId, d.Name),
		AuthToken: d.service.key,
		Body:      map[string][]string{"names": names},
	})
	return NewResponse(resp, err, 200)
}

// Files returns all the files in the drive with the given prefix.
// If prefix is empty, all files are returned.
// limit <- the number of files to return, defaults to 1000.
// last <- last filename of the previous request to get the next set of files.
// Use limit 0 and last "" to obtain the default behaviour of the drive.
func (d *drive) Files(prefix string, limit int, last string) *Response {
	if limit < 0 || limit > 1000 {
		limit = 1000
	}
	path := fmt.Sprintf("/%s/%s/files?limit=%d", d.service.projectId, d.Name, limit)
	if prefix != "" {
		path += fmt.Sprintf("&prefix=%s", prefix)
	}
	if last != "" {
		path += fmt.Sprintf("&last=%s", last)
	}
	resp, err := Request(Config{
		Prefix:    DriveHost,
		Method:    "GET",
		Path:      path,
		AuthToken: d.service.key,
	})
	return NewResponse(resp, err, 200)
}
