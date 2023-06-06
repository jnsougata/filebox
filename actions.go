package main

import (
	"backend/deta"
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
)

type Input struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

type SpaceAppAction struct {
	Name    string  `json:"name"`
	Title   string  `json:"title"`
	Path    string  `json:"path"`
	Input   []Input `json:"input"`
	Handler func(c *gin.Context)
}

var Save = SpaceAppAction{
	Name:  "save",
	Title: "Save",
	Path:  "/actions/save",
	Input: []Input{
		{
			Name: "name", 
			Type: "string"},
		{
			Name: "url", 
			Type: "string",
		},
	},
	Handler: func (c *gin.Context) {
		var data map[string]interface{}
		c.BindJSON(&data)
		name := data["name"].(string)
		url := data["url"].(string)
		record := deta.Record{
			Value: map[string]interface{}{
				"name":   name,
				"url":    url,
				"date":   time.Now().Unix(),
				"parent": nil,
				"size":   0,
				"mime":   "text/plain",
			},
		}
		base.Put(record)
		c.String(200, fmt.Sprintf("Saved %s successfully", name))
	},
}

func AppActions(c *gin.Context) {
	type actions struct {
		Actions []SpaceAppAction `json:"actions"`
	}
	c.JSON(200, actions{
		Actions: []SpaceAppAction{
			Save,
		},
	})
}
