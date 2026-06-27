const pako = require('pako');
const payload = {
  pdfId: 'pdf-X',
  pageNum: 2,
  layers: { drawings: [{ id: 'a', kind: 'line' }] },
};
const compressed = pako.deflate(JSON.stringify(payload));
console.log(Buffer.isBuffer(compressed));
console.log(compressed instanceof Uint8Array);
