// Storage shim that mimics the window.storage API used inside Claude
// artifacts, but talks to a real backend (Cloudflare Pages Function +
// KV) so data is genuinely shared across every device and user.
//
// It calls:
//   GET    /api/storage?key=...          -> { key, value, shared }
//   POST   /api/storage  { key, value }  -> { key, value, shared }
//   DELETE /api/storage?key=...          -> { key, deleted, shared }
//   GET    /api/storage-list?prefix=...  -> { keys, prefix, shared }
// The Pages Functions in /functions/api/ store everything in a single
// Cloudflare KV namespace bound as ACCIDENTS_KV.
//
// Falls back to localStorage if the API is unreachable (e.g. while
// testing locally without `wrangler pages dev`), so the app still works
// during local development.

const LOCAL_PREFIX = "accident-tracker:";

function localReadAll() {
  try {
    const raw = localStorage.getItem(LOCAL_PREFIX + "data");
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}
function localWriteAll(obj) {
  localStorage.setItem(LOCAL_PREFIX + "data", JSON.stringify(obj));
}

async function apiGet(key) {
  const res = await fetch(`/api/storage?key=${encodeURIComponent(key)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("storage GET failed");
  return res.json();
}
async function apiSet(key, value) {
  const res = await fetch("/api/storage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value }),
  });
  if (!res.ok) throw new Error("storage POST failed");
  return res.json();
}
async function apiDelete(key, adminToken) {
  const headers = {};
  if (adminToken) headers["X-Admin-Token"] = adminToken;
  const res = await fetch(`/api/storage?key=${encodeURIComponent(key)}`, { method: "DELETE", headers });
  if (res.status === 403) throw new Error("forbidden");
  if (!res.ok) throw new Error("storage DELETE failed");
  return res.json();
}
async function apiList(prefix) {
  const res = await fetch(`/api/storage-list?prefix=${encodeURIComponent(prefix || "")}`);
  if (!res.ok) throw new Error("storage LIST failed");
  return res.json();
}
async function apiGetAll(prefix) {
  const res = await fetch(`/api/storage-getall?prefix=${encodeURIComponent(prefix || "")}`);
  if (!res.ok) throw new Error("storage GETALL failed");
  return res.json();
}

const storage = {
  async get(key, shared = false) {
    // "shared" (battalion-wide) data goes through the API; personal
    // per-device data (like the logged-in user's own name) stays local.
    if (!shared) {
      const all = localReadAll();
      return key in all ? { key, value: all[key], shared: false } : null;
    }
    try {
      return await apiGet(key);
    } catch (e) {
      const all = localReadAll();
      return key in all ? { key, value: all[key], shared: false } : null;
    }
  },
  async set(key, value, shared = false) {
    if (!shared) {
      const all = localReadAll();
      all[key] = value;
      localWriteAll(all);
      return { key, value, shared: false };
    }
    try {
      return await apiSet(key, value);
    } catch (e) {
      const all = localReadAll();
      all[key] = value;
      localWriteAll(all);
      return { key, value, shared: false };
    }
  },
  async delete(key, shared = false, adminToken = null) {
    if (!shared) {
      const all = localReadAll();
      const existed = key in all;
      delete all[key];
      localWriteAll(all);
      return { key, deleted: existed, shared: false };
    }
    // For shared deletes we let errors propagate so the UI can tell the
    // difference between success and a rejected (forbidden) request.
    return await apiDelete(key, adminToken);
  },
  async list(prefix = "", shared = false) {
    if (!shared) {
      const all = localReadAll();
      return { keys: Object.keys(all).filter((k) => k.startsWith(prefix)), prefix, shared: false };
    }
    try {
      return await apiList(prefix);
    } catch (e) {
      return { keys: [], prefix, shared: true };
    }
  },
  async getAll(prefix = "", shared = false) {
    if (!shared) {
      const all = localReadAll();
      const items = Object.keys(all)
        .filter((k) => k.startsWith(prefix))
        .map((k) => ({ key: k, value: all[k] }));
      return { items, prefix, shared: false };
    }
    try {
      return await apiGetAll(prefix);
    } catch (e) {
      const all = localReadAll();
      const items = Object.keys(all)
        .filter((k) => k.startsWith(prefix))
        .map((k) => ({ key: k, value: all[k] }));
      return { items, prefix, shared: false };
    }
  },
};

if (typeof window !== "undefined") {
  window.storage = storage;
}

export default storage;
