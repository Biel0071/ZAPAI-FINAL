const aiAgentService = require('../src/ai/agents/services/aiAgentService');

async function giveTipToAgent(agentName, tipText, tenantId = 'default') {
  try {
    const agents = await aiAgentService.listAgents(tenantId);
    const agent = agents.find(a => a.name.toLowerCase().includes(agentName.toLowerCase()));
    
    if (!agent) {
      console.error(`Agent '${agentName}' not found.`);
      process.exit(1);
    }

    console.log(`[+] Encontrado agente: ${agent.name}`);
    console.log(`[+] Memória Atual:\n${agent.memory || '(vazia)'}\n`);

    const newMemoryEntry = `\n[Informação Aprendida / Dica do Gestor]: ${tipText}`;
    
    const updatedMemory = (agent.memory || '') + newMemoryEntry;
    
    await aiAgentService.updateAgent(agent.key, { memory: updatedMemory }, tenantId);
    
    console.log(`[+] Dica acoplada com sucesso à memória global da atendente ${agent.name}!`);
    console.log(`[+] Nova Memória Consolidada:\n${updatedMemory}`);
    
    process.exit(0);
  } catch (err) {
    console.error('Erro ao dar dica ao agente:', err);
    process.exit(1);
  }
}

const args = process.argv.slice(2);
const agentName = args[0] || 'Camila';
const tip = args.slice(1).join(' ') || `Este é nosso instagram, nós siga para participar das promoções da loja!! Por lá você acompanha nosso trabalho https://www.instagram.com/materiais_de_construcaomg_/ Esté é nosso site, por ele você pode realizar o pedido de maneira rápido e fácil. materialdecontrucao.online`;

giveTipToAgent(agentName, tip);
