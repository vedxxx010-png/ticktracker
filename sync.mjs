import { getStore } from "@netlify/blobs";

export const config = { path: "/api/sync" };

const enc = new TextEncoder();
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const rnd = (n) => hex(crypto.getRandomValues(new Uint8Array(n)));
const sha = async (s) => hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
const hashPass = async (pass, salt) => {
  const key = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: 100000, hash: "SHA-256" }, key, 256));
};
const json = (o, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export default async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  let b;
  try { b = await req.json(); } catch { return json({ error: "Bad request" }, 400); }

  const user = String(b.user || "").trim().toLowerCase();
  if (!/^[a-z0-9_.-]{3,24}$/.test(user)) return json({ error: "ID: 3–24 letters, numbers, dot, dash or underscore." }, 400);

  const store = getStore("planner-users");
  const key = "u-" + user;
  const rec = await store.get(key, { type: "json" });

  if (b.action === "register") {
    const pass = String(b.pass || "");
    if (pass.length < 6 || pass.length > 200) return json({ error: "Passcode needs 6–200 characters." }, 400);
    if (rec) return json({ error: "That ID is taken. Pick another or sign in." }, 409);
    const salt = rnd(16), token = rnd(24);
    await store.setJSON(key, { salt, hash: await hashPass(pass, salt), tokens: [await sha(token)], data: null });
    return json({ token });
  }

  if (b.action === "login") {
    const pass = String(b.pass || "");
    if (!rec || (await hashPass(pass, rec.salt)) !== rec.hash) return json({ error: "Wrong ID or passcode." }, 401);
    const token = rnd(24);
    rec.tokens = [...rec.tokens.slice(-4), await sha(token)];
    await store.setJSON(key, rec);
    return json({ token, data: rec.data });
  }

  // load / save need a valid session token
  if (!rec || !rec.tokens.includes(await sha(String(b.token || "")))) return json({ error: "Please sign in again." }, 401);

  if (b.action === "load") return json({ data: rec.data });

  if (b.action === "save") {
    const d = b.data || {};
    const data = {
      done: typeof d.done === "object" && d.done ? d.done : {},
      sel: Number.isInteger(d.sel) ? d.sel : 0,
      start: typeof d.start === "string" ? d.start.slice(0, 10) : "",
      notes: typeof d.notes === "object" && d.notes ? d.notes : {},
      t: Number(d.t) || 0,
    };
    if (JSON.stringify(data).length > 100000) return json({ error: "Too much data." }, 413);
    rec.data = data;
    await store.setJSON(key, rec);
    return json({ ok: true });
  }

  return json({ error: "Unknown action" }, 400);
};
