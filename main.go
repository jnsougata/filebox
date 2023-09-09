package main

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

func main() {
	app := gin.Default()
	app.GET("/", func(c *gin.Context) {
		c.File("static/app.html")
	})
	app.GET("/manifest.json", func(c *gin.Context) {
		c.File("manifest.json")
	})
	app.GET("/worker.js", func(c *gin.Context) {
		c.File("worker.js")
	})
	app.GET("/shared/:hash", SharedPage)
	app.GET("/embed/:hash", EmbedFile)
	app.Static("/assets", "assets")
	app.Static("/scripts", "scripts")
	app.Static("/styles", "styles")
	app.POST("/__space/v0/actions", Action)
	app.GET("/__space/actions", AppActions)

	api := app.Group("/api")
	api.GET("/ping", Ping)
	api.GET("/key", ProjectKey)
	api.GET("/root", Root)
	api.GET("/sanitize", SanitizeFiles)
	api.Any("/metadata", Metadata)
	api.GET("/metadata/:hash", SharedMeta)
	api.POST("/query", Query)
	api.PUT("/upload/:id/:index", UploadPart)
	api.GET("/consumption", Consumption)
	api.POST("/count/items", FolderChildrenCount)
	api.Any("/bulk", FileBulkOps)
	api.GET("/download/:recipient/:hash/:part", DownloadFile)
	api.GET("/external/:recipient/:owner/:hash/:part", DownloadFileExtern)
	api.POST("/push/:id", PushFileMeta)
	api.POST("/accept", AcceptFileMeta)

	actions := app.Group("/actions")
	actions.POST("/save", Save.Handler)

	if err := app.Run(":8080"); err != http.ErrServerClosed {
		log.Fatal(err)
	}
}
