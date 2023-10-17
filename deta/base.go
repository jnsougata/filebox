package deta

import (
	"encoding/json"
	"fmt"
	"time"
)

const baseHost = "https://database.deta.sh/v1"

type Record struct {
	Key      string
	Value    interface{}
	ExpireIn int64 // in seconds
	ExpireOn int64 // unix timestamp
}

func (r *Record) marshal() interface{} {
	var data map[string]interface{}
	if r.Value != nil {
		ba, _ := json.Marshal(r.Value)
		json.Unmarshal(ba, &data)
	} else {
		data = map[string]interface{}{ "value": nil }
	}
	if r.Key != "" {
		data["key"] = r.Key
	}
	if r.ExpireIn != 0 {
		data["__expires"] = r.ExpireIn + time.Now().Unix()
	} else if r.ExpireOn != 0 {
		data["__expires"] = r.ExpireOn
	}
	return data
}

type base struct {
	Name    string
	service *service
}

func (b *base) Put(records ...Record) *Response {
	if len(records) > 25 {
		records = records[:25]
	}
	var items []interface{}
	for _, item := range records {
		items = append(items, item.marshal())
	}
	req := HttpRequest{
		Body:   mapToReader(map[string]interface{}{"items": items}),
		Method: "PUT",
		Path:   fmt.Sprintf("%s/%s/%s/items", baseHost, b.service.projectId, b.Name),
		Key:    b.service.key,
	}
	resp, err := req.Do()
	return newResponse(resp, err, 207)
}

func (b *base) Get(key string) *Response {
	req := HttpRequest{
		Body:   nil,
		Method: "GET",
		Path:   fmt.Sprintf("%s/%s/%s/items/%s", baseHost, b.service.projectId, b.Name, key),
		Key:    b.service.key,
	}
	resp, err := req.Do()
	return newResponse(resp, err, 200)
}

func (b *base) Delete(key string) *Response {
	req := HttpRequest{
		Body:   nil,
		Method: "DELETE",
		Path:   fmt.Sprintf("%s/%s/%s/items/%s", baseHost, b.service.projectId, b.Name, key),
		Key:    b.service.key,
	}
	resp, err := req.Do()
	return newResponse(resp, err, 200)
}

func (b *base) Insert(record Record) *Response {
	req := HttpRequest{
		Body:   mapToReader(map[string]interface{}{"item": record.marshal()}),
		Method: "POST",
		Path:   fmt.Sprintf("%s/%s/%s/items", baseHost, b.service.projectId, b.Name),
		Key:    b.service.key,
	}
	resp, err := req.Do()
	return newResponse(resp, err, 201)
}

func (b *base) Update(updater *Updater) *Response {
	req := HttpRequest{
		Body:   mapToReader(updater.updates),
		Method: "PATCH",
		Path:   fmt.Sprintf("%s/%s/%s/items/%s", baseHost, b.service.projectId, b.Name, updater.Key),
		Key:    b.service.key,
	}
	resp, err := req.Do()
	return newResponse(resp, err, 200)
}

func (b *base) Fetch(query *Query) *Response {
	body := map[string]interface{}{"query": query.Value}
	if query.Limit <= 0 || query.Limit > 1000 {
		body["limit"] = 1000
	} else {
		body["limit"] = query.Limit
	}
	if query.Last != "" {
		body["last"] = query.Last
	}
	req := HttpRequest{
		Body:   mapToReader(body),
		Method: "POST",
		Path:   fmt.Sprintf("%s/%s/%s/query", baseHost, b.service.projectId, b.Name),
		Key:    b.service.key,
	}
	resp, err := req.Do()
	return newResponse(resp, err, 200)
}

func (b *base) FetchUntilEnd(query *Query) *Response {
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
	_ = json.Unmarshal(resp.Bytes, &fetchData)
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
		_ = json.Unmarshal(resp.Bytes, &fetchData)
		container = append(container, fetchData.Items...)
		if fetchData.Paging.Last == query.Last {
			break
		}
	}
	nb, _ := json.Marshal(container)
	return &Response{
		Bytes:      nb,
		StatusCode: 200,
		Error:      nil,
	}
}
