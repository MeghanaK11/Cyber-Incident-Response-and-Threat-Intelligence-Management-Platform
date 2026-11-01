import { Pool, type PoolClient, type QueryResultRow } from "pg";

// One pool per server process. In dev, Next.js reloads modules on every change,
// so the pool is kept on globalThis to avoid opening a new one each time.
const globalForPg = globalThis as unknown as { cirtPool?: Pool };

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
  }
  return new Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000 });
}

export function getPool(): Pool {
  if (!globalForPg.cirtPool) globalForPg.cirtPool = createPool();
  return globalForPg.cirtPool;
}

/** Read-only query outside a transaction. Always pass values as $1, $2 parameters. */
export async function query<T extends QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  const result = await getPool().query<T>(text, params);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

type TxOptions = { statusNote?: string };

/**
 * Runs fn inside BEGIN ... COMMIT. The acting user's id is stored in the
 * transaction-local setting app.current_user_id, which the audit and status
 * history triggers read. Any error rolls the whole unit back.
 */
export async function withTransaction<T>(
  actorId: number,
  fn: (client: PoolClient) => Promise<T>,
  options: TxOptions = {},
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT set_config('app.current_user_id', $1, true), set_config('app.status_note', $2, true)",
      [String(actorId), options.statusNote ?? ""],
    );
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
