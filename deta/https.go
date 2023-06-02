package deta

import (
	"bytes"
	"io"
	"net/http"
)

type service struct {
	key       string
	projectId string
}

type HttpRequest struct {
	Body   io.Reader
	Method string
	Key    string
	Path   string
}

func (r *HttpRequest) Do() (*http.Response, error) {
	req, err := http.NewRequest(r.Method, r.Path, r.Body)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", r.Key)
	if err != nil {
		return nil, err
	}
	return http.DefaultClient.Do(req)
}

type DriveRequest struct {
	Body   []byte
	Method string
	Key    string
	Path   string
}

func (r *DriveRequest) Do() (*http.Response, error) {
	req, err := http.NewRequest(r.Method, r.Path, bytes.NewReader(r.Body))
	req.Header.Set("Content-Type", "application/octet-stream")
	req.Header.Set("X-Api-Key", r.Key)
	if err != nil {
		return nil, err
	}
	return http.DefaultClient.Do(req)
}
