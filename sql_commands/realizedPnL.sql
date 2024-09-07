CREATE TEMPORARY TABLE IF NOT EXISTS last_date_of_sale AS
SELECT crypto_pair, max(date) as last_date_of_sale
FROM transactions
WHERE transaction_type = 'продажа'  AND user_id = $1
GROUP BY crypto_pair;

CREATE TEMPORARY TABLE IF NOT EXISTS total_purchased AS
SELECT crypto_pair, sum(amount) as total_purchased
FROM transactions
JOIN last_date_of_sale USING(crypto_pair)
WHERE transaction_type = 'покупка' AND date <= last_date_of_sale AND user_id = $1
GROUP BY crypto_pair;

CREATE TEMPORARY TABLE IF NOT EXISTS avg_purchase_price AS
SELECT crypto_pair, sum(amount / total_purchased * price) as avg_purchase_price
FROM transactions
JOIN total_purchased USING(crypto_pair)
JOIN last_date_of_sale USING (crypto_pair)
WHERE transaction_type = 'покупка' AND date <= last_date_of_sale AND user_id = $1
GROUP BY crypto_pair;

CREATE TEMPORARY TABLE IF NOT EXISTS total_sold AS
SELECT crypto_pair, sum(amount) as total_sold
FROM transactions
WHERE transaction_type = 'продажа' AND user_id = $1
GROUP BY crypto_pair;

CREATE TEMPORARY TABLE IF NOT EXISTS avg_sold_price AS
SELECT crypto_pair, sum(amount / total_sold * price) as avg_sold_price
FROM transactions
JOIN total_sold USING(crypto_pair)
WHERE transaction_type = 'продажа' AND user_id = $1
GROUP BY crypto_pair;

SELECT crypto_pair, total_sold, avg_sold_price, total_sold * avg_sold_price AS received, ROUND((avg_sold_price / avg_purchase_price - 1) * 100, 2) || '% | ' || ROUND((total_sold * avg_sold_price) - (total_sold * avg_purchase_price), 2) as profit
FROM total_sold
JOIN avg_sold_price USING(crypto_pair)
JOIN avg_purchase_price USING(crypto_pair);