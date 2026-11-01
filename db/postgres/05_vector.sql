-- Member A: Kallepalli Sai Meghana (PES1UG24AM911)
-- Vector store for semantic "similar past incidents" search (pgvector).
--
-- What is embedded : incident title + description + resolution summary
-- Model            : sentence-transformers/all-MiniLM-L6-v2, 384 dimensions,
--                    run locally in the Next.js server via transformers.js
-- Storage          : one row per incident in incident_embeddings (vector(384))
-- Metric           : cosine distance (<=>), similarity = 1 - distance
-- Index            : HNSW with vector_cosine_ops for approximate nearest neighbour search

DROP TABLE IF EXISTS incident_embeddings CASCADE;

CREATE TABLE incident_embeddings (
    incident_id  INT PRIMARY KEY REFERENCES incidents (incident_id) ON DELETE CASCADE,
    embedding    VECTOR(384) NOT NULL,
    model_name   VARCHAR(100) NOT NULL,
    content_hash CHAR(64)     NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),  -- sha256 of the embedded text
    is_stale     BOOLEAN      NOT NULL DEFAULT FALSE,
    embedded_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_incident_embeddings_hnsw
    ON incident_embeddings USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_incident_embeddings_stale ON incident_embeddings (incident_id) WHERE is_stale;

-- When the text of an incident changes, its embedding is out of date.
-- The app re-embeds stale rows on its next pass.
CREATE OR REPLACE FUNCTION fn_mark_embedding_stale() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE incident_embeddings SET is_stale = TRUE WHERE incident_id = NEW.incident_id;
    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_mark_embedding_stale
AFTER UPDATE OF title, description, resolution_summary ON incidents
FOR EACH ROW
WHEN (OLD.title IS DISTINCT FROM NEW.title
   OR OLD.description IS DISTINCT FROM NEW.description
   OR OLD.resolution_summary IS DISTINCT FROM NEW.resolution_summary)
EXECUTE FUNCTION fn_mark_embedding_stale();

-- Nearest past incidents to a given incident. Resolved and closed ones come first
-- in practice because those carry a resolution the analyst can reuse.
CREATE OR REPLACE FUNCTION fn_similar_incidents(
    p_incident_id    INT,
    p_limit          INT     DEFAULT 5,
    p_min_similarity NUMERIC DEFAULT 0.35)
RETURNS TABLE (incident_id INT, reference_code VARCHAR, title VARCHAR,
               category incident_category, severity incident_severity, status incident_status,
               resolution_summary TEXT, similarity NUMERIC)
LANGUAGE sql STABLE AS $$
    WITH target AS (
        SELECT embedding FROM incident_embeddings WHERE incident_id = p_incident_id
    )
    SELECT i.incident_id, i.reference_code, i.title, i.category, i.severity, i.status,
           i.resolution_summary,
           round((1 - (e.embedding <=> t.embedding))::NUMERIC, 3) AS similarity
    FROM target t
    JOIN incident_embeddings e ON e.incident_id <> p_incident_id
    JOIN incidents i           ON i.incident_id = e.incident_id
    WHERE 1 - (e.embedding <=> t.embedding) >= p_min_similarity
    ORDER BY e.embedding <=> t.embedding
    LIMIT p_limit
$$;
