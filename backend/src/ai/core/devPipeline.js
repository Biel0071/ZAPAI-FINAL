const { analyzeProject } = require('./projectAnalyzer');

let pipeline = [];

function buildTaskId(prefix, value) {
  return `${prefix}_${String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
}

function createTask({ id, type, description, status = 'pending', priority = 'medium', meta = {} }) {
  return {
    id,
    type,
    description,
    status,
    priority,
    meta,
  };
}

function generatePipelineFromAnalysis(analysis) {
  const tasks = [];

  for (const missingPage of analysis.missingPages || []) {
    tasks.push(
      createTask({
        id: buildTaskId('create_page', missingPage.componentName),
        type: 'frontend',
        description: `Create missing page ${missingPage.componentName} for route ${missingPage.routePath}`,
        priority: 'high',
        meta: missingPage,
      })
    );
  }

  for (const missingApi of analysis.missingApis || []) {
    tasks.push(
      createTask({
        id: buildTaskId('implement_api', missingApi),
        type: 'backend',
        description: `Implement API endpoint ${missingApi}`,
        priority: 'high',
        meta: { endpoint: missingApi },
      })
    );
  }

  for (const missingComponent of analysis.missingComponents || []) {
    tasks.push(
      createTask({
        id: buildTaskId('fix_component_import', `${missingComponent.importer}_${missingComponent.importSource}`),
        type: 'frontend',
        description: `Fix missing component import ${missingComponent.importSource} used in ${missingComponent.importer}`,
        priority: 'medium',
        meta: missingComponent,
      })
    );
  }

  for (const unusedFile of analysis.unusedFiles || []) {
    tasks.push(
      createTask({
        id: buildTaskId('review_unused', unusedFile),
        type: 'cleanup',
        description: `Review unused file ${unusedFile}`,
        priority: 'low',
        meta: { file: unusedFile },
      })
    );
  }

  if (tasks.length === 0) {
    tasks.push(
      createTask({
        id: 'project_structure_ok',
        type: 'fullstack',
        description: 'Project analysis found no missing pages, APIs, or components.',
        status: 'done',
        priority: 'low',
      })
    );
  }

  return tasks;
}

async function refreshPipeline(options = {}) {
  const analysis = await analyzeProject(options);
  pipeline = generatePipelineFromAnalysis(analysis);
  return {
    analysis,
    pipeline,
  };
}

function listPipeline() {
  return pipeline;
}

function getPipelineTask(taskId) {
  return pipeline.find((task) => task.id === taskId) || null;
}

function updatePipelineTask(taskId, updates = {}) {
  pipeline = pipeline.map((task) => {
    if (task.id !== taskId) return task;
    return {
      ...task,
      ...updates,
    };
  });

  return getPipelineTask(taskId);
}

function addPipelineTask(task) {
  const normalizedTask = createTask(task);
  pipeline.push(normalizedTask);
  return normalizedTask;
}

module.exports = {
  addPipelineTask,
  generatePipelineFromAnalysis,
  getPipelineTask,
  listPipeline,
  refreshPipeline,
  updatePipelineTask,
};
