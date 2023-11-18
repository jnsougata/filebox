package deta

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
)

type Response struct {
	StatusCode int
	Body       []byte
	Error      error
}

func (r *Response) JSON() map[string]interface{} {
	var data map[string]interface{}
	json.Unmarshal(r.Body, &data)
	return data
}

func (r *Response) ArrayJSON() []map[string]interface{} {
	var data []map[string]interface{}
	_ = json.Unmarshal(r.Body, &data)
	return data
}

func ErrFromStatus(status, ok int) error {
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

func NewResponse(resp *http.Response, err error, ok int) *Response {
	if err != nil {
		return &Response{Error: err}
	}
	err = ErrFromStatus(resp.StatusCode, ok)
	if err != nil {
		return &Response{Error: err}
	}
	ba, _ := io.ReadAll(resp.Body)
	return &Response{StatusCode: resp.StatusCode, Body: ba, Error: nil}
}
