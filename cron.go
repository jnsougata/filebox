package main

import (
	"strings"

	"github.com/gin-gonic/gin"
)

func Job(c *gin.Context) {
	data := drive.Files("", 0, "").JSON()
	names := data["names"].([]interface{})
	hashes := map[string]string{}
	for _, name := range names {
		fragments := strings.Split(name.(string), ".")
		if len(fragments) > 1 {
			hashes[fragments[0]] = name.(string)
		} else {
			hashes[name.(string)] = name.(string)
		}
	}
	var orphanNames []string
	for k, v := range hashes {
		resp := base.Get(k).JSON()
		_, ok := resp["hash"]
		if !ok {
			orphanNames = append(orphanNames, v)
		}
	}
	r := drive.Delete(orphanNames...)
	c.JSON(r.StatusCode, r.JSON())
}
