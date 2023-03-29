package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"

	"github.com/jnsougata/deta-go/deta"
	"github.com/labstack/echo/v5"
)

var d = deta.New(nil)
var drive = d.Drive("filebox")
var base = d.Base("filebox_metadata")

//var collectionUrl = os.Getenv("GLOBAL_COLLECTION_URL")

func Action(c echo.Context) error {
	data := drive.Files("", 0, "").Data
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
		resp := base.Get(k).Data
		_, ok := resp["hash"]
		if !ok {
			orphanNames = append(orphanNames, v)
		}
	}
	r := drive.Delete(orphanNames...)
	return c.JSON(r.StatusCode, r.Data)
}

func ProjectKey(c echo.Context) error {
	password := c.PathParam("password")
	userPin := os.Getenv("USER_PASSWORD")
	if userPin == "" {
		return c.JSON(http.StatusForbidden, map[string]string{
			"error": "no password set",
		})
	}
	if password != os.Getenv("USER_PASSWORD") {
		return c.JSON(http.StatusForbidden, map[string]string{
			"error": "incorrect password",
		})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"key": os.Getenv("DETA_API_KEY"),
	})
}

func Metadata(c echo.Context) error {
	switch c.Request().Method {
	case "GET":
		q := deta.NewQuery()
		q.NotEquals("deleted", true)
		resp := base.FetchUntilEnd(q)
		items := resp.Data["items"]
		return c.JSON(http.StatusOK, items)

	case "POST":
		var data map[string]interface{}
		_ = json.NewDecoder(c.Request().Body).Decode(&data)
		key := data["hash"].(string)
		data["key"] = key
		_, hasPrent := data["parent"]
		_, isFolder := data["type"]
		if !hasPrent && isFolder {
			q := deta.NewQuery()
			q.Equals("name", data["name"].(string))
			resp := base.FetchUntilEnd(q).Data["items"].([]map[string]interface{})
			var tmp []map[string]interface{}
			for _, item := range resp {
				if _, ok := item["parent"]; !ok {
					tmp = append(tmp, item)
				}
			}
			if len(tmp) > 0 {
				return c.JSON(http.StatusConflict, nil)
			}
		}
		if hasPrent && isFolder {
			q := deta.NewQuery()
			q.Equals("parent", data["parent"].(string))
			q.Equals("name", data["name"].(string))
			resp := base.FetchUntilEnd(q).Data["items"].([]map[string]interface{})
			if len(resp) > 0 {
				return c.JSON(http.StatusConflict, nil)
			}
		}
		resp := base.Put(deta.Record{Key: key, Value: data})
		return c.JSON(resp.StatusCode, resp.Data)

	case "PATCH":
		var data map[string]interface{}
		_ = json.NewDecoder(c.Request().Body).Decode(&data)
		projId, ok := data["project_id"]
		if !ok || !MatchProjectId(projId.(string)) {
			return c.String(http.StatusForbidden, "Unauthorized")
		}
		key := data["hash"].(string)
		data["key"] = key
		resp := base.Put(deta.Record{Key: key, Value: data})
		return c.JSON(resp.StatusCode, resp.Data)

	case "DELETE":
		metadata, _ := io.ReadAll(c.Request().Body)
		var file map[string]interface{}
		_ = json.Unmarshal(metadata, &file)
		projId, ok := file["project_id"]
		if !ok || !MatchProjectId(projId.(string)) {
			c.String(http.StatusForbidden, "Unauthorized")
		}
		_, isFolder := file["type"]
		if isFolder {
			var childrenPath string
			_, hasParent := file["parent"]
			if hasParent {
				childrenPath = fmt.Sprintf("%s/%s", file["parent"].(string), file["name"].(string))
			} else {
				childrenPath = file["name"].(string)
			}
			q := deta.NewQuery()
			q.Equals("parent", childrenPath)
			q.NotEquals("deleted", true)
			resp := base.FetchUntilEnd(q)
			children := resp.Data["items"].([]map[string]interface{})
			if len(children) > 0 {
				return c.JSON(http.StatusConflict, nil)
			} else {
				_ = base.Delete(file["hash"].(string))
				return c.JSON(http.StatusOK, nil)
			}
		}
		hash := file["hash"].(string)
		_ = base.Delete(hash)
		_ = drive.Delete(FileToDriveSavedName(file))
		return c.JSON(http.StatusOK, nil)

	default:
		return c.JSON(http.StatusMethodNotAllowed, nil)
	}
}
