// Changes flags through the running server (it owns the database while it runs).
//   npm run flag -- list
//   npm run flag -- set <key> <value> [--force]
//   npm run flag -- delete <key>
const base = `http://localhost:${process.env.PORT ?? 3000}/api/flags`;
const headers = {
  authorization: `Bearer ${process.env.ADMIN_TOKEN ?? ""}`,
  "content-type": "application/json",
};

const args = process.argv.slice(2);
const force = args.includes("--force");
const [command, key, value] = args.filter((arg) => arg !== "--force");

async function call(method: string, path = "", body?: unknown): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error(`cannot reach ${base}. Start the server first: npm run dev`);
  }
  const data = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
  return data;
}

try {
  if (command === "list") {
    const rows = (await call("GET")) as { key: string; value: string; type: string }[];
    console.table(rows.map(({ key, type, value }) => ({ key, type, value })));
  } else if (command === "set" && key && value !== undefined) {
    const result = (await call("PUT", `/${key}`, { value, force })) as { type: string };
    console.log(`${key} = ${value}  (${result.type})`);
  } else if (command === "delete" && key) {
    await call("DELETE", `/${key}`);
    console.log(`deleted ${key}`);
  } else {
    console.log("usage: npm run flag -- list | set <key> <value> [--force] | delete <key>");
    process.exitCode = 1;
  }
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
}
