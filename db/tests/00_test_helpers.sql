-- Shared test helpers. Loaded at the start of each test script.
-- They live in pg_temp, so they disappear when the session ends.

CREATE OR REPLACE FUNCTION pg_temp.check(p_ok BOOLEAN, p_label TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
    RAISE NOTICE '%  %', CASE WHEN p_ok THEN 'PASS' ELSE 'FAIL' END, p_label;
END;
$$;

-- Runs p_sql and expects it to fail. The failed statement is rolled back.
CREATE OR REPLACE FUNCTION pg_temp.expect_error(p_sql TEXT, p_label TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
    BEGIN
        EXECUTE p_sql;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'PASS  % (rejected: %)', p_label, SQLERRM;
        RETURN;
    END;
    RAISE NOTICE 'FAIL  % (statement was accepted)', p_label;
END;
$$;

-- 384-dimension test vector built from a seed so tests are repeatable
CREATE OR REPLACE FUNCTION pg_temp.test_vec(p_seed FLOAT8, p_noise FLOAT8 DEFAULT 0) RETURNS VECTOR
LANGUAGE sql IMMUTABLE AS $$
    SELECT array_agg(sin(g * p_seed) + p_noise * cos(g * 3.7) ORDER BY g)::REAL[]::VECTOR(384)
    FROM generate_series(1, 384) g
$$;
