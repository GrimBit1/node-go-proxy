import { Request, Response } from "express";
import { request, RequestOptions } from "http";

export const expressMiddlewareProxy = ({
  host,
  port,
  path,
  method,
  headers,
}) => {
  return (oreq: Request, ores: Response) => {
    const reqOptions: RequestOptions = {
      host: host ?? "localhost",
      port: port ?? 3001,
      path: path ?? oreq.url,
      method: method ?? oreq.method,
      headers: { ...oreq.headers, ...(headers ?? {}) },
    };

    const creq = request(reqOptions, (pres) => {
      ores.writeHead(pres.statusCode ?? 500, pres.headers);
      pres.pipe(ores);

      pres.on("end", () => {
        console.log("Proxied response ended");
        ores.end();
      });

      pres.on("error", (err) => {
        console.error("Proxied response error:", err);
        ores.end();
      });
    });

    // Check if there's a request body to send
    if (oreq.body) {
      creq.write(JSON.stringify(oreq.body));
    } else {
      // Fall back to pipe for stream data if available
      if (oreq.readable) {
        oreq.pipe(creq);
      }
    }

    creq.end();

    oreq.on("error", (err) => {
      console.error("Original request error:", err);
      creq.destroy();
    });

    creq.on("error", (e: any) => {
      console.log(e);
      if (e.message === "Response stream closed") {
        console.log("Original request closed");
        return;
      }
      console.error("Proxy request error:", e.message ?? e.errors);
      ores.writeHead(500);
      ores.end(e.message || e.errors.toString());
    });

    ores.on("close", () => {
      creq.destroy(new Error("Response stream closed"));
    });
  };
};
