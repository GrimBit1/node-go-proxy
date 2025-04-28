import { request } from "http";

const { request } = require('http');

const FormData = require('form-data');
const { Readable } = require('stream');

/**
 * Rebuilds form-data from Express request
 * @param {Request} oreq - Express request object
 * @returns {FormData} form-data instance
 */
const rebuildFormDataFromRequest = (oreq) => {
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

  // Append single file
  if (oreq.file) {
    const stream = Readable.from(oreq.file.buffer);
    form.append(oreq.file.fieldname, stream, {
      filename: oreq.file.originalname,
      contentType: oreq.file.mimetype,
    });
  }

  // Append multiple files
  if (oreq.files) {
    const filesArray = Array.isArray(oreq.files) ? oreq.files : convertMulterFilesToArray(oreq.files);
    filesArray.forEach((file) => {
      const stream = Readable.from(file.data);
      form.append(file.fieldname, stream, {
        filename: file.name,
        contentType: file.mimetype,
      });
    });
  }

  return form;
}

const convertMulterFilesToArray = (files) => {
  if (!files) {
    return [];
  }

  const fields = Object.keys(files);
  const filesArray = [];
  for (const field of fields) {
    const file = files[field];
    if (Array.isArray(file)) {
      file.forEach((f) => {
        f.fieldname = field;
      })
      filesArray.push(...file);
    } else {
      file.fieldname = field;
      filesArray.push(file);
    }
  }
  return filesArray;

}

const expressMiddlewareProxy = ({ host, port, path, method, headers, shouldImplementUserId } = {}) => {
  return (oreq, ores) => {
    const reqOptions = {
      host: host ?? process.env.GO_HOST ?? 'localhost',
      port: port ?? process.env.GO_PORT ?? 80,
      path: path ?? oreq.url,
      method: method ?? oreq.method,
      headers: { ...oreq.headers, ...(headers ?? {}) },
    };

    if (oreq.body) {
      delete reqOptions.headers['content-length']; // Let it be auto calculated
    }

    let requestBodyStream = null;

    const contentType = oreq.headers['content-type'] || '';

    if (contentType.includes('multipart/form-data') && (oreq.file || oreq.files)) {
      // Rebuild form-data
      const form = rebuildFormDataFromRequest(oreq);
      // Add user ID to the form data if needed
      if (shouldImplementUserId) {
        form.append('user', oreq.user.id);
      }
      requestBodyStream = form;
      // Update headers
      reqOptions.headers = {
        ...reqOptions.headers,
        ...form.getHeaders(),
      };
    } else if (oreq.body) {
      if (shouldImplementUserId) {
        // Add user ID to the request body
        oreq.body.user = oreq.user.id;
      }
      // Normal JSON
      const jsonString = JSON.stringify(oreq.body);
      requestBodyStream = Readable.from([jsonString]);
      reqOptions.headers['content-type'] = 'application/json';
    }

    const creq = request(reqOptions, (pres) => {
      ores.writeHead(pres.statusCode ?? 500, pres.headers);
      pres.pipe(ores);

      pres.on('end', () => {
        console.log('Proxied response ended');
        ores.end();
      });

      pres.on('error', (err) => {
        console.error('Proxied response error:', err);
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

    oreq.on('error', (err) => {
      console.error('Original request error:', err);
      creq.destroy();
    });

    creq.on('error', (e) => {
      console.log(e);
      if (e.message === 'Response stream closed') {
        console.log('Original request closed');
        return;
      }
      console.error('Proxy request error:', e.message ?? e.errors);
      ores.writeHead(500);
      ores.end(e.message || e.errors.toString());
    });

    ores.on('close', () => {
      creq.destroy(new Error('Response stream closed'));
    });
  };
};


module.exports = expressMiddlewareProxy;