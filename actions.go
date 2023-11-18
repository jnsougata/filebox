package main

import (
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
)

type Input struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

type SpaceAppAction struct {
	Name    string               `json:"name"`
	Title   string               `json:"title"`
	Path    string               `json:"path"`
	Input   []Input              `json:"input"`
	Handler func(c *gin.Context) `json:"-"`
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
			Name: "content",
			Type: "string",
		},
	},
	Handler: func(c *gin.Context) {
		var data map[string]interface{}
		c.BindJSON(&data)
		name := data["name"].(string)
		content := []byte(data["content"].(string))
		key := randomHex(32)
		record := map[string]interface{}{
			"key":    key,
			"name":   name,
			"date":   time.Now().Format("2006-01-02T15:04:05.000Z"),
			"parent": nil,
			"size":   len(content),
			"mime":   "text/plain",
			"hash":   key,
		}
		base.Put(record)
		drive.Put(FileToDriveSavedName(record), content)
		c.String(200, fmt.Sprintf("Saved %s successfully", name))
	},
}

func AppActions(c *gin.Context) {
	c.JSON(200, map[string]interface{}{
		"actions": []SpaceAppAction{Save},
	})
}
