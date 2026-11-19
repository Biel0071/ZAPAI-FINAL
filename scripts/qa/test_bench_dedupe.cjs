const count = 6737;
const arr = [];
for (let i = 0; i < count; i++) {
  arr.push({ id: "conv-" + i, phone: "553199999" + String(i).padStart(4, "0"), sessionId: "main" });
}

function cleanDigits(p) {
  return (p || "").replace(/\D/g, "");
}

function isPhoneMatch(p1, p2) {
  if (!p1 || !p2) return false;
  const c1 = cleanDigits(p1);
  const c2 = cleanDigits(p2);
  if (c1 === c2) return true;
  const s1 = c1.startsWith("55") && c1.length > 10 ? c1.slice(2) : c1;
  const s2 = c2.startsWith("55") && c2.length > 10 ? c2.slice(2) : c2;
  if (s1 === s2) return true;
  if (s1.length >= 8 && s2.length >= 8) {
    return s1.slice(-8) === s2.slice(-8);
  }
  return false;
}

// 1. Array findIndex (Current appStore.ts behavior)
const t0 = performance.now();
const nextConversations = [];
for (const conv of arr) {
  const existingIdx = nextConversations.findIndex(existing => isPhoneMatch(existing.phone, conv.phone));
  if (existingIdx === -1) {
    nextConversations.push(conv);
  }
}
const elapsedFindIndex = performance.now() - t0;
console.log(`[O(N^2) findIndex] 6737 items took: ${elapsedFindIndex.toFixed(1)}ms`);

// 2. Map-indexed lookup (Target behavior)
const t1 = performance.now();
const dedupedList = [];
const phoneIndex = new Map();
for (const conv of arr) {
  const c = cleanDigits(conv.phone);
  const s = c.startsWith("55") && c.length > 10 ? c.slice(2) : c;
  const last8 = s.length >= 8 ? s.slice(-8) : s;
  
  const existingIdx = phoneIndex.get(c) ?? phoneIndex.get(s) ?? phoneIndex.get(last8);
  if (existingIdx === undefined) {
    const idx = dedupedList.length;
    dedupedList.push(conv);
    phoneIndex.set(c, idx);
    phoneIndex.set(s, idx);
    if (last8) phoneIndex.set(last8, idx);
  }
}
const elapsedMap = performance.now() - t1;
console.log(`[O(N) Map] 6737 items took: ${elapsedMap.toFixed(1)}ms`);
console.log(`Speedup: ${(elapsedFindIndex / elapsedMap).toFixed(1)}x faster!`);
