import { renderFile } from 'pug';
import { readFileSync } from 'fs';
import pool from './pgPool.js';
import { generateRandomHexString as generateSessionId, hash, verify } from './cryptography.js';
import requests from './sql_commands/requests.js';

const PROTOCOL = process.env.PROTOCOL;
const HOST = process.env.HOST;
const PORT = process.env.PORT;

var routes = {
    '/': decorate(async function sendIndexPage(req, res) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(renderFile('./index.pug', { 
            cache: true,
            title: 'Кошелёк',
            h1: 'Кошелёк',
            rows: [{ ticker: 'btc', amount: 12 }]
        }));
    }),
    '/login': decorate(async function sendLoginPage(req, res){
        res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
        res.end(renderFile('./login/index.pug', { 
            cache: true,
            action: `${PROTOCOL}://${HOST}:${PORT}/auth`,
            loginPlaceholder: 'Логин',
            passwordPlaceholder: 'Пароль',
            buttonText: 'Войти',
            linkToSignUp: `${PROTOCOL}://${HOST}:${PORT}/sign_up`,
            warning: this.warning,
            title: 'Вход',
            h1: 'Вход'
        }));
    }),
    '/sign_up': decorate(async function sendSignUpPage(req,res) {
        res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
        res.end(renderFile('./sign_up/index.pug', { 
            cache: true,
            action: `${PROTOCOL}://${HOST}:${PORT}/create_accaunt`,
            loginPlaceholder: 'Логин',
            passwordPlaceholder: 'Пароль',
            buttonText: 'Создать аккаунт',
            linkToLogin: `${PROTOCOL}://${HOST}:${PORT}/login`,
            warning: this.warning,
            title: 'Создание аккаунта',
            h1: 'Создайте свой аккаунт'
        }));
    }),
    '/transactions': decorate(async function sendTransactionsPage(req, res) {
        var rows = await getRows(this.userId);
        formatDataForView(rows);

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(renderFile('./transactions/index.pug', { 
            cache: true,
            title: 'Транзакции',
            h1: 'Транзакции',
            rows
        }));

        async function getRows(userId) {
            var result = await makeReqToDb(requests.getTransactions, [userId]);
            return result.rows;
        }
    }),
    '/transaction_form': decorate(function sendTransactioForm(req, res) {
        var url = new URL(req.url, `http://${HOST}:${PORT}`);
        if (url.search) {
            var values = parseSearchParm(url);
            var title = 'Изменить тарнзакцию';
            var pathname = '/edit_transaction'
        } else {
            values = {};
            title = 'Добавить тарнзакцию';
            pathname = '/add_transaction'
        }
        var h1 = title;
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(renderFile('./transaction_form/index.pug', { 
            cache: true,
            title,
            h1,
            values,
            pathname
        }));
    }),
    '/unrealizedPnL': decorate(async function sendUnrealizedPnL(req, res) {
        var rows = await getRows(this.userId);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        formatDataPnLForView(rows);
        dropTmpTbales('total_purchased', 'total_sold', 'rest_of_coins', 'delta', 'avg_purchase_price', 'current_prices', 'profit');
        res.end(renderFile('./unrealizedPnL/index.pug', { 
            cache: true,
            title: 'Нереализованная прибыль(убыток)',
            h1: 'Нереализованная прибыль(убыток)',
            rows
        }));

        async function getRows(userId) {
            var result = await makeReqToDb([[
                "CREATE temporary TABLE IF NOT EXISTS total_purchased as select crypto_pair, sum(amount) as amount from transactions WHERE transaction_type = 'покупка' and user_id = $1 GROUP BY crypto_pair", 
                [userId]
            ], [
                "CREATE temporary TABLE IF NOT EXISTS total_sold as select crypto_pair, sum(amount) as amount from transactions WHERE transaction_type = 'продажа' and user_id = $1 GROUP BY crypto_pair",
                [userId]
            ], [
                'CREATE temporary TABLE IF NOT EXISTS rest_of_coins as select crypto_pair, coalesce(abs(total_sold.amount - total_purchased.amount), total_purchased.amount) as amount FROM total_purchased left join total_sold using(crypto_pair) WHERE coalesce(abs(total_sold.amount - total_purchased.amount), total_purchased.amount) > 0'
            ], [
                `CREATE temporary TABLE IF NOT EXISTS delta as SELECT crypto_pair, CASE WHEN avg_sold_price > avg_purchase_price AND total_sold > (total_purchased - total_sold) THEN (((total_sold * avg_sold_price) - (total_sold * avg_purchase_price)) / total_sold) ELSE 0 END as delta

                FROM (

                SELECT crypto_pair, total_purchased.amount as total_purchased, sum(transactions.amount /total_purchased.amount * price) as avg_purchase_price

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

                SELECT crypto_pair, total_sold.amount as total_sold, sum(transactions.amount /total_sold.amount * price) as avg_sold_price

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
                USING(crypto_pair)
                JOIN rest_of_coins
                USING(crypto_pair)`,
                [userId]
            ], [
                "CREATE temporary TABLE IF NOT EXISTS avg_purchase_price as select crypto_pair, sum(amount * price) / sum(amount) + delta as price  FROM transactions  JOIN delta USING(crypto_pair) WHERE transaction_type = 'покупка' and user_id = $1 group BY crypto_pair, delta",
                [userId]
            ], [
                'CREATE temporary TABLE IF NOT EXISTS current_prices(crypto_pair VARCHAR(12) NOT NULL, price NUMERIC(22,10) NOT NULL, PRIMARY KEY (crypto_pair))'
            ], [
                "insert into current_prices (crypto_pair, price) values('BTC/USDT', 59000), ('SOL/USDT', 12), ('SUI/USDT', 1.858)"
            ], [
                'CREATE temporary TABLE IF NOT EXISTS profit as select crypto_pair, ROUND((current_prices.price / avg_purchase_price.price  - 1) * 100, 2) as profit_in_percentage, ROUND((current_prices.price / avg_purchase_price.price -1) * avg_purchase_price.price * rest_of_coins.amount, 2) as profit FROM current_prices join avg_purchase_price using(crypto_pair) join rest_of_coins using(crypto_pair)'
            ], [
                "select crypto_pair,  rest_of_coins.amount, avg_purchase_price.price as avg_purchase_price, rest_of_coins.amount * avg_purchase_price.price as sum, current_prices.price as current_price, profit_in_percentage || '% | ' || profit FROM rest_of_coins join avg_purchase_price using(crypto_pair) join current_prices USING(crypto_pair) join profit using(crypto_pair)"
            ]]);
            return result.rows;
        }

        function formatDataPnLForView(rows) {
            rows.forEach((row) => {
                ['amount', 'avg_purchase_price', 'sum', 'current_price'].forEach((prop) => {
                    row[prop] = parseFloat(row[prop]).toString();
                });
            });
        }
    }),
    '/realizedPnL': decorate(async function sendRealizedPnL(req, res) {
        var rows = await getRows(this.userId);
        dropTmpTbales('last_date_of_sale', 'total_purchased', 'avg_purchase_price', 'total_sold', 'avg_sold_price')
        formatDataPnLForView(rows);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(renderFile('./realizedPnL/index.pug', { 
            cache: true,
            title: 'Реализованная прибыль(убыток)',
            h1: 'Реализованная прибыль(убыток)',
            rows
        }));

        async function getRows(userId) {
            var req = requests.getRealizedPnL.map((item) => {
                var r = [item[0]];
                if (item[1]) {
                    r[1] = [userId];
                }
                return r;
            });
            var result = await makeReqToDb(req, [userId]);
            return result.rows;
        }

        function formatDataPnLForView(rows) {
            rows.forEach((row) => {
                ['total_sold', 'avg_sold_price', 'received'].forEach((prop) => {
                    row[prop] = parseFloat(row[prop]).toString();
                });
            });
        }
    }),
    postPage404,
    sendResource,
    '/create_accaunt': createAccaunt,
    '/auth': authenticate,
    '/add_transaction': decorate(async function save(req, res) {
        var url = new URL(req.url, `http://${HOST}:${PORT}`);
        var data = {userId: this.userId, ...parseSearchParm(url)};
        formatDataForDB(data);
        var rowCount = await insert(data);
        rowCount ? 
            redirect(res, '/transactions') : 
            sendErrorPage(res, new Error('Не удалось сохранить данные'));

        async function insert(data) {
            var { userId, 'crypto-pair': cryptoPair, date, type, amount, price } = data;
            var result = await makeReqToDb(
                requests.insertTransaction, 
                [userId, cryptoPair, date, type, amount, price]
            );
            return result.rowCount;
        }  
    }),
    '/remove_transaction': decorate(async function remove(req, res) {
        var id = new URL(req.url, `http://${HOST}:${PORT}`)
            .searchParams.get('id');
        var rowCount = await del(id);
        rowCount ? 
            redirect(res, '/transactions') : 
            sendErrorPage(res, new Error('Не удалось сохранить данные'));

        async function del(id) {
            var result = await makeReqToDb(requests.deleteTransaction, [id]);
            return result.rowCount;
        }
    }),
    '/edit_transaction': decorate(async function edit(req, res) {
        var url = new URL(req.url, `http://${HOST}:${PORT}`);
        var data = parseSearchParm(url);
        formatDataForDB(data);
        var rowCount = await update(data);
        rowCount ? 
            redirect(res, '/transactions') : 
            sendErrorPage(res, new Error('Не удалось сохранить данные'));
        
        async function update(data) {
            var { id, 'crypto-pair': cryptoPair, date, type, amount, price } = data;
            var result = await makeReqToDb(
                requests.editTransaction, 
                [cryptoPair, date, type, amount, price, id]
            );
            return result.rowCount;
        }
    })
};

