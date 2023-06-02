package deta

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
)

type Response struct {
	StatusCode int
	Bytes      []byte
	Error      error
}

func (r *Response) JSON() map[string]interface{} {
	var data map[string]interface{}
	json.Unmarshal(r.Bytes, &data)
	return data
}

func (r *Response) ArrayJSON() []map[string]interface{} {
	var data []map[string]interface{}
	_ = json.Unmarshal(r.Bytes, &data)
	return data
}

func mapToReader(data interface{}) io.Reader {
	body, _ := json.Marshal(data)
	return bytes.NewReader(body)
}

func buildErrFromStatus(status, ok int) error {
	if status == ok {
		return nil
	}
	switch status {
	case 400:
		return errors.New("bad request")
	case 401:
		return errors.New("unauthorized")
	case 403:
		return errors.New("forbidden")
	case 404:
		return errors.New("not found")
	case 409:
		return errors.New("conflict")
	default:
		return fmt.Errorf("unknown error with status code %d", status)
	}
}

func newResponse(resp *http.Response, err error, ok int) *Response {
	if err != nil {
		return &Response{Error: err}
	}
	err = buildErrFromStatus(resp.StatusCode, ok)
	if err != nil {
		return &Response{Error: err}
	}
	ba, _ := io.ReadAll(resp.Body)
	return &Response{StatusCode: resp.StatusCode, Bytes: ba, Error: nil}
}
