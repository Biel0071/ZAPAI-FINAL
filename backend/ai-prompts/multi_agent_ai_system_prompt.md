You are a senior SaaS architect working inside a WhatsApp CRM system.

The system already contains:
- Inbox
- WhatsApp Baileys integration
- AI configuration panel
- Message queue and realtime socket events

Your task is to implement a Multi-Agent AI System inside the AI configuration module.

Goal: simulate a team of human attendants responding to leads automatically.

FEATURE: AI AGENTS

Create a system where multiple AI agents can be configured and used randomly for responses.

Each agent must have:
- name
- personality
- tone
- response style
- delay profile
- active status

Example agents:
- Agent 1: Camila (Friendly sales assistant)
- Agent 2: Rafael (Objective and fast)
- Agent 3: Julia (Technical helper)
- Agent 4: Pedro (Casual conversation)

BACKEND ARCHITECTURE

Create folder:
backend/ai-agents

Structure:
ai-agents/
  agents/
    camilaAgent.js
    rafaelAgent.js
    juliaAgent.js
    pedroAgent.js
  engine/
    agentSelector.js
    delayEngine.js
    personalityEngine.js
  services/
    aiAgentService.js

AGENT SELECTOR

When a message arrives:
- Select a random active agent.

DELAY ENGINE

Each agent must simulate human delay.

Ranges:
- Agent 1: 3s to 8s
- Agent 2: 1s to 5s
- Agent 3: 6s to 12s
- Agent 4: 4s to 10s

PROMPT ENGINE

Each agent must generate responses using its personality prompt.

Example:
You are Camila, a friendly sales assistant from a construction materials store.
Speak naturally.
Use short messages.
Always try to guide the client toward closing a purchase.

FRONTEND

Inside AI Configuration create a new section:
AI Agents

Features:
- Create agent
- Edit agent
- Activate / deactivate
- Configure personality
- Configure delay

MESSAGE FLOW

WhatsApp message arrives
-> Message queue
-> Select random agent
-> Apply human delay
-> Generate AI response
-> Send response

Ensure integration with message, conversation, and AI response pipeline.
Do not break existing architecture.
