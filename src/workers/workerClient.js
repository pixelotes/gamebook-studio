const worker = new Worker(new URL('./clientWorker.js', import.meta.url), { type: 'module' });
const pendingTasks = new Map();
let taskIdCounter = 0;

worker.onmessage = (e) => {
  const { id, success, result, error } = e.data;
  const task = pendingTasks.get(id);
  if (task) {
    if (success) task.resolve(result);
    else task.reject(new Error(error));
    pendingTasks.delete(id);
  }
};

export function runClientWorkerTask(type, payload) {
  return new Promise((resolve, reject) => {
    const id = taskIdCounter++;
    pendingTasks.set(id, { resolve, reject });
    worker.postMessage({ id, type, payload });
  });
}
