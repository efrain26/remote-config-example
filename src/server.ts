import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { openDb } from "./db.ts";
import { FLAGS, type Config } from "./config.ts";
import { deleteFlag, listFlags, readStored, resolve, setFlag, TypeChangeError } from "./flags.ts";

const PORT = Number(process.env.PORT ?? 3000);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "";
const KEY = /^[a-z][a-z0-9_]{0,62}$/;

const db = await openDb();

async function getConfig(): Promise<Config> {
  return resolve(FLAGS, await readStored(db));
}

function send(res: ServerResponse, status: number, body: unknown, type = "application/json"): void {
  res.writeHead(status, { "content-type": `${type}; charset=utf-8`, "cache-control": "no-store" });
  res.end(type === "application/json" ? JSON.stringify(body, null, 2) : String(body));
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  let text = "";
  for await (const chunk of req) {
    text += chunk;
    if (text.length > 20_000) throw new Error("body too large");
  }
  return JSON.parse(text);
}

function isAdmin(req: IncomingMessage): boolean {
  return ADMIN_TOKEN !== "" && req.headers.authorization === `Bearer ${ADMIN_TOKEN}`;
}

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

// Evaluated on the server: when new_checkout is off, its HTML never leaves the server.
function renderPage(config: Config, template: string): string {
  const items = Array.from({ length: config.max_items }, (_, i) => `<li>Product ${i + 1}</li>`).join("");
  const checkout = config.new_checkout
    ? `<button class="new">New checkout</button>`
    : `<button>Checkout</button>`;
  const banner = config.banner_text ? `<p class="banner">${escape(config.banner_text)}</p>` : "";
  return template
    .replace("{{banner}}", banner)
    .replace("{{items}}", items)
    .replace("{{checkout}}", checkout)
    .replace("{{accent}}", escape(config.theme.accent))
    .replace("{{radius}}", config.theme.rounded ? "12px" : "0");
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  try {
    if (req.method === "GET" && url.pathname === "/") {
      const template = await readFile(new URL("./page.html", import.meta.url), "utf8");
      return send(res, 200, renderPage(await getConfig(), template), "text/html");
    }

    // What a client (browser, mobile app) downloads: one JSON with typed values.
    if (req.method === "GET" && url.pathname === "/api/config") {
      return send(res, 200, await getConfig());
    }

    // Admin: raw rows with the detected type. The CLI (npm run flag) uses these.
    if (url.pathname === "/api/flags" || url.pathname.startsWith("/api/flags/")) {
      if (!isAdmin(req)) return send(res, 401, { error: "missing or wrong ADMIN_TOKEN" });
      const key = url.pathname.slice("/api/flags/".length);

      if (req.method === "GET" && url.pathname === "/api/flags") {
        return send(res, 200, await listFlags(db));
      }
      if (!KEY.test(key)) {
        return send(res, 400, { error: "key: lowercase letters, numbers and _, starting with a letter" });
      }
      if (req.method === "PUT") {
        const body = (await readBody(req)) as { value?: unknown; force?: unknown };
        if (typeof body.value !== "string") {
          return send(res, 400, { error: 'value must be a string, e.g. {"value": "true"}' });
        }
        const type = await setFlag(db, key, body.value, body.force === true);
        return send(res, 200, { key, value: body.value, type });
      }
      if (req.method === "DELETE") {
        return (await deleteFlag(db, key)) ? send(res, 200, { deleted: key }) : send(res, 404, { error: "not found" });
      }
    }

    send(res, 404, { error: "not found" });
  } catch (error) {
    if (error instanceof TypeChangeError) return send(res, 409, { error: error.message });
    if (error instanceof SyntaxError) return send(res, 400, { error: "body must be JSON" });
    console.error(error);
    send(res, 500, { error: "internal error" });
  }
});

server.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
  if (!ADMIN_TOKEN) console.warn("ADMIN_TOKEN is empty: changing flags is disabled. Copy .env.example to .env.");
});

// Close the database cleanly so the next process can open it.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close();
    db.close().finally(() => process.exit(0));
  });
}
