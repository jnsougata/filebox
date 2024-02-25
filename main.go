package main

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

func main() {
	gin.SetMode(gin.ReleaseMode)
	app := gin.Default()
	app.GET("/", func(c *gin.Context) {
		c.File("./static/pages/app.html")
	})
	app.GET("/manifest.json", func(c *gin.Context) {
		c.File("manifest.json")
	})
	app.GET("/worker.js", func(c *gin.Context) {
		c.File("worker.js")
	})
	app.GET("/shared/:hash", SharedPage)
	app.GET("/embed/:hash", EmbedFile)
	app.Static("/static", "static")
	app.POST("/__space/v0/actions", Job)
	app.GET("/__space/actions", AppActions)

	api := app.Group("/api")
	api.GET("/ping", Ping)
	api.GET("/key", ProjectKey)
	api.GET("/microid", MicroId)
	api.GET("/sanitize", SanitizeFiles)
	api.Any("/metadata", Metadata)
	api.GET("/metadata/:hash", SharedMeta)
	api.POST("/query", Query)
	api.GET("/consumption", Consumption)
	api.POST("/count/items", FolderChildrenCount)
	api.Any("/bulk", FileBulkOps)
	api.GET("/download/:recipient/:hash/:part", DownloadFile)
	api.GET("/external/:recipient/:owner/:hash/:part", DownloadFileExtern)
	api.POST("/push/:id", PushFileMeta)
	api.POST("/accept", AcceptFileMeta)
	api.POST("/v2/migrate", MigrateV2)

	actions := app.Group("/actions")
	actions.POST("/save", Save.Handler)

	if err := app.Run(":8080"); err != http.ErrServerClosed {
		log.Fatal(err)
	}
}
