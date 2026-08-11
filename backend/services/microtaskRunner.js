const path = require('path');
const { getLogger } = require('./logger');

const logger = getLogger('microtasks');
const taskCache = new Map();

function loadTask(taskName) {
  if (!taskCache.has(taskName)) {
    let taskModule;
    try {
      taskModule = require(path.join(__dirname, '..', 'src', 'infrastructure', 'microtasks', taskName));
    } catch (_) {
      try {
        taskModule = require(path.join(__dirname, '..', 'microtasks', taskName));
      } catch (err) {
        throw new Error(`Microtask "${taskName}" not found: ${err.message}`);
      }
    }
    taskCache.set(taskName, taskModule);
  }

  return taskCache.get(taskName);
}

async function runTask(taskName, payload = {}) {
  logger.info(`[Microtask] running task ${taskName}`);

  try {
    const taskModule = loadTask(taskName);
    const result = await taskModule.runTask(payload);
    logger.info(`[Microtask] completed task ${taskName}`);
    return result;
  } catch (error) {
    logger.error(`[Microtask] failed task ${taskName}`, {
      message: error.message,
      stack: error.stack,
      taskName,
    });

    return {
      ...payload,
      microtaskErrors: [
        ...(payload.microtaskErrors || []),
        {
          message: error.message || String(error),
          taskName,
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }
}

module.exports = {
  runTask,
};
