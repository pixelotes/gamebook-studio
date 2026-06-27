import { create } from 'jsondiffpatch';
import * as pako from 'pako'

const diffpatcher = create({
  objectHash: (obj) => obj.id || JSON.stringify(obj),
});

self.onmessage = (e) => {
  const { id, type, payload } = e.data;

  try {
    let result;
    if (type === 'patch') {
      result = diffpatcher.patch(payload.state, payload.delta);
    } else if (type === 'deflate') {
      result = pako.deflate(JSON.stringify(payload.data));
    } else if (type === 'inflate') {
      result = JSON.parse(pako.inflate(payload.data, { to: 'string' }));
    } else {
    }
    self.postMessage({ id, success: true, result });
  } catch (error) {
    self.postMessage({ id, success: false, error: error.message });
  }
};