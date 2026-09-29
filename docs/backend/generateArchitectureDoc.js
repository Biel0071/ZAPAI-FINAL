const fs = require('fs/promises');
const path = require('path');
const { Document, Packer, Paragraph, HeadingLevel, TextRun } = require('docx');

async function generateDoc() {
  const sections = [
    { title: 'System overview', body: 'ZapAI CRM backend uses Express, PostgreSQL, Socket.IO, Baileys, microtasks, diagnostics, and AI-assisted automation.' },
    { title: 'Folder structure', body: 'controllers, services, repositories, routes, microtasks, tests, logs, tools, docs, ai-prompts.' },
    { title: 'API endpoints', body: 'Sessions, messages, conversations, AI toggle, system runtime control, diagnostics.' },
    { title: 'Database schema', body: 'sessions, leads, conversations, messages, system_settings.' },
    { title: 'Socket events', body: 'session_qr, session_connected, session_disconnected, session_deleted, session_status, new_message, system_error.' },
    { title: 'AI integration flow', body: 'Incoming message -> persistence -> optional AI response depending on ai_enabled setting.' },
    { title: 'Campaign system', body: 'Background campaign runtime evaluates conversations and emits campaign snapshots.' },
    { title: 'Inbox system', body: 'Baileys messages are persisted as leads, conversations, and messages before real-time emission.' },
  ];

  const document = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: 'ZapAI CRM System Architecture', heading: HeadingLevel.TITLE }),
          ...sections.flatMap((section) => [
            new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ children: [new TextRun(section.body)] }),
          ]),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(document);
  const outputPath = path.join(process.cwd(), 'docs', 'system_architecture.docx');
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, buffer);
}

if (require.main === module) {
  generateDoc().then(() => console.log('DOCX generated'));
}

module.exports = {
  generateDoc,
};
