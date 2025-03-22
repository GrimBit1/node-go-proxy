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
      // host to forward to
      host: host ?? "localhost",
      // port to forward to
      port: port ?? 3001,
      // path to forward to
      path: path,
      // request method
      method: method ?? oreq.method,
      // headers to send
      headers: { ...oreq.headers, ...(headers ?? {}) },
    };

    const creq = request(reqOptions, (pres) => {
      // set encoding
      pres.setEncoding("utf8");

      // set http status code based on proxied response
      ores.writeHead(pres.statusCode);

      // wait for data
      pres.on("data", (chunk) => {
        ores.write(chunk);
      });

      pres.on("close", () => {
        // closed, let's end client request as well
        ores.end();
      });

      pres.on("end", () => {
        // finished, let's finish client request as well
        ores.end();
      });
    }).on("error", (e) => {
      // we got an error
      console.log(e.message);
      try {
        // attempt to set error message and http status
        ores.writeHead(500);
        ores.write(e.message);
      } catch (e) {
        // ignore
      }
      ores.end();
    });
    oreq.on("close", () => {
      creq.destroy();
    });

    creq.end();
  };
};
