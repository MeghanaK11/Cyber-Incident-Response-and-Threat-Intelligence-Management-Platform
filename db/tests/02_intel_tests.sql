
-- ============================================================================
-- Threat Intelligence Tests
-- ============================================================================

-- Test 1: Add a valid IP address indicator.
DO $$
DECLARE
    v_indicator_id INT;
BEGIN
    SELECT indicator_id
    INTO v_indicator_id
    FROM indicators
    WHERE indicator_type = 'IP'
      AND lower(value) = lower('192.168.10.25');

    IF v_indicator_id IS NULL THEN
        v_indicator_id := fn_add_indicator(
            'IP',
            '192.168.10.25',
            NULL,
            90,
            'Automated test',
            1,
            CURRENT_TIMESTAMP,
            NULL,
            NULL
        );
    END IF;

    RAISE NOTICE 'Test 1 passed: Valid IP indicator exists';
END;
$$;


-- Test 2: Add a valid domain indicator.
DO $$
DECLARE
    v_indicator_id INT;
BEGIN
    SELECT indicator_id
    INTO v_indicator_id
    FROM indicators
    WHERE indicator_type = 'DOMAIN'
      AND lower(value) = lower('test-malicious-example.com');

    IF v_indicator_id IS NULL THEN
        v_indicator_id := fn_add_indicator(
            'DOMAIN',
            'test-malicious-example.com',
            NULL,
            85,
            'Automated test',
            1,
            CURRENT_TIMESTAMP,
            NULL,
            NULL
        );
    END IF;

    RAISE NOTICE 'Test 2 passed: Valid domain indicator exists';
END;
$$;


-- Test 3: Reject an invalid IP address.
DO $$
DECLARE
    v_rejected BOOLEAN := FALSE;
BEGIN
    BEGIN
        PERFORM fn_add_indicator(
            'IP',
            'not-an-ip',
            NULL,
            90,
            'Automated test',
            1,
            CURRENT_TIMESTAMP,
            NULL,
            NULL
        );

    EXCEPTION
        WHEN SQLSTATE 'P0001' THEN
            v_rejected := TRUE;
    END;

    IF NOT v_rejected THEN
        RAISE EXCEPTION 'Test 3 failed: Invalid IP was accepted';
    END IF;

    RAISE NOTICE 'Test 3 passed: Invalid IP was rejected';
END;
$$;


-- Test 4: Add a valid URL indicator.
DO $$
DECLARE
    v_indicator_id INT;
BEGIN
    SELECT indicator_id
    INTO v_indicator_id
    FROM indicators
    WHERE indicator_type = 'URL'
      AND lower(value) = lower('https://test-example.com/login');

    IF v_indicator_id IS NULL THEN
        v_indicator_id := fn_add_indicator(
            'URL',
            'https://test-example.com/login',
            NULL,
            85,
            'Automated test',
            1,
            CURRENT_TIMESTAMP,
            NULL,
            NULL
        );
    END IF;

    RAISE NOTICE 'Test 4 passed: Valid URL indicator exists';
END;
$$;


-- Test 5: Add a valid SHA256 hash.
DO $$
DECLARE
    v_indicator_id INT;
BEGIN
    SELECT indicator_id
    INTO v_indicator_id
    FROM indicators
    WHERE indicator_type = 'HASH'
      AND lower(value) = lower(
          'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
      );

    IF v_indicator_id IS NULL THEN
        v_indicator_id := fn_add_indicator(
            'HASH',
            'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            'SHA256',
            95,
            'Automated test',
            1,
            CURRENT_TIMESTAMP,
            NULL,
            NULL
        );
    END IF;

    RAISE NOTICE 'Test 5 passed: Valid SHA256 hash exists';
END;
$$;


-- Test 6: Reject an invalid SHA256 hash.
DO $$
DECLARE
    v_rejected BOOLEAN := FALSE;
BEGIN
    BEGIN
        PERFORM fn_add_indicator(
            'HASH',
            '12345',
            'SHA256',
            90,
            'Automated test',
            1,
            CURRENT_TIMESTAMP,
            NULL,
            NULL
        );

    EXCEPTION
        WHEN check_violation THEN
            v_rejected := TRUE;
    END;

    IF NOT v_rejected THEN
        RAISE EXCEPTION 'Test 6 failed: Invalid SHA256 hash was accepted';
    END IF;

    RAISE NOTICE 'Test 6 passed: Invalid SHA256 hash was rejected';
END;
$$;


-- Test 7: Reject confidence greater than 100.
DO $$
DECLARE
    v_rejected BOOLEAN := FALSE;
BEGIN
    BEGIN
        PERFORM fn_add_indicator(
            'DOMAIN',
            'invalid-confidence-example.com',
            NULL,
            150,
            'Automated test',
            1,
            CURRENT_TIMESTAMP,
            NULL,
            NULL
        );

    EXCEPTION
        WHEN check_violation THEN
            v_rejected := TRUE;
    END;

    IF NOT v_rejected THEN
        RAISE EXCEPTION 'Test 7 failed: Invalid confidence was accepted';
    END IF;

    RAISE NOTICE 'Test 7 passed: Confidence above 100 was rejected';
END;
$$;


-- Test 8: Reject negative confidence.
DO $$
DECLARE
    v_rejected BOOLEAN := FALSE;
BEGIN
    BEGIN
        PERFORM fn_add_indicator(
            'DOMAIN',
            'negative-confidence-example.com',
            NULL,
            -10,
            'Automated test',
            1,
            CURRENT_TIMESTAMP,
            NULL,
            NULL
        );

    EXCEPTION
        WHEN check_violation THEN
            v_rejected := TRUE;
    END;

    IF NOT v_rejected THEN
        RAISE EXCEPTION 'Test 8 failed: Negative confidence was accepted';
    END IF;

    RAISE NOTICE 'Test 8 passed: Negative confidence was rejected';
END;
$$;


-- Test 9: Create a threat actor and link an indicator.
DO $$
DECLARE
    v_actor_id INT;
    v_indicator_id INT;
    v_count INT;
BEGIN
    -- Find the test indicator.
    SELECT indicator_id
    INTO v_indicator_id
    FROM indicators
    WHERE indicator_type = 'DOMAIN'
      AND value = 'test-malicious-example.com';

    IF v_indicator_id IS NULL THEN
        RAISE EXCEPTION 'Test 9 failed: Test indicator does not exist';
    END IF;

    -- Find the test actor if it already exists.
    SELECT actor_id
    INTO v_actor_id
    FROM threat_actors
    WHERE name = 'TEST_APT_GROUP';

    -- Create the actor if it does not exist.
    IF v_actor_id IS NULL THEN
        INSERT INTO threat_actors (
            name,
            description,
            motivation
        )
        VALUES (
            'TEST_APT_GROUP',
            'Automated test threat actor',
            'Espionage'
        )
        RETURNING actor_id INTO v_actor_id;
    END IF;

    -- Link the indicator to the actor.
    PERFORM fn_link_indicator_to_actor(
        v_actor_id,
        v_indicator_id,
        90,
        'Automated test'
    );

    -- Verify the relationship.
    SELECT COUNT(*)
    INTO v_count
    FROM threat_actor_indicators
    WHERE actor_id = v_actor_id
      AND indicator_id = v_indicator_id;

    IF v_count <> 1 THEN
        RAISE EXCEPTION 'Test 9 failed: Indicator was not linked to actor';
    END IF;

    RAISE NOTICE 'Test 9 passed: Threat actor created and indicator linked';
END;
$$;


-- Test 10: Retrieve indicators associated with a threat actor.
DO $$
DECLARE
    v_actor_id INT;
    v_count INT;
BEGIN
    SELECT actor_id
    INTO v_actor_id
    FROM threat_actors
    WHERE name = 'TEST_APT_GROUP';

    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Test 10 failed: Test actor does not exist';
    END IF;

    SELECT COUNT(*)
    INTO v_count
    FROM fn_get_actor_indicators(v_actor_id)
    WHERE indicator_value = 'test-malicious-example.com';

    IF v_count <> 1 THEN
        RAISE EXCEPTION 'Test 10 failed: Actor indicators were not retrieved';
    END IF;

    RAISE NOTICE 'Test 10 passed: Actor indicators retrieved successfully';
END;
$$;
