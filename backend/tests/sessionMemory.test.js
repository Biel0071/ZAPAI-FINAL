const test = require('node:test');
const assert = require('node:assert/strict');
const memoryService = require('../services/aiConversationMemoryService');

test('memory separates the same contact by account and connection; duplicate ids do not increase metrics', () => {
  const state = {};
  for (const [companyId,sessionId,text] of [['a','1','primeiro'],['a','2','segundo'],['b','1','terceiro']]) {
    memoryService.updateConversationMemory(state,{companyId,sessionId,contactId:'same',messageId:'id',text});
  }
  assert.equal(state.conversationMemory.length,3);
  const event={companyId:'a',sessionId:'1',contactId:'same',messageId:'id',text:'primeiro'};
  memoryService.updateConversationMemory(state,event);
  const found=memoryService.findMemoryByContact(state,'same',event);
  assert.equal(found.metrics.inboundMessages,1);
  assert.equal(found.messages[0].text,'primeiro');
  assert.equal(memoryService.findMemoryByContact(state,'same'),null);
});

const url = process.env.SESSION_MEMORY_TEST_DATABASE_URL || 'postgresql://postgres@127.0.0.1:5432/session_memory_test';
if (!url) test('PostgreSQL integration requires disposable session_memory_test database',{skip:true},()=>{});
else {
  const parsed = new URL(url);
  if (parsed.hostname !== '127.0.0.1' || parsed.pathname !== '/session_memory_test') throw new Error('Only local disposable session_memory_test is allowed.');
  process.env.DATABASE_URL=url;
  const {pool}=require('../src/infrastructure/config/database');
  const engine=require('../services/aiMemoryEngine');
  const agents=require('../src/ai/agents/services/aiAgentService');
  let server,origin;
  test.before(async()=>{
    await pool.query(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;
      CREATE TABLE sessions(company_id TEXT,session_id TEXT PRIMARY KEY,session_name TEXT,status TEXT,created_at TIMESTAMPTZ DEFAULT NOW());
      CREATE TABLE messages(id BIGSERIAL PRIMARY KEY,company_id TEXT,session_id TEXT,phone TEXT,remote_jid TEXT,conversation_id TEXT,
        whatsapp_message_id TEXT,text TEXT,content TEXT,from_me BOOLEAN,media_type TEXT,message_origin TEXT,timestamp TIMESTAMPTZ DEFAULT NOW(),created_at TIMESTAMPTZ DEFAULT NOW());
      CREATE TABLE system_settings(key TEXT PRIMARY KEY,value TEXT,updated_at TIMESTAMPTZ DEFAULT NOW());
      INSERT INTO sessions(company_id,session_id,session_name) VALUES('a','1','Um'),('a','2','Dois'),('b','3','Três');`);
    const migration=require('../migrations/035_session_agent_memory');
    await migration.up(pool); await migration.up(pool);
    const express=require('express');
    const {createHistoryRouter}=require('../src/ai/evolutionary/historyRoutes');
    const app=express(); app.use(express.json());
    app.use((req,res,next)=>{req.authTenantId=req.headers['x-test-account'];if(req.authTenantId)req.auth={role:req.headers['x-test-role'] || 'admin'};next();});
    const repository={owner:async id=>(await pool.query('SELECT company_id FROM sessions WHERE session_id=$1',[id])).rows[0]?.company_id,ensure:async()=>{}};
    app.use(createHistoryRouter({db:pool,repository,agentService:agents,analyze:async({message})=>{
      if(JSON.parse(message).prompt==='fail')throw new Error('provider down');
      return JSON.stringify({name:'Teste',personality:'Atenda com clareza.'});
    }}));
    server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
    origin='http://127.0.0.1:'+server.address().port;
  });
  test.after(async()=>{if(server)await new Promise(r=>server.close(r));await pool.end();});
  const request=(path,method='GET',body,account='a',role='admin')=>fetch(origin+path,{method,headers:{'content-type':'application/json','x-test-account':account,'x-test-role':role},body:body?JSON.stringify(body):undefined});
  test('durable projection isolates numbers, deduplicates replay and recovers after cache reset',async()=>{
    for(const [company,session,text] of [['a','1','Preciso de 20 unidades'],['a','2','Quero atendimento técnico'],['b','3','Privado']]) {
      await pool.query(`INSERT INTO messages(company_id,session_id,phone,whatsapp_message_id,text,from_me) VALUES($1,$2,'5511999999999','same',$3,FALSE)`,[company,session,text]);
    }
    assert.equal(await engine.projectPending(),3);
    assert.equal(await engine.projectPending(),0);
    const first=(await engine.searchPersisted('a','1'))[0];
    assert.match(first.summary,/20 unidades/);
    assert.doesNotMatch(JSON.stringify(first),/técnico|Privado/);
    await pool.query(`INSERT INTO messages(company_id,session_id,phone,whatsapp_message_id,text,from_me) VALUES('a','1','5511999999999','same','duplicada',FALSE)`);
    await engine.projectPending('a','1');
    assert.equal((await engine.loadEntry('a','1','5511999999999')).metrics.inboundMessages,1);
    const fresh={}; await engine.loadMemoryFromPostgres(fresh,'a','1');
    assert.equal(fresh.conversationMemory.length,1);
    assert.equal((await engine.status('a','1')).pending,0);
    await assert.rejects(()=>engine.searchPersisted('b','1'));
  });
  test('failed projection rolls back receipts and retries without data loss',async()=>{
    await pool.query(`INSERT INTO messages(company_id,session_id,phone,whatsapp_message_id,text,from_me) VALUES('a','1','retry','retry','Retomar',FALSE);
      CREATE FUNCTION fail_memory() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test failure'; END $$;
      CREATE TRIGGER fail_memory BEFORE INSERT ON ai_conversation_memory FOR EACH ROW EXECUTE FUNCTION fail_memory();`);
    await assert.rejects(()=>engine.projectPending('a','1'));
    assert.equal((await engine.status('a','1')).pending,1);
    assert.equal((await pool.query(`SELECT COUNT(*)::int AS n FROM ai_memory_receipts WHERE event_key='retry'`)).rows[0].n,0);
    await pool.query('DROP TRIGGER fail_memory ON ai_conversation_memory; DROP FUNCTION fail_memory()');
    await engine.projectPending('a','1');
    assert.equal((await engine.loadEntry('a','1','retry')).messages.length,1);
  });
  test('optional store link grants knowledge, unlink preserves own memory and revokes knowledge',async()=>{
    const response=await request('/stores','POST',{name:'Loja',knowledge:'Entrega em dois dias.'});
    assert.equal(response.status,201);const {id}=await response.json();
    assert.equal((await request('/1/profile','PUT',{storeId:id})).status,200);
    assert.match(await agents.sessionKnowledge('a','1'),/dois dias/);
    assert.equal(await agents.sessionKnowledge('a','2'),'');
    assert.equal((await request('/3/profile','PUT',{storeId:id},'b')).status,404);
    await request('/1/profile','PUT',{storeId:null});
    assert.equal(await agents.sessionKnowledge('a','1'),'');
    assert.ok(await engine.loadEntry('a','1','retry'));
  });
  test('manual/prompt preview requires review and connection ownership before activation',async()=>{
    assert.equal((await request('/1/profile','GET',null,'')).status,401);
    assert.equal((await request('/1/preview','POST',{prompt:'Atenda vendas'},'a','viewer')).status,403);
    assert.equal((await request('/3/preview','POST',{prompt:'Atenda vendas'})).status,404);
    assert.equal((await request('/1/preview','POST',{prompt:'fail'})).status,503);
    const result=await request('/1/preview','POST',{prompt:'Atenda vendas'});
    assert.equal(result.status,200);const {candidate}=await result.json();assert.equal(candidate.active,false);
    assert.equal((await request('/1/agents','POST',candidate)).status,400);
    assert.equal((await request('/1/agents','POST',{...candidate,reviewed:true,sessionIds:['3']})).status,503);
    const created=await request('/1/agents','POST',{...candidate,reviewed:true});
    assert.equal(created.status,201);
    const {agent}=await created.json();assert.deepEqual(agent.sessionIds,['1']);assert.equal(agent.active,true);
  });
  test('automatic style is connection-specific, versioned and restorable; commercial fields cannot be applied',async()=>{
    const agent=(await agents.listAgents('a'))[0];
    await pool.query(`INSERT INTO messages(company_id,session_id,phone,whatsapp_message_id,text,from_me,message_origin)
      SELECT 'a','1','human','human-'||n,'Olá! Posso ajudar?',TRUE,'human' FROM generate_series(1,10) n`);
    await engine.projectPending();await agents.evolveSessionStyles();
    const versions=(await pool.query("SELECT * FROM ai_agent_versions WHERE company_id=$1 AND session_id=$2 AND agent_key=$3 AND reason IN ('baseline','automatic_style') ORDER BY id",['a','1',agent.key])).rows;
    assert.equal(versions.length,2);assert.equal(versions[1].reason,'automatic_style');
    assert.deepEqual(agents.validateStyle({tone:'friendly',prices:'100',personality:'new rules',responseStyle:'evil'}),{tone:'friendly'});
    assert.equal((await agents.withSessionStyle(agent,'a','2')).responseStyle,agent.responseStyle);
    await agents.restoreSessionStyle('a','1',agent.key,versions[0].id);
    assert.equal((await pool.query(`SELECT evolution_mode FROM session_ai_profiles WHERE company_id='a' AND session_id='1'`)).rows[0].evolution_mode,'paused');
  });
  test('projectPending preserves forward chronological order across multiple batches',async()=>{
    // Insert 4 messages with distinct timestamps
    await pool.query(`
      INSERT INTO messages(company_id,session_id,phone,whatsapp_message_id,text,from_me,timestamp) VALUES
        ('a','1','5511888888888','t1','Meu nome é Lucas',FALSE,NOW() - INTERVAL '4 minutes'),
        ('a','1','5511888888888','t2','Moro em Campinas',FALSE,NOW() - INTERVAL '3 minutes'),
        ('a','1','5511888888888','t3','Prefiro pagamento via PIX',FALSE,NOW() - INTERVAL '2 minutes'),
        ('a','1','5511888888888','t4','Vou querer 10 unidades',FALSE,NOW() - INTERVAL '1 minute')
    `);
    // Project in batches of 2
    assert.equal(await engine.projectPending('a','1',2),2);
    assert.equal(await engine.projectPending('a','1',2),2);
    const entry=await engine.loadEntry('a','1','5511888888888');
    assert.equal(entry.messages.length,4);
    assert.equal(entry.messages[0].text,'Meu nome é Lucas');
    assert.equal(entry.messages[3].text,'Vou querer 10 unidades');
  });
  test('restoreSessionStyle handles snapshots with deleted sessions gracefully',async()=>{
    const agent=(await agents.listAgents('a'))[0];
    // Insert a version snapshot containing a deleted session '999'
    const snapshotWithDeletedSession = { ...agent, name: 'Atendente Restaurado', sessionIds: ['1', '999'] };
    const inserted=(await pool.query(`INSERT INTO ai_agent_versions(company_id,session_id,agent_key,snapshot,reason)
      VALUES('a','1',$1,$2,'test_deleted_session') RETURNING id`,[agent.key,JSON.stringify(snapshotWithDeletedSession)])).rows[0];
    const restored = await agents.restoreSessionStyle('a','1',agent.key,inserted.id);
    assert.equal(restored.name,'Atendente Restaurado');
    // Session '999' is excluded because it does not exist, but session '1' is preserved
    assert.deepEqual(restored.sessionIds,['1']);
  });
  test('restore endpoint validates numeric versionId and returns 400 for invalid format',async()=>{
    const res = await request('/1/versions/camila/invalid-id/restore','POST');
    assert.equal(res.status,400);
    const body = await res.json();
    assert.match(body.error,/ID de versão inválido/);
  });
  test('historical session migration projects proven scopes and skips ambiguous ownership',async()=>{
    await pool.query(`CREATE TABLE conversations(id TEXT PRIMARY KEY,company_id TEXT,session_id TEXT);
      INSERT INTO conversations(id,company_id,session_id) VALUES
        ('archive-conv','a','archive-1'),('shared-a','a','shared'),('shared-b','b','shared');
      INSERT INTO messages(company_id,session_id,conversation_id,phone,text,from_me) VALUES
        ('a','archive-1','archive-conv','5511777777777','Histórico confirmado',FALSE),
        ('a','shared','shared-a','5511666666666','Origem A',FALSE),
        ('b','shared','shared-b','5511555555555','Origem B',FALSE);`);
    const migration=require('../migrations/036_recover_historical_memory_sessions');
    await migration.up(pool);
    await migration.up(pool);
    const archived=(await pool.query(`SELECT company_id,status FROM sessions WHERE session_id='archive-1'`)).rows;
    assert.deepEqual(archived,[{company_id:'a',status:'archived'}]);
    assert.equal((await pool.query(`SELECT COUNT(*)::int AS n FROM sessions WHERE session_id='shared'`)).rows[0].n,0);
    assert.equal(await engine.projectPending('a','archive-1'),1);
    assert.match((await engine.loadEntry('a','archive-1','5511777777777')).summary,/Histórico confirmado/);
  });
}
