-- Shared setup (both members)
-- Extensions used across the schema.
--   citext   : case-insensitive emails
--   pg_trgm  : partial/fuzzy search on IOC values
--   pgcrypto : bcrypt hashing in SQL test scripts
--   vector   : pgvector, stores incident embeddings for similarity search

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;
