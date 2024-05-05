
function prepareQueryToCreateAccount(login, password) {
    return `
        DO $$               
            BEGIN
                IF NOT EXISTS (select login from users where login='${login}')
                THEN
                    INSERT INTO users (login, password) VALUES ('${login}', '${password}');
                END IF;
        END $$`;
}

export default prepareQueryToCreateAccount;