package main

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

func main() {
	r := gin.Default()
	r.GET("/", func(c *gin.Context) {
		c.File("static/app.html")
	})
	r.GET("/manifest.json", func(c *gin.Context) {
		c.File("manifest.json")
	})
	r.GET("/service-worker.js", func(c *gin.Context) {
		c.File("service-worker.js")
	})
	r.GET("/shared/:hash", SharedPage)
	r.GET("/embed/:hash", EmbedFile)
	r.Static("/assets", "assets")
	r.Static("/scripts", "scripts")
	r.Static("/styles", "styles")
	r.POST("/__space/v0/actions", Action)
	r.GET("/__space/actions", AppActions)

	api := r.Group("/api")
	api.GET("/ping", Ping)
	api.GET("/key", ProjectKey)
	api.GET("/root", Root)
	api.GET("/sanitize", SanitizeFiles)
	api.Any("/metadata", Metadata)
	api.GET("/metadata/:hash", SharedMeta)
	api.POST("/query", Query)
	api.POST("/rename", Rename)
	api.GET("/consumption", Consumption)
	api.Any("/bookmark/:hash", Bookmark)
	api.POST("/count/items", FolderChildrenCount)
	api.Any("/bulk", FileBulkOps)
	api.GET("/download/:recipient/:hash/:part", DownloadFile)
	api.GET("/external/:recipient/:owner/:hash/:part", DownloadFileExtern)
	api.POST("/push/:id", PushFileMeta)
	api.POST("/accept", AcceptFileMeta)

	actions := r.Group("/actions")
	actions.POST("/save", Save.Handler)

	if err := r.Run(":8080"); err != http.ErrServerClosed {
		log.Fatal(err)
	}
}
