import { request } from "http";

export const expressMiddlewareProxy = ({
  host,
  port,
  path,
  method,
  headers,
}) => {
  return (oreq, ores) => {
    const reqOptions = {
      host: host ?? "localhost",
      port: port ?? 3001,
      path: path ?? oreq.url,
      method: method ?? oreq.method,
      headers: { ...oreq.headers, ...(headers ?? {}) },
    };

    const creq = request(reqOptions, (pres) => {
      ores.writeHead(pres.statusCode, pres.headers);
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

    creq.on("error", (e) => {
      console.log(e);
      if (e === "Response stream closed") {
        console.log("Original request closed");
        return;
      }
      console.error("Proxy request error:", e.message);
      ores.writeHead(500);
      ores.end(e.message);
    });

    ores.on("close", () => {
      creq.destroy("Response stream closed");
    });
  };
};
