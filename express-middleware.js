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

    oreq.pipe(creq);

    oreq.on("error", (err) => {
      console.error("Original request error:", err);
      creq.destroy();
    });

    creq.on("error", (e) => {
      console.log(e);
      if (creq.destroyed) {
        console.log("Request closed");
        return;
      }
      console.error("Proxy request error:", e.message);
      ores.writeHead(500);
      ores.end(e.message);
    });

    // 🚀 **Key Fix: Ensure request closes only after response is finished**
    oreq.on("close", () => {
      console.log("Original request closed");
      // creq.destroy(); // Instead of destroy(), let it finish properly
    });

    ores.on("close", () => {
      console.log("Response stream closed");
      creq.emit("close");
      creq.destroy();
    });
  };
};
