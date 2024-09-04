export default {
    getTransactions: `SELECT id, crypto_pair, date, transaction_type, amount, price, amount * price AS sum 
                    FROM transactions 
                    WHERE user_id = $1`,
    getRealizedPnL: `SELECT crypto_pair, total_sold, avg_sold_price, total_sold * avg_sold_price as received, ROUND((avg_sold_price / avg_purchase_price - 1) * 100, 2) || '% | ' || ROUND((total_sold * avg_sold_price) - (total_sold * avg_purchase_price), 2) as profit
                    FROM (
                        SELECT crypto_pair, total_purchased.amount as total_purchased, sum(transactions.amount /total_purchased.amount * price) as  avg_purchase_price 
                        FROM transactions JOIN (
                            SELECT crypto_pair, sum(amount) as amount 
                            FROM transactions 
                            WHERE transaction_type = 'покупка' and user_id = $1 
                            GROUP BY crypto_pair
                        ) total_purchased 
                        USING(crypto_pair) 
                        WHERE transaction_type = 'покупка' 
                        GROUP BY crypto_pair, total_purchased
                    ) t1 
                    JOIN (
                        SELECT crypto_pair, total_sold.amount as total_sold, sum(transactions.amount /total_sold.amount * price) as  avg_sold_price 
                        FROM transactions JOIN (
                            SELECT crypto_pair, sum(amount) as amount 
                            FROM transactions 
                            WHERE transaction_type = 'продажа' and user_id = $1 
                            GROUP BY crypto_pair
                        ) total_sold 
                        USING(crypto_pair) 
                        WHERE transaction_type = 'продажа' 
                        GROUP BY crypto_pair, total_sold
                    ) t2 
                    USING(crypto_pair)`,
    getUnrealizedPnL: ``,
    insertTransaction: `INSERT INTO transactions(user_id, crypto_pair, date, transaction_type, amount, price) 
                        VALUES($1, $2, $3, $4, $5, $6)`,
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
                WHERE session_id = $1`
};















// // реализованный PnL
// `SELECT crypto_pair, total_sold, avg_sold_price, total_sold * avg_sold_price as received, (avg_sold_price / avg_purchase_price - 1) * 100 as profit_in_percentage, (total_sold * avg_sold_price) - (total_sold * avg_purchase_price) as profit
// FROM (
//     SELECT crypto_pair, total_purchased.amount as total_purchased, sum(transactions.amount /total_purchased.amount * price) as  avg_purchase_price 
//     FROM transactions JOIN (
//         SELECT crypto_pair, sum(amount) as amount 
//         FROM transactions 
//         WHERE transaction_type = 'покупка' and user_id = 22 
//         GROUP BY crypto_pair
//     ) total_purchased 
//     USING(crypto_pair) 
//     WHERE transaction_type = 'покупка' 
//     GROUP BY crypto_pair, total_purchased
// ) t1 
// JOIN (
//     SELECT crypto_pair, total_sold.amount as total_sold, sum(transactions.amount /total_sold.amount * price) as  avg_sold_price 
//     FROM transactions JOIN (
//         SELECT crypto_pair, sum(amount) as amount 
//         FROM transactions 
//         WHERE transaction_type = 'продажа' and user_id = 22 
//         GROUP BY crypto_pair
//     ) total_sold 
//     USING(crypto_pair) 
//     WHERE transaction_type = 'продажа' 
//     GROUP BY crypto_pair, total_sold
// ) t2 
// USING(crypto_pair);`



// //дельта
// `SELECT crypto_pair, abs(((total_sold * avg_sold_price) - (total_sold * avg_purchase_price)) / total_sold) as delta
// FROM (
//     SELECT crypto_pair, total_purchased.amount as total_purchased, sum(transactions.amount /total_purchased.amount * price) as  avg_purchase_price 
//     FROM transactions JOIN (
//         SELECT crypto_pair, sum(amount) as amount 
//         FROM transactions 
//         WHERE transaction_type = 'покупка' and user_id = 22 
//         GROUP BY crypto_pair
//     ) total_purchased 
//     USING(crypto_pair) 
//     WHERE transaction_type = 'покупка' 
//     GROUP BY crypto_pair, total_purchased
// ) t1 
// JOIN (
//     SELECT crypto_pair, total_sold.amount as total_sold, sum(transactions.amount /total_sold.amount * price) as  avg_sold_price 
//     FROM transactions JOIN (
//         SELECT crypto_pair, sum(amount) as amount 
//         FROM transactions 
//         WHERE transaction_type = 'продажа' and user_id = 22 
//         GROUP BY crypto_pair
//     ) total_sold 
//     USING(crypto_pair) 
//     WHERE transaction_type = 'продажа' 
//     GROUP BY crypto_pair, total_sold
// ) t2 
// USING(crypto_pair);`