function decorate(fn) {
    return async (req, res) => {
        try {
            var { session_id, authError, accountCreationError } = parseCookie(req.headers.cookie || '');
            if (session_id) {
                var userId = await getUserId(session_id);
            }
            
            var { pathname } = new URL(req.url, `http://${HOST}:${PORT}`);
            if (pathname === '/sign_up' || pathname === '/login') {
                if (session_id && userId) {
                    redirect(res, '/');
                    return;
                }

                if (accountCreationError === 'true') {
                    var warning = 'Выбирите другой логин, пожалуйста! 😕'
                }

                if (authError === 'true') {
                    var warning = 'Ошибочка вышла. 😕 Попробуйте еще разок.'
                }
            } else if (!session_id || !userId) {
                redirect(res, '/login');
                return;
            }

            await fn.call({ session_id, userId, warning }, req, res)
        } catch (error) {
            sendErrorPage(res, error);
        }
    }
}

function dropTmpTbales(...tableNames) {
    var requests = tableNames.
        map((tableName, i, arr) => arr[i] = [`DROP TABLE IF EXISTS ${tableName}`]);
    makeReqToDb(requests);
}

function sendResource(req, res, { contentType, cacheControl = 'public, max-age=604800' }) {
    try {
        if (!contentType) throw Error('Тип контента не определён');
        var resource = readFileSync(`.${req.url}`);
        res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': cacheControl});
        res.end(resource);
    } catch(err) {
        sendErrorPage(res, err);
    }
}

