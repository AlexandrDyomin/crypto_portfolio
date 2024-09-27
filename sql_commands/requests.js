export default {
    getTransactions: `SELECT id, crypto_pair, date, transaction_type, amount, price, amount * price AS sum 
                    FROM transactions 
                    WHERE user_id = $1
                    ORDER BY date DESC`,
    getUnrealizedPnL: [
        `CREATE temporary TABLE IF NOT EXISTS total_purchased AS 
        SELECT crypto_pair, sum(amount) AS amount 
        FROM transactions 
        WHERE transaction_type = 'покупка' AND user_id = $1 
        GROUP BY crypto_pair`,

        `CREATE temporary TABLE IF NOT EXISTS total_sold AS 
        SELECT crypto_pair, sum(amount) AS amount 
        FROM transactions 
        WHERE transaction_type = 'продажа' AND user_id = $1 
        GROUP BY crypto_pair`,

        `CREATE temporary TABLE IF NOT EXISTS rest_of_coins AS 
        SELECT crypto_pair, coalesce(total_purchased.amount - total_sold.amount, total_purchased.amount) AS amount 
        FROM total_purchased 
        LEFT JOIN total_sold using(crypto_pair) 
        WHERE coalesce(total_purchased.amount - total_sold.amount, total_purchased.amount) > 0`,
        
        `CREATE temporary TABLE IF NOT EXISTS last_date_of_sale AS 
        SELECT crypto_pair, max(date) AS last_date_of_sale
        FROM transactions
        WHERE transaction_type = 'продажа' AND user_id = $1
        GROUP BY crypto_pair`,

        `CREATE temporary TABLE IF NOT EXISTS last_date AS 
        SELECT crypto_pair, max(date) AS last_date
        FROM transactions
        LEFT JOIN last_date_of_sale USING(crypto_pair)
        WHERE transaction_type = 'покупка' AND user_id = $1
        GROUP BY crypto_pair, last_date_of_sale
        HAVING (last_date_of_sale IS NULL OR max(date) > last_date_of_sale)`,

        `CREATE temporary TABLE IF NOT EXISTS avg_purchase_price1 AS 
        SELECT crypto_pair, sum(amount) AS amount, sum(amount * price) / sum(amount) AS price  
        FROM transactions
        LEFT JOIN last_date_of_sale USING(crypto_pair)
        WHERE transaction_type = 'покупка' AND user_id = $1 AND date <= last_date_of_sale
        GROUP BY crypto_pair`,

        `CREATE temporary TABLE IF NOT EXISTS avg_purchase_price2 AS 
        SELECT crypto_pair, sum(amount) AS amount, sum(amount * price) / sum(amount) AS price  
        FROM transactions
        LEFT JOIN last_date USING(crypto_pair)  
        LEFT JOIN last_date_of_sale USING(crypto_pair)
        WHERE transaction_type = 'покупка' AND user_id = $1 AND (date <= last_date AND date > last_date_of_sale) OR last_date_of_sale IS NULL
        GROUP BY crypto_pair`,

        `CREATE temporary TABLE IF NOT EXISTS avg_purchase_price AS 
        SELECT crypto_pair,  coalesce((rest_of_coins.amount - avg_purchase_price2.amount) * avg_purchase_price1.price / ((rest_of_coins.amount - avg_purchase_price2.amount) + avg_purchase_price2.amount) + (avg_purchase_price2.amount * avg_purchase_price2.price / ((rest_of_coins.amount - avg_purchase_price2.amount) + avg_purchase_price2.amount)) , avg_purchase_price1.price, avg_purchase_price2.price) as price 
        FROM rest_of_coins
        LEFT JOIN avg_purchase_price1 USING(crypto_pair)
        LEFT JOIN avg_purchase_price2 USING(crypto_pair)`,
        `CREATE temporary TABLE IF NOT EXISTS current_prices(
            crypto_pair VARCHAR(12) NOT NULL, 
            price NUMERIC(22,10) NOT NULL, 
            PRIMARY KEY (crypto_pair)
        )`,

        `INSERT INTO current_prices (crypto_pair, price) 
        VALUES`,

        `CREATE temporary TABLE IF NOT EXISTS profit AS 
        SELECT crypto_pair, ROUND((current_prices.price / avg_purchase_price.price  - 1) * 100, 2) AS profit_in_percentage, ROUND((current_prices.price / avg_purchase_price.price -1) * avg_purchase_price.price * rest_of_coins.amount, 2) AS profit 
        FROM current_prices 
        JOIN avg_purchase_price using(crypto_pair) 
        JOIN rest_of_coins using(crypto_pair)`,

        `SELECT crypto_pair,  rest_of_coins.amount, avg_purchase_price.price AS avg_purchase_price, rest_of_coins.amount * avg_purchase_price.price AS sum, current_prices.price AS current_price, profit_in_percentage || '% | ' || profit AS profit
        FROM rest_of_coins 
        JOIN avg_purchase_price using(crypto_pair) 
        JOIN current_prices USING(crypto_pair) 
        JOIN profit using(crypto_pair)
        ORDER BY sum DESC`
    ],
    getRealizedPnL: [
        `CREATE TEMPORARY TABLE IF NOT EXISTS last_date_of_sale AS
        SELECT crypto_pair, max(date) as last_date_of_sale
        FROM transactions
        WHERE transaction_type = 'продажа'  AND user_id = $1
        GROUP BY crypto_pair`,
        `CREATE TEMPORARY TABLE IF NOT EXISTS total_purchased AS
        SELECT crypto_pair, sum(amount) as total_purchased
        FROM transactions
        JOIN last_date_of_sale USING(crypto_pair)
        WHERE transaction_type = 'покупка' AND date <= last_date_of_sale AND user_id = $1
        GROUP BY crypto_pair`,
        `CREATE TEMPORARY TABLE IF NOT EXISTS avg_purchase_price AS
        SELECT crypto_pair, sum(amount / total_purchased * price) as avg_purchase_price
        FROM transactions
        JOIN total_purchased USING(crypto_pair)
        JOIN last_date_of_sale USING (crypto_pair)
        WHERE transaction_type = 'покупка' AND date <= last_date_of_sale AND user_id = $1
        GROUP BY crypto_pair`,
        `CREATE TEMPORARY TABLE IF NOT EXISTS total_sold AS
        SELECT crypto_pair, sum(amount) as total_sold
        FROM transactions
        WHERE transaction_type = 'продажа' AND user_id = $1
        GROUP BY crypto_pair`,
        `CREATE TEMPORARY TABLE IF NOT EXISTS avg_sold_price AS
        SELECT crypto_pair, sum(amount / total_sold * price) as avg_sold_price
        FROM transactions
        JOIN total_sold USING(crypto_pair)
        WHERE transaction_type = 'продажа' AND user_id = $1
        GROUP BY crypto_pair`,
        `SELECT crypto_pair, total_sold, avg_sold_price, total_sold * avg_sold_price AS received, ROUND((avg_sold_price / avg_purchase_price - 1) * 100, 2) || '% | ' || ROUND((avg_sold_price - avg_purchase_price) * total_sold, 2) as profit
        FROM total_sold
        JOIN avg_sold_price USING(crypto_pair)
        JOIN avg_purchase_price USING(crypto_pair)`
    ],

    insertTransaction: [
        `INSERT INTO transactions(user_id, crypto_pair, date, transaction_type, amount, price) 
        VALUES($1, $2, $3, $4, $5, $6)`,
        `INSERT INTO wallets (user_id, ticker, amount)
        VALUES($1, $2, CASE WHEN $4 = 'покупка' THEN $3 ELSE $3 * -1 END )
        ON CONFLICT (user_id, ticker) DO UPDATE
        SET amount = CASE WHEN $4 = 'покупка' THEN wallets.amount + $3 ELSE wallets.amount - $3 END`,
    ],
    deleteTransaction: 'DELETE FROM transactions WHERE id=$1',
    editTransaction: `UPDATE transactions 
                    SET crypto_pair = $1, date = $2, transaction_type = $3, amount = $4, price = $5
                    WHERE id = $6`,
    insertUser: `INSERT INTO users (login, password) 
                VALUES ($1, $2)`,
    getUser: `SELECT id, password 
            FROM users 
            WHERE login = $1`,
    insertSession: `INSERT INTO sessions (session_id, user_id) 
                VALUES ($1, $2)`,
    getUserId: `SELECT user_id 
                FROM sessions 
                WHERE session_id = $1`,
    getWallet: `SELECT ticker, amount
                FROM wallets
                WHERE user_id = $1`
};






