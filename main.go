package main

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func main() {
	e := echo.New()
	e.Use(middleware.Logger())
	e.GET("/", func(c echo.Context) error {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"message": "Hello World from Echo",
		})
	})
	e.GET("/temp", func(c echo.Context) error {

		return c.File("./user.json")
	})
	e.Logger.Fatal(e.Start(":3001"))
}
