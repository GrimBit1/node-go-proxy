package main

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func main() {
	e := echo.New()
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.GET("/", func(c echo.Context) error {
		ctx := c.Request().Context()
		select {
		case <-ctx.Done():
			fmt.Println("Request timeout")
			return c.JSON(http.StatusRequestTimeout, map[string]string{
				"message": "Request timeout",
			})
		case <-time.After(2 * time.Second):
			fmt.Println("After 2 secs")
			return c.JSON(http.StatusOK, map[string]string{
				"message": "After 2 secs",
			})

		}
	})
	e.POST("/echo", func(c echo.Context) error {
		file, err := c.FormFile("file")
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"message": "Invalid request",
			})
		}
		src, err := file.Open()
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"message": "Internal server error",
			})
		}
		defer src.Close()

		img, err := os.Create("./" + file.Filename)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"message": "Internal server error",
			})
		}
		defer img.Close()

		// Write the file
		data, err := io.Copy(img, src)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"message": "Internal server error",
			})
		}
		fmt.Println(data)

		return c.JSON(http.StatusOK, file)
	})

	e.GET("/wait", func(c echo.Context) error {
		ctx := c.Request().Context()
		select {
		case <-ctx.Done():
			fmt.Println("Request timeout")
			return c.JSON(http.StatusRequestTimeout, map[string]string{
				"message": "Request timeout",
			})
		case <-time.After(5 * time.Second):
			fmt.Println("After 5 secs")
			return c.JSON(http.StatusOK, map[string]string{
				"message": "After 5 secs",
			})

		}

	})
	e.GET("/temp", func(c echo.Context) error {

		return c.File("./user.json")
	})
	e.Logger.Fatal(e.Start(":3001"))
}
