import express from "express";
const app = express();
import request from "request";
import http from "http";
import { expressMiddlewareProxy } from "./express-middleware.js";
app.all("/", (req, res) => {
  return res.json({
    message: "Hello World",
  });
});

app.post(
  "/echo",
  expressMiddlewareProxy({
    path: "/echo",
  })
);
app.get(
  "/temp",
  expressMiddlewareProxy({
    path: "/temp",
  })
);
app.get("/file", (req, res) => {
  console.log(import.meta.url.slice(7,-8)+'user.json');
  return res.sendFile(import.meta.url.slice(7,-8)+'user.json');
});

app.listen(3000, (err) => {
  console.log("Server running on port 3000");
});
