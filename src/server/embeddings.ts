import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { getPool, query } from "@/lib/db";

// Sentence embeddings for semantic incident search.
//
// Model: sentence-transformers/all-MiniLM-L6-v2 (ONNX export by Xenova), 384 dims.
// It runs inside the Node server through transformers.js, so no API key or paid
// service is involved. The first call downloads about 90 MB from Hugging Face
// into .cache/; set EMBEDDING_MODEL_PATH to a folder that already holds the
// model to work fully offline.

export const MODEL_NAME = "Xenova/all-MiniLM-L6-v2";
export const DIMENSIONS = 384;

type Extractor = (texts: string[], opts: { pooling: "mean"; normalize: boolean }) => Promise<{ tolist(): number[][] }>;

const globalForModel = globalThis as unknown as { cirtExtractor?: Promise<Extractor> };

async function loadExtractor(): Promise<Extractor> {
  const { pipeline, env } = await import("@huggingface/transformers");
  env.cacheDir = process.env.EMBEDDING_CACHE_DIR ?? ".cache/transformers";
  if (process.env.EMBEDDING_MODEL_PATH) {
    env.localModelPath = process.env.EMBEDDING_MODEL_PATH;
    env.allowRemoteModels = false;
  }
  const extractor = await pipeline("feature-extraction", MODEL_NAME, { dtype: "fp32" });
  return extractor as unknown as Extractor;
}

function getExtractor(): Promise<Extractor> {
  globalForModel.cirtExtractor ??= loadExtractor().catch((err) => {
    globalForModel.cirtExtractor = undefined; // allow a retry on the next call
    throw err;
  });
  return globalForModel.cirtExtractor;
}

/** Unit-length vectors, so cosine similarity is just the dot product. */
export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const extractor = await getExtractor();
  const output = await extractor(texts, { pooling: "mean", normalize: true });
  return output.tolist();
}

export function toPgVector(v: number[]): string {
  return `[${v.map((x) => x.toFixed(6)).join(",")}]`;
}

/** The text that represents an incident: what happened plus how it was fixed. */
export function incidentText(row: { title: string; description: string; resolution_summary: string | null }): string {
  return [row.title, row.description, row.resolution_summary ? `Resolution: ${row.resolution_summary}` : ""]
    .filter(Boolean)
    .join("\n");
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

type IncidentTextRow = { incident_id: number; title: string; description: string; resolution_summary: string | null };

/**
 * Embeds incidents that have no embedding yet or whose text changed (is_stale).
 * Pass ids to limit the work to specific incidents. Returns how many were written.
 */
export async function refreshEmbeddings(ids?: number[], batchSize = 16): Promise<number> {
  const rows = await query<IncidentTextRow & { content_hash: string | null }>(
    `SELECT i.incident_id, i.title, i.description, i.resolution_summary, e.content_hash
       FROM incidents i
       LEFT JOIN incident_embeddings e ON e.incident_id = i.incident_id
      WHERE (e.incident_id IS NULL OR e.is_stale)
        AND ($1::INT[] IS NULL OR i.incident_id = ANY ($1))
      ORDER BY i.incident_id`,
    [ids ?? null],
  );

  let written = 0;
  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize);
    const texts = batch.map(incidentText);
    const hashes = texts.map(sha256);

    // Text unchanged since the last embedding: just clear the stale flag
    const unchanged = batch.filter((r, i) => r.content_hash === hashes[i]);
    if (unchanged.length) {
      await query(`UPDATE incident_embeddings SET is_stale = FALSE WHERE incident_id = ANY ($1)`, [
        unchanged.map((r) => r.incident_id),
      ]);
    }

    const todo = batch.map((r, i) => ({ r, text: texts[i], hash: hashes[i] })).filter((x) => x.r.content_hash !== x.hash);
    if (!todo.length) continue;
    const vectors = await embed(todo.map((x) => x.text));

    const client: PoolClient = await getPool().connect();
    try {
      await client.query("BEGIN");
      for (let i = 0; i < todo.length; i++) {
        await client.query(
          `INSERT INTO incident_embeddings (incident_id, embedding, model_name, content_hash, is_stale, embedded_at)
           VALUES ($1, $2::vector, $3, $4, FALSE, now())
           ON CONFLICT (incident_id) DO UPDATE
              SET embedding = EXCLUDED.embedding, model_name = EXCLUDED.model_name,
                  content_hash = EXCLUDED.content_hash, is_stale = FALSE, embedded_at = now()`,
          [todo[i].r.incident_id, toPgVector(vectors[i]), MODEL_NAME, todo[i].hash],
        );
      }
      await client.query("COMMIT");
      written += todo.length;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
  return written;
}

/** Fire-and-forget refresh after a write, so a slow model never blocks the request. */
export function refreshInBackground(ids: number[]) {
  refreshEmbeddings(ids).catch((err) => console.error("Embedding refresh failed:", err.message));
}

/** Past incidents closest in meaning to the given one (stored function, HNSW index). */
export async function similarIncidents(incidentId: number, limit = 5) {
  await refreshEmbeddings([incidentId]);
  return query(
    `SELECT s.*, i.created_at, i.resolved_at
       FROM fn_similar_incidents($1, $2, 0.35) s
       JOIN incidents i USING (incident_id)
      ORDER BY s.similarity DESC`,
    [incidentId, limit],
  );
}

/** Free-text search by meaning across all incidents. */
export async function semanticSearch(text: string, limit = 10) {
  const [vector] = await embed([text]);
  return query(
    `SELECT o.incident_id, o.reference_code, o.title, o.category, o.severity, o.status,
            o.sla_state, o.assignee_name, o.created_at,
            round((1 - (e.embedding <=> $1::vector))::NUMERIC, 3) AS similarity
       FROM incident_embeddings e
       JOIN v_incident_overview o ON o.incident_id = e.incident_id
      ORDER BY e.embedding <=> $1::vector
      LIMIT $2`,
    [toPgVector(vector), limit],
  );
}
