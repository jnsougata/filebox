package main

import (
	"github.com/gin-gonic/gin"
	"log"
	"net/http"
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
	api.GET("/key/:password", ProjectKey)
	api.Any("/metadata/:password", Metadata)
	api.POST("/folder", ExtraFolderMeta)
	api.GET("/embed/:hash", EmbedFile)
	api.GET("/file/:recipient/:hash/:part", DownloadFile)
	api.GET("/file/metadata/:hash", SharedMeta)
	api.POST("/query", Query)
	api.POST("/rename/:password", Rename)
	api.GET("/consumption", Consumption)
	api.Any("/bookmark/:hash/:password", Bookmark)
	api.PATCH("/file/access/:password", Access)
	api.POST("/items/count", FolderItemCountBulk)
	api.Any("/bulk/:password", FileBulkOps)
	api.GET("/external/:recipient/:owner/:hash/:part", ExtFileDownload)
	api.Any("/discovery/:id/:password", Discovery)
	api.GET("/discovery/:id/status", UserStatus)
	api.POST("/push/:id/metadata", PushFileMeta)

	if err := r.Run(":8080"); err != http.ErrServerClosed {
		log.Fatal(err)
	}
}

func SharedPage(c *gin.Context) {
	hash := c.Param("hash")
	metadata := base.Get(hash).Data
	_, ok := metadata["hash"].(string)
	if !ok {
		c.String(http.StatusNotFound, "Not Found")
		return
	}
	access, _ := metadata["access"].(string)
	if access == "private" {
		c.String(http.StatusForbidden, "Forbidden")
		return
	}
	c.File("static/shared.html")

}