function postPage404(req, res) {
    res.writeHead(404);
    res.end('Page not found');
}

function sendErrorPage(res, err, codeResponse = 500, headers = { 'Content-Type': 'text/html; charset=utf-8' }) {
    console.log(err);
    res.writeHead(codeResponse, headers);
    res.end('Все накрылось медным тазом! 😱');
}

function createAccaunt(req, res) {
    if (req.method !== 'POST') {
        routes.postPage404(req, res);
        return;
    }

    var body = []; 
    req.on('data', (chunk) => accumulateChunks(body, chunk));
    req.on('end', async () => {
        try {
            mergeChunks(body);
            var { login, password } = parseRequestBody(body[0].toString());
            await makeReqToDb(requests.insertUser, [login, await hash(password)]);
            redirect(res, '/login');
        } catch (err) {
            if (err.code === '23505') {
                res.setHeader('Set-Cookie', 'accountCreationError=true; max-age=1');
                redirect(res, '/sign_up');
                return;
            }
            sendErrorPage(res, err);
        }
    });
}

function authenticate(req, res) {
    if (req.method !== 'POST') {
        routes.postPage404(req, res);
        return;
    }

    var body = []; 
    req.on('data', (chunk) => accumulateChunks(body, chunk));
    req.on('end', async () => {
        try {
            mergeChunks(body);
            var { login, password } = parseRequestBody(body[0].toString());
            var result = (await makeReqToDb(
                requests.getUser, 
                login
            ));

            if (result.rowCount) {
                var { id: user_id, password: passHash } = result.rows[0];
                var isCorrectPass = await verify(password, passHash);
            }

            if (!user_id || !isCorrectPass) {
                res.setHeader('Set-Cookie', 'authError=true; max-age=1');
                redirect(res, '/login');
                return;
            } 
            
            var session_id = generateSessionId();
            await makeReqToDb(requests.insertSession, [session_id, user_id]);
            res.setHeader('Set-Cookie', `session_id=${session_id}; SameSite=Strict; HttpOnly; max-age=604800;`)
            redirect(res, '/');
        } catch (err) {
            sendErrorPage(res, err);
        }
    });
}

