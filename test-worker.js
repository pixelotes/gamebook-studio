const { Worker } = require('worker_threads');
const pako = require('pako');
const path = require('path');

const computeWorker = new Worker(path.join(__dirname, 'src/workers/serverWorker.js'));

const payload = {
  pdfId: 'pdf-X',
  pageNum: 2,
  layers: { drawings: [{ id: 'a', kind: 'line' }] },
};
const compressed = pako.deflate(JSON.stringify(payload));
// compressed is Uint8Array
const buf = Buffer.from(compressed);

computeWorker.on('message', (msg) => {
  console.log('Worker reply:', msg);
  process.exit(0);
});

computeWorker.postMessage({ id: 1, type: 'inflate', payload: { data: buf } });
