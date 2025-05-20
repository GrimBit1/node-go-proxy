import { Request, Response } from "express";
import { request, RequestOptions } from "http";
import { UploadedFile } from "express-fileupload";

import FormData from "form-data";
import { Readable } from "stream";

/**
 * Rebuilds form-data from Express request
 * @param {Request} oreq - Express request object
 * @returns {FormData} form-data instance
 */

export interface CustomRequest extends Request {
  files: {
    [formField: string]: UploadedFile | UploadedFile[];
  };
}

export const rebuildFormDataFromRequest = (oreq: CustomRequest) => {
  const form = new FormData();

  // Append fields
  for (const key in oreq.body) {
    const value = oreq.body[key];

    if (Array.isArray(value)) {
      value.forEach((v) => form.append(key, v));
    } else {
      form.append(key, value);
    }
  }

  // Append multiple files
  if (oreq.files) {
    const filesArray = Array.isArray(oreq.files)
      ? oreq.files
      : convertMulterFilesToArray(oreq.files);
    filesArray.forEach((file) => {
      const stream = Readable.from(file.data);
      form.append(file.fieldname, stream, {
        filename: file.name,
        contentType: file.mimetype,
      });
    });
  }

  return form;
};

export const convertMulterFilesToArray = (files) => {
  if (!files) {
    return [];
  }

  const fields = Object.keys(files);
  const filesArray: any[] = [];
  for (const field of fields) {
    const file = files[field];
    if (Array.isArray(file)) {
      file.forEach((f) => {
        f.fieldname = field;
      });
      filesArray.push(...file);
    } else {
      file.fieldname = field;
      filesArray.push(file);
    }
  }
  return filesArray;
};

export const expressMiddlewareProxy = (
  { host, port, path, method, headers },
  callback?: Function
) => {
  return (oreq: CustomRequest, ores: Response) => {
    const reqOptions: RequestOptions = {
      host: host ?? process.env.GO_HOST ?? "localhost",
      port: port ?? process.env.GO_PORT ?? 80,
      path: path ?? oreq.url,
      method: method ?? oreq.method,
      headers: { ...oreq.headers, ...(headers ?? {}) },
    };

    if (oreq.body) {
      delete reqOptions?.headers?.["content-length"]; // Let it be auto calculated
    }

    let requestBodyStream: FormData | Readable | undefined = undefined;

    const contentType = oreq.headers["content-type"] || "";

    if (contentType.includes("multipart/form-data") && oreq.files) {
      // Rebuild form-data
      const form = rebuildFormDataFromRequest(oreq);

      requestBodyStream = form;
      // Update headers
      reqOptions.headers = {
        ...reqOptions.headers,
        ...form.getHeaders(),
      };
    } else if (oreq.body) {
      // Normal JSON
      const jsonString = JSON.stringify(oreq.body);
      requestBodyStream = Readable.from([jsonString]);
      if (!reqOptions.headers) {
        reqOptions.headers = {};
        reqOptions.headers["content-type"] = "application/json";
      }
    }

    const creq = request(reqOptions, (pres) => {
      ores.writeHead(pres.statusCode ?? 500, pres.headers);

      let chunks: any[] = [];
      if (!callback) {
        pres.pipe(ores);
      } else {
        pres.on("data", (chunk) => {
          chunks.push(chunk);
        });
      }

      pres.on("end", async () => {
        console.log("Proxied response ended");
        if (callback) {
          ores.write(chunks.toString());
          await callback?.(oreq, ores, chunks.toString());
        }
        ores.end();
      });

      pres.on("error", (err) => {
        console.error("Proxied response error:", err);
        ores.end();
      });
    });

    if (requestBodyStream) {
      requestBodyStream.pipe(creq);
    } else if (oreq.readable) {
      oreq.pipe(creq);
    } else {
      creq.end();
    }

    oreq.on("error", (err) => {
      console.error("Original request error:", err);
      creq.destroy();
    });

    creq.on("error", (e) => {
      console.log(e);
      if (e.message === "Response stream closed") {
        console.log("Original request closed");
        return;
      }
      console.error("Proxy request error:", e.message ?? e.cause);
      ores.writeHead(500);
      ores.end(e.message || e.cause);
    });

    ores.on("close", () => {
      creq.destroy(new Error("Response stream closed"));
    });
  };
};
