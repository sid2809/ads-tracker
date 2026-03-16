import pg from "pg";
import { ensureSchema } from "./db-schema";

const { Pool } = pg;

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes("railway")
        ? { rejectUnauthorized: false }
        : false,
      max: 5,
      idleTimeoutMillis: 30_000,
    });
    pool.on("error", (err) => console.error("[db] idle client error", err));
  }
  return pool;
}

let schemaReady = false;

export async function query(text, params) {
  const p = getPool();
  if (!schemaReady) {
    await ensureSchema(p);
    schemaReady = true;
  }
  return p.query(text, params);
}

export default { query };
