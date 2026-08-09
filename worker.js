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
        // Deletion is restricted to the manager device. If an admin token
        // has been configured, the caller must present a matching
        // X-Admin-Token header, otherwise the request is rejected.
        const adminToken = await env.ACCIDENTS_KV.get("__admin_token__");
        const provided = request.headers.get("X-Admin-Token");
        if (adminToken && provided !== adminToken) {
          return json({ error: "forbidden - only the manager device can delete" }, 403);
        }
        await env.ACCIDENTS_KV.delete(key);
        return json({ key, deleted: true, shared: true });
      }
    }

    if (url.pathname === "/api/storage-list" && request.method === "GET") {
      const prefix = url.searchParams.get("prefix") || "";
      const list = await env.ACCIDENTS_KV.list({ prefix });
      // Never expose internal keys (e.g. the admin token) via listing.
      const keys = list.keys.map((k) => k.name).filter((n) => !n.startsWith("__"));
      return json({ keys, prefix, shared: true });
    }

    // Fetch every value under a prefix in a single request (used to load
    // all accident records, each stored under its own key).
    if (url.pathname === "/api/storage-getall" && request.method === "GET") {
      const prefix = url.searchParams.get("prefix") || "";
      const list = await env.ACCIDENTS_KV.list({ prefix });
      const items = [];
      for (const k of list.keys) {
        if (k.name.startsWith("__")) continue;
        const value = await env.ACCIDENTS_KV.get(k.name);
        if (value !== null) items.push({ key: k.name, value });
      }
      return json({ items, prefix, shared: true });
    }

    // Report whether the caller's device holds the manager admin token.
    if (url.pathname === "/api/admin-check" && request.method === "GET") {
      const adminToken = await env.ACCIDENTS_KV.get("__admin_token__");
      const provided = request.headers.get("X-Admin-Token");
      return json({ isAdmin: !!adminToken && provided === adminToken, configured: !!adminToken });
    }

    // Not an API route - serve the built static site (index.html, assets/...)
    return env.ASSETS.fetch(request);
  },
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
