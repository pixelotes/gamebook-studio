const { Worker } = require('worker_threads');
const path = require('path');

const computeWorker = new Worker(path.join(__dirname, '../workers/serverWorker.js'));
const pendingTasks = new Map();
let taskIdCounter = 0;

computeWorker.on('message', ({ id, success, result, error }) => {
  const task = pendingTasks.get(id);
  if (task) {
    if (success) task.resolve(result);
    else task.reject(new Error(error));
    pendingTasks.delete(id);
  }
});

function runWorkerTask(type, payload) {
  return new Promise((resolve, reject) => {
    const id = taskIdCounter++;
    pendingTasks.set(id, { resolve, reject });
    computeWorker.postMessage({ id, type, payload });
  });
}

module.exports = { runWorkerTask, computeWorker };
