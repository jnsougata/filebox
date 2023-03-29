package main

import (
	"log"
	"net/http"

	"github.com/labstack/echo/v5"
)

func main() {
	echo := echo.New()
	echo.File("/", "static/index.html")
	echo.File("/shared/:hash", "static/shared.html")
	echo.Static("/assets", "assets")
	echo.Static("/scripts", "scripts")
	echo.Static("/styles", "styles")
	echo.Static("/pwa", "pwa")

	if err := echo.Start(":8080"); err != http.ErrServerClosed {
		log.Fatal(err)
	}
}
