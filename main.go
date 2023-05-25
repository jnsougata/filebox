package main

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

func main() {
	r := gin.Default()
	r.GET("/", func(c *gin.Context) {
		c.File("static/index.html")
	})
	r.GET("/manifest.json", func(c *gin.Context) {
		c.File("manifest.json")
	})
	r.GET("/service-worker.js", func(c *gin.Context) {
		c.File("service-worker.js")
	})
	r.GET("/shared/:hash", SharedPage)
	r.Static("/assets", "assets")
	r.Static("/scripts", "scripts")
	r.Static("/styles", "styles")
	r.POST("/__space/v0/actions", Action)

	api := r.Group("/api")
	api.GET("/ping", Ping)
	api.GET("/key", ProjectKey)
	api.GET("/root", Root)
	api.Any("/metadata", Metadata)
	api.POST("/folder", ExtraFolderMeta)
	api.GET("/embed/:hash", EmbedFile)
	api.GET("/file/metadata/:hash", SharedMeta)
	api.POST("/query", Query)
	api.POST("/rename", Rename)
	api.GET("/consumption", Consumption)
	api.Any("/bookmark/:hash", Bookmark)
	api.PATCH("/file/access", Access)
	api.POST("/items/count", FolderItemCountBulk)
	api.Any("/bulk", FileBulkOps)
	api.GET("/download/:recipient/:hash/:part", DownloadFile)
	api.GET("/external/:recipient/:owner/:hash/:part", DownloadFileExtern)
	api.POST("/push/:id", PushFileMeta)
	api.POST("/accept", AcceptFileMeta)

	if err := r.Run(":8080"); err != http.ErrServerClosed {
		log.Fatal(err)
	}
}
