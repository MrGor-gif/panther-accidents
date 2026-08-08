export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/storage") {
      if (request.method === "GET") {
        const key = url.searchParams.get("key");
        if (!key) return json({ error: "missing key" }, 400);
        const value = await env.ACCIDENTS_KV.get(key);
        if (value === null) return json({ error: "not found" }, 404);
        return json({ key, value, shared: true });
      }
      if (request.method === "POST") {
        let body;
        try {
          body = await request.json();
        } catch (e) {
          return json({ error: "invalid json body" }, 400);
        }
        const { key, value } = body || {};
        if (!key || typeof value !== "string") {
          return json({ error: "key and string value are required" }, 400);
        }
        await env.ACCIDENTS_KV.put(key, value);
        return json({ key, value, shared: true });
      }
      if (request.method === "DELETE") {
        const key = url.searchParams.get("key");
        if (!key) return json({ error: "missing key" }, 400);
        await env.ACCIDENTS_KV.delete(key);
        return json({ key, deleted: true, shared: true });
      }
    }

    if (url.pathname === "/api/storage-list" && request.method === "GET") {
      const prefix = url.searchParams.get("prefix") || "";
      const list = await env.ACCIDENTS_KV.list({ prefix });
      const keys = list.keys.map((k) => k.name);
      return json({ keys, prefix, shared: true });
    }

    return env.ASSETS.fetch(request);
  },
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
