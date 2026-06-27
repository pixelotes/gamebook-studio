const { parentPort } = require('worker_threads');
const jsondiffpatch = require('jsondiffpatch');
const pako = require('pako');

const diffpatcher = jsondiffpatch.create({
  objectHash: (obj) => obj.id || JSON.stringify(obj),
  arrays: { detectMove: true }
});

parentPort.on('message', ({ id, type, payload }) => {
  try {
    let result;
    if (type === 'diff') {
      result = diffpatcher.diff(payload.previousState, payload.newState);
    } else if (type === 'inflate') {
      result = JSON.parse(pako.inflate(payload.data, { to: 'string' }));
    } else {
      throw new Error(`Unknown task type: ${type}`);
    }
    parentPort.postMessage({ id, success: true, result });
  } catch (error) {
    parentPort.postMessage({ id, success: false, error: error.message });
  }
});