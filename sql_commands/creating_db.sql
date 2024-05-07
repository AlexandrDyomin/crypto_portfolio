CREATE TABLE users( 
    id serial,
    login VARCHAR(20) NOT NULL UNIQUE,
    password VARCHAR(81) NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE sessions( 
    session_id VARCHAR(64) NOT NULL,
    user_id INTEGER NOT NULL,
    PRIMARY KEY (session),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE wallets(
    user_id INTEGER,
    ticker VARCHAR(12) NOT NULL,
    amount NUMERIC(22,10) NOT NULL,
    PRIMARY KEY (user_id, ticker),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE transactions (
    id SERIAL,
    user_id INTEGER,
    crypto_pair VARCHAR(12) NOT NULL,
    date DATE NOT NULL,
    transaction_type VARCHAR(7) NOT NULl,
    amount NUMERIC(22,10) NOT NULL,
    price NUMERIC(22,10) NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE p2p (
    id SERIAL,
    user_id INTEGER,
    crypto_pair VARCHAR(12) NOT NULL,
    date DATE NOT NULL,
    type_of_transaction VARCHAR(7) NOT NULl,
    amount NUMERIC(22,10) NOT NULL,
    price NUMERIC(22,10) NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
);
