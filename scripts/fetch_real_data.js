import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import { fileURLToPath } from "node:url";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VPS_HOST = process.env.VPS_HOST || "https://209.50.241.22";
const JWT_SECRET = process.env.JWT_SECRET || "";

function generateAdminToken() {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: "zapadmin",
    username: "zapadmin",
    tenantId: "default",
    companyId: "default",
    role: "master",
    iat: now,
    exp: now + 86400 * 7,
  };

  const toB64Url = (obj) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  const sData = `${toB64Url(header)}.${toB64Url(payload)}`;
  const sig = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(sData)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${sData}.${sig}`;
}

async function apiFetch(endpoint) {
  const token = generateAdminToken();
  const url = `${VPS_HOST}${endpoint}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status} for ${endpoint}: ${await res.text()}`);
  }
  return res.json();
}

async function run() {
  console.log("[1/4] Fetching real sessions...");
  const sessionsRes = await apiFetch("/api/sessions");
  const sessions = sessionsRes.data || sessionsRes.sessions || [];

  console.log(`[2/4] Fetching real conversations... (found sessions: ${sessions.length})`);
  const convsRes = await apiFetch("/api/conversations?limit=60&sessionId=main");
  const conversations = convsRes.data || convsRes.conversations || [];
  console.log(`Found ${conversations.length} real conversations.`);

  // Find a conversation with substantial messages (e.g. Sueli Silva id 10506 or ju Alisson id 16737)
  let targetConv = conversations.find((c) => String(c.id) === "10506") || conversations[0];
  console.log(`[3/4] Fetching real messages for conversation ${targetConv.id} (${targetConv.name || targetConv.contactName})...`);
  const msgsRes = await apiFetch(`/api/conversations/${targetConv.id}/messages`);
  const messages = msgsRes.data || msgsRes.messages || [];
  console.log(`Found ${messages.length} real messages for conversation ${targetConv.id}.`);

  console.log("[4/4] Fetching real quick replies...");
  const qrRes = await apiFetch("/api/quick-replies");
  const quickReplies = qrRes.data || qrRes.items || [];
  console.log(`Found ${quickReplies.length} real quick replies.`);

  const realData = {
    sessions,
    conversations,
    selectedConversation: targetConv,
    messages,
    quickReplies,
    fetchedAt: new Date().toISOString(),
  };

  const outputPath = path.resolve(__dirname, "real_inbox_data.json");
  fs.writeFileSync(outputPath, JSON.stringify(realData, null, 2), "utf8");
  console.log(`[SUCCESS] Real inbox data exported to: ${outputPath}`);
}

run().catch((err) => {
  console.error("[ERROR]", err);
  process.exit(1);
});
