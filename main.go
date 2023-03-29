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
	echo.File("/shared/:hash", "static/shared.html")
	echo.File("/manifest.json", "manifest.json")
	echo.File("/service-worker.js", "service-worker.js")
	echo.Static("/assets", "assets")
	echo.Static("/scripts", "scripts")
	echo.Static("/styles", "styles")
	echo.POST("/__space/v0/actions", Action)

	// api := echo.Group("/api")
	// api.GET("/key/:password", ProjectKey)
	// api.Any("/metadata", Metadata)

	if err := echo.Start(":8080"); err != http.ErrServerClosed {
		log.Fatal(err)
	}
}
