DO $$               
    BEGIN
        IF NOT EXISTS (select login from users where login=$1)
        THEN
            INPUT INTO users (login, password) VALUES ($2, $3);
        END IF;
END $$;
