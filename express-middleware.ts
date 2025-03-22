import { request, RequestOptions, OutgoingHttpHeaders } from "http";
import { Request } from "express";
export const expressMiddlewareProxy = ({
  host,
  port,
  path,
  method,
  headers,
}: {
  host?: string;
  path: string;
  port?: number;
  method?: string;
  headers?: OutgoingHttpHeaders;
}) => {
  return (oreq: Request, ores) => {
    const reqOptions: RequestOptions = {
      // host to forward to
      host: host ?? "localhost",
      // port to forward to
      port: port ?? 80,
      // path to forward to
      path: path,
      // request method
      method: method ?? oreq.method,
      // headers to send
      headers: { ...(oreq.headers as OutgoingHttpHeaders), ...(headers ?? {}) },
    };
    oreq.on("close", () => {
      console.log("Request Closed");
    });

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