// utils
function accumulateChunks(container, chunk) {
    container.push(chunk);
}

function mergeChunks(container) {
    return Buffer.concat(container);
}

function makeParserFor(strType) {
    var separators = {
        cookie: '; ',
        requestBody: '&'
    };
    var sep = separators[strType];
    if (!sep) throw Error(`Для типа строки ${strType} невозможно создать парсер`);

    return (str) => {
        var data = str.split(sep).map((item) => item.split('='));
        return Object.fromEntries(data);
    };
}

var parseCookie = makeParserFor('cookie');
var parseRequestBody = makeParserFor('requestBody');

function redirect(res, location, headers = {}) {
    res.writeHead(302, { 'Location': location, ...headers });
    res.end();
}

async function makeReqToDb(query, ...values) {
    try {
        var client = await pool.connect();
        await client.query('BEGIN');
        if (typeof query === 'string') {
            var result = await client.query(query, values.flat());
        } else if (Array.isArray(query)) {
            query.forEach(async (q) => {
                result = await client.query(q[0], q[1]?.flat());
            });
        }
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK'); 
    } finally {
        client.release();
    }
}

async function getUserId(session_id) {
    var userId = (await makeReqToDb(
        requests.getUserId, 
        session_id
    )).rows[0]?.user_id;

    return userId;
}

function formatDataForView(rows) {
    var formatterDates = new Intl.DateTimeFormat('ru');
    rows.forEach((row) => {
        row.date = formatterDates.format(row.date);
        ['amount', 'price', 'sum'].forEach((prop) => {
            row[prop] = parseFloat(row[prop]).toString();
        })
    });
}

function parseSearchParm(url) {
    var keys = [...url.searchParams.keys()];
    return keys.reduce((acc, key) => {
        acc[key] = url.searchParams.get(key);
        return acc;
    }, {});
}

function formatDataForDB(data) {
    data.amount = parseFloat(data.amount);
    data.price = parseFloat(data.price);
    data.id && (data.id = parseInt(data.id));
}

export default routes;