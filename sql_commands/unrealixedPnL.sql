-- всего куплено монет
CREATE temporary TABLE IF NOT EXISTS total_purchased AS 
SELECT crypto_pair, sum(amount) AS amount 
FROM transactions 
WHERE transaction_type = 'покупка' AND user_id = 22 
GROUP BY crypto_pair;

-- всего продано монет
CREATE temporary TABLE IF NOT EXISTS total_sold AS 
SELECT crypto_pair, sum(amount) AS amount 
FROM transactions 
WHERE transaction_type = 'продажа' AND user_id = 22 
GROUP BY crypto_pair;

-- всего осталось монет
CREATE temporary TABLE IF NOT EXISTS rest_of_coins AS 
SELECT crypto_pair, coalesce(abs(total_sold.amount - total_purchased.amount), total_purchased.amount) AS amount 
FROM total_purchased 
LEFT JOIN total_sold using(crypto_pair) 
WHERE coalesce(abs(total_sold.amount - total_purchased.amount), total_purchased.amount) > 0;

-- последняя дата продажи
CREATE temporary TABLE IF NOT EXISTS last_date_of_sale AS 
SELECT crypto_pair, max(date) AS last_date_of_sale
FROM transactions
WHERE transaction_type = 'продажа' AND user_id = 22
GROUP BY crypto_pair;

CREATE temporary TABLE IF NOT EXISTS last_date AS 
SELECT crypto_pair, max(date) AS last_date
FROM transactions
LEFT JOIN last_date_of_sale USING(crypto_pair)
WHERE transaction_type = 'покупка' AND user_id = 22 AND last_date_of_sale IS NULL
GROUP BY crypto_pair;

CREATE temporary TABLE IF NOT EXISTS avg_purchase_price1 AS 
SELECT crypto_pair, rest_of_coins.amount AS amount, sum(transactions.amount * transactions.price) / sum(transactions.amount) AS price  
FROM transactions
JOIN rest_of_coins USING(crypto_pair)
LEFT JOIN last_date_of_sale USING(crypto_pair)
WHERE transaction_type = 'покупка' AND user_id = 22 AND date <= last_date_of_sale
GROUP BY crypto_pair, rest_of_coins.amount;

CREATE temporary TABLE IF NOT EXISTS avg_purchase_price2 AS 
SELECT crypto_pair, sum(amount) AS amount, sum(amount * price) / sum(amount) AS price  
FROM transactions
LEFT JOIN last_date USING(crypto_pair)  
WHERE transaction_type = 'покупка' AND user_id = 22 AND date <= last_date
GROUP BY crypto_pair;

CREATE temporary TABLE IF NOT EXISTS avg_purchase_price AS 
SELECT crypto_pair,  coalesce(avg_purchase_price1.amount * avg_purchase_price1.price / (avg_purchase_price1.amount + avg_purchase_price2.amount) + (avg_purchase_price2.amount * avg_purchase_price2.price / (avg_purchase_price1.amount + avg_purchase_price2.amount)) , avg_purchase_price1.price, avg_purchase_price2.price) as price FROM rest_of_coins
LEFT JOIN avg_purchase_price1 USING(crypto_pair)
LEFT JOIN avg_purchase_price2 USING(crypto_pair);


CREATE temporary TABLE IF NOT EXISTS current_prices(
    crypto_pair VARCHAR(12) NOT NULL, 
    price NUMERIC(22,10) NOT NULL, 
    PRIMARY KEY (crypto_pair)
);

INSERT INTO current_prices (crypto_pair, price) 
values('BTC/USDT', 59000), ('SOL/USDT', 12), ('SUI/USDT', 1.858);

-- прибыль(убыток) по монете
CREATE temporary TABLE IF NOT EXISTS profit AS 
SELECT crypto_pair, ROUND((current_prices.price / avg_purchase_price.price  - 1) * 100, 2) AS profit_in_percentage, ROUND((current_prices.price / avg_purchase_price.price -1) * avg_purchase_price.price * rest_of_coins.amount, 2) AS profit 
FROM current_prices 
JOIN avg_purchase_price using(crypto_pair) 
JOIN rest_of_coins using(crypto_pair);

SELECT crypto_pair,  rest_of_coins.amount, avg_purchase_price.price AS avg_purchase_price, rest_of_coins.amount * avg_purchase_price.price AS sum, current_prices.price AS current_price, profit_in_percentage || '% | ' || profit AS profit
FROM rest_of_coins 
JOIN avg_purchase_price using(crypto_pair) 
JOIN current_prices USING(crypto_pair) 
JOIN profit using(crypto_pair)
ORDER BY sum DESC;

