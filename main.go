package main

import (
	"log"
	"net/http"

	"github.com/labstack/echo/v5"
	"github.com/labstack/echo/v5/middleware"
)

func main() {
	echo := echo.New()
	echo.Use(
		middleware.Gzip(),
		middleware.LoggerWithConfig(middleware.LoggerConfig{
			Format: "${method} ${status} ${uri}",
		}),
	)
	echo.File("/", "static/index.html")
	echo.GET("/shared/:hash", SharedPage)
	echo.File("/manifest.json", "manifest.json")
	echo.File("/service-worker.js", "service-worker.js")
	echo.Static("/assets", "assets")
	echo.Static("/scripts", "scripts")
	echo.Static("/styles", "styles")
	echo.POST("/__space/v0/actions", Action)

	api := echo.Group("/api")
	api.GET("/key/:password", ProjectKey)
	api.Any("/metadata", Metadata)
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
	api.GET("/external/:recipient/:owner/:hash/:part", ExtFileDownlaod)
	api.Any("/discovery/:id/:password", Discovery)
	api.GET("/discovery/:id/status", UserStatus)
	api.POST("/push/:id/metadata", PushFileMeta)


	if err := echo.Start(":8080"); err != http.ErrServerClosed {
		log.Fatal(err)
	}
}

func SharedPage(c echo.Context) error {
	hash := c.PathParam("hash")
	metadata := base.Get(hash).Data
	_, ok := metadata["hash"].(string)
	if !ok {
		return c.String(http.StatusNotFound, "Not Found")
	}
	access, _ := metadata["access"].(string)
	if access == "private" {
		return c.String(http.StatusForbidden, "Forbidden")
	}
	return c.File("static/shared.html")
}
