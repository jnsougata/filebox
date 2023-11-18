package deta

import (
	"encoding/json"
	"fmt"
)

const BaseHost = "https://database.deta.sh/v1"

type Base struct {
	Name    string
	service *service
}

func (b *Base) Put(records ...any) *Response {
	if len(records) > 25 {
		records = records[:25]
	}
	var items []interface{}
	items = append(items, records...)
	resp, err := Request(Config{
		Prefix:    BaseHost,
		Body:      map[string]interface{}{"items": items},
		Method:    "PUT",
		Path:      fmt.Sprintf("/%s/%s/items", b.service.projectId, b.Name),
		AuthToken: b.service.key,
	})
	return NewResponse(resp, err, 207)
}

func (b *Base) Get(key string) *Response {
	resp, err := Request(Config{
		Prefix:    BaseHost,
		Body:      nil,
		Method:    "GET",
		Path:      fmt.Sprintf("/%s/%s/items/%s", b.service.projectId, b.Name, key),
		AuthToken: b.service.key,
	})
	return NewResponse(resp, err, 200)
}

func (b *Base) Delete(key string) *Response {
	resp, err := Request(Config{
		Prefix:    BaseHost,
		Body:      nil,
		Method:    "DELETE",
		Path:      fmt.Sprintf("/%s/%s/items/%s", b.service.projectId, b.Name, key),
		AuthToken: b.service.key,
	})
	return NewResponse(resp, err, 200)
}

func (b *Base) Insert(record any) *Response {
	resp, err := Request(Config{
		Prefix:    BaseHost,
		Body:      map[string]interface{}{"item": record},
		Method:    "POST",
		Path:      fmt.Sprintf("/%s/%s/items", b.service.projectId, b.Name),
		AuthToken: b.service.key,
	})
	return NewResponse(resp, err, 201)
}

func (b *Base) Update(updater *Updater) *Response {
	resp, err := Request(Config{
		Prefix:    BaseHost,
		Body:      updater.updates,
		Method:    "PATCH",
		Path:      fmt.Sprintf("/%s/%s/items/%s", b.service.projectId, b.Name, updater.Key),
		AuthToken: b.service.key,
	})
	return NewResponse(resp, err, 200)
}

func (b *Base) Fetch(query *Query) *Response {
	body := map[string]interface{}{"query": query.Value}
	if query.Limit <= 0 || query.Limit > 1000 {
		body["limit"] = 1000
	} else {
		body["limit"] = query.Limit
	}
	if query.Last != "" {
		body["last"] = query.Last
	}
	resp, err := Request(Config{
		Prefix:    BaseHost,
		Body:      body,
		Method:    "POST",
		Path:      fmt.Sprintf("/%s/%s/query", b.service.projectId, b.Name),
		AuthToken: b.service.key,
	})
	return NewResponse(resp, err, 200)
}

func (b *Base) FetchUntilEnd(query *Query) *Response {
	var container []map[string]interface{}
	resp := b.Fetch(query)
	if resp.Error != nil {
		return resp
	}
	var fetchData struct {
		Paging struct {
			Size float64 `json:"size"`
			Last string  `json:"last"`
		} `json:"paging"`
		Items []map[string]interface{} `json:"items"`
	}
	_ = json.Unmarshal(resp.Body, &fetchData)
	container = append(container, fetchData.Items...)
	for {
		if fetchData.Paging.Last == "" {
			break
		}
		query.Last = fetchData.Paging.Last
		resp := b.Fetch(query)
		if resp.Error != nil {
			return resp
		}
		_ = json.Unmarshal(resp.Body, &fetchData)
		container = append(container, fetchData.Items...)
		if fetchData.Paging.Last == query.Last {
			break
		}
	}
	nb, _ := json.Marshal(container)
	return &Response{
		Body:       nb,
		StatusCode: 200,
		Error:      nil,
	}
}
