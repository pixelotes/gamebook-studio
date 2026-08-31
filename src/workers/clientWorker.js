import * as pako from 'pako'

self.onmessage = (e) => {
  const { id, type, payload } = e.data;

  try {
    if (type !== 'deflate') {
      throw new Error(`Unknown task type: ${type}`);
    }
    const result = pako.deflate(JSON.stringify(payload.data));
    self.postMessage({ id, success: true, result });
  } catch (error) {
    self.postMessage({ id, success: false, error: error.message });
  }
};