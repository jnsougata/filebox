package deta

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
)

type service struct {
	key       string
	projectId string
}

type Config struct {
	Prefix      string
	Method      string
	AuthToken   string
	Path        string
	ContentType string
	Body        interface{}
}

func Request(config Config) (*http.Response, error) {
	url := config.Prefix + config.Path
	var body io.Reader
	if config.Body != nil {
		if b, ok := config.Body.([]byte); ok {
			body = bytes.NewReader(b)
		} else {
			b, _ := json.Marshal(config.Body)
			body = bytes.NewReader(b)
		}
	}
	req, err := http.NewRequest(config.Method, url, body)
	if config.ContentType == "" {
		config.ContentType = "application/json"
	}
	req.Header.Set("Content-Type", config.ContentType)
	req.Header.Set("X-API-Key", config.AuthToken)
	if err != nil {
		return nil, err
	}
	return http.DefaultClient.Do(req)
}
