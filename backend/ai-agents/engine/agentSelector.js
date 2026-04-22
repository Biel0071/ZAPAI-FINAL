function selectRandomActiveAgent(agents = []) {
  const activeAgents = (agents || []).filter((agent) => agent && agent.active !== false);

  if (activeAgents.length === 0) {
    return null;
  }

  const index = Math.floor(Math.random() * activeAgents.length);
  return activeAgents[index] || null;
}

module.exports = {
  selectRandomActiveAgent,
};
