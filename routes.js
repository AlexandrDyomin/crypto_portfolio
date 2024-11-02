import { renderFile } from 'pug';
import { readFileSync } from 'fs';
import pool from './pgPool.js';
import { generateRandomHexString as generateSessionId, hash, verify } from './cryptography.js';
import requests from './sql_commands/requests.js';
import { calcBalance } from './helpers/calcBalance.js';

const PROTOCOL = process.env.PROTOCOL;
const HOST = process.env.HOST;
const PORT = process.env.PORT;

var pairs = [];
setInterval(function updatePairs() {
    pairs = getAllPairs();
}, 86400000);

var routes = {
    '/': decorate(async function sendIndexPage(req, res) {
        var rows = await getRows(this.userId);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(renderFile('./index.pug', { 
            cache: true,
            title: 'Кошелёк',
            h1: 'Кошелёк',
            rows: formatData(rows),
            userName: this.login
        }));

        async function getRows(userId) {
            var result = await makeReqToDb(requests.getWallet, userId);
            return result.rows;
        }

        function formatData(data) {
            return data.map((item) => ({ ticker: item.ticker, amount: parseFloat(item.amount).toString() }));
        }
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
            rows,
            userName: this.login
        }));

        async function getRows(userId) {
            var result = await makeReqToDb(requests.getTransactions, userId);
            return result.rows;
        }
    }),
    '/transaction_form': decorate(async function sendTransactioForm(req, res) {
        var url = new URL(req.url, `http://${HOST}:${PORT}`);
        if (url.search) {
            var values = parseSearchParm(url);
            var title = 'Изменить тарнзакцию';
            var pathname = '/edit_transaction'
        } else {
            values = { date: new Date().toISOString().replace('T', ' ').slice(0, -8)};
            title = 'Добавить тарнзакцию';
            pathname = '/add_transaction'
        }

        values.pairs = await pairs;
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
        formatDataPnLForView(rows);
        dropTmpTbales('total_purchased', 'total_sold', 'last_date_of_sale', 'last_date', 'rest_of_coins', 'avg_purchase_price1', 'avg_purchase_price2', 'avg_purchase_price', 'current_prices', 'profit');
        
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(renderFile('./unrealizedPnL/index.pug', { 
            cache: true,
            title: 'Нереализованная прибыль(убыток)',
            h1: 'Нереализованная прибыль(убыток)',
            rows,
            userName: this.login
        }));

        async function getRows(userId) {
            var pairs = (await makeReqToDb([
                requests.getUnrealizedPnL[0], 
                requests.getUnrealizedPnL[1], 
                requests.getUnrealizedPnL[2], 
                'SELECT crypto_pair FROM rest_of_coins'
            ], [userId], [userId])).rows;

            var prices = pairs.map(async ({ crypto_pair }, i) => {
                return fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${crypto_pair.replace('/', '')}`)
                    .then((response) => {
                        return response.json();
                    })
                    .then((data) => {
                        return `('${formatPairForView(data.symbol)}', ${data.price})`;
                    })
                    .catch((error) => {
                        throw Error(`Ошибка при выполнении запроса цены для ${crypto_pair}`)
                    });
            });
            
            return Promise.allSettled(prices)
                .then(async (data) => {
                    var reqPart = data
                        .filter((item) => item.status === 'fulfilled')
                        .map((item) => item.value).join();
                    if (!reqPart) return []; 
                    var req = requests.getUnrealizedPnL.map((item) => item);
                    req[9] += reqPart;
                    var res = await makeReqToDb(req, [userId], [userId], undefined, [userId], [userId], [userId], [userId]);
                    return res.rows;
                });
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
        var url = new URL(req.url, `http://${HOST}:${PORT}`);
        var { startDate, endDate } = parseSearchParm(url);
        if (!startDate && !endDate) {
            var dates = (await makeReqToDb('SELECT min(date) AS start_date, max(date) AS end_date FROM transactions WHERE user_id = $1', [this.userId])).rows[0];
            startDate = dates.start_date;
            endDate = dates.end_date;
        }

        var rows = await getRows(this.userId, startDate, endDate);
        dropTmpTbales('last_date_of_sale', 'total_purchased', 'avg_purchase_price', 'total_sold', 'avg_sold_price');
        
        formatDataPnLForView(rows);
        if(Object.keys(parseSearchParm(url)).length === 0) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(renderFile('./realizedPnL/index.pug', { 
                cache: true,
                title: 'Реализованная прибыль(убыток)',
                h1: 'Реализованная прибыль(убыток)',
                rows,
                userName: this.login
            }));
        } else {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8'});
            res.end(JSON.stringify(rows));
        }

        async function getRows(userId, startDate, endDate) {
            var result = await makeReqToDb(requests.getRealizedPnL, [userId, startDate, endDate], [userId, startDate, endDate], [userId, startDate, endDate], [userId, startDate, endDate], [userId, startDate, endDate]);
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
        var data = { userId: this.userId, ...parseSearchParm(url) };
        formatDataForDB(data);
        var rowCount = await insert(data);
        rowCount ? 
            redirect(res, '/transactions') : 
            sendErrorPage(res, new Error('Не удалось сохранить данные'));

        async function insert(data) {
            var { userId, 'crypto-pair': cryptoPair, date, type, amount, price } = data;
            var result = await makeReqToDb(requests.insertTransaction, [userId, cryptoPair, date, type, amount, price], [userId, cryptoPair.replace(/\/\w+/, ''), type, amount]);
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
            var result = await makeReqToDb(requests.deleteTransaction, [id], [id]);
            return result.rowCount;
        }
    }),
    '/edit_transaction': decorate(async function edit(req, res) {
        var url = new URL(req.url, `http://${HOST}:${PORT}`);
        var data = { userId: this.userId, ...parseSearchParm(url) };
        formatDataForDB(data);
        var rowCount = await update(data);
        dropTmpTbales('total_purchased', 'total_sold', 'rest_of_coins');
        rowCount ? 
        redirect(res, '/transactions') : 
        sendErrorPage(res, new Error('Не удалось сохранить данные'));
        
        async function update(data) {
            var { userId, id, 'crypto-pair': cryptoPair, date, type, amount, price } = data;
            var params = [userId, `${cryptoPair.replace(/\/.+/, '%')}`];
            var result = await makeReqToDb(
                requests.editTransaction, 
                [cryptoPair, date, type, amount, price, id],
                params,
                params,
            );
            return result.rowCount;
        }
    }),
    '/getBalance': decorate(async function getBalance(req, res) {
        var coins = (await makeReqToDb(requests.getWallet, [this.userId])).rows;
        var balance = await calcBalance(coins);
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(balance.toString());
    })
};

function decorate(fn) {
    return async (req, res) => {
        try {
            var { session_id, authError, accountCreationError } = parseCookie(req.headers.cookie || '');
            if (session_id) {
                var userId = await getUserId(session_id);
                var { login } = (await makeReqToDb('SELECT login FROM users WHERE id=$1', [userId])).rows[0];
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

            await fn.call({ session_id, userId, login, warning }, req, res)
        } catch (error) {
            sendErrorPage(res, error);
        }
    }
}

function dropTmpTbales(...tableNames) {
    var requests = tableNames.
        map((tableName, i, arr) => arr[i] = `DROP TABLE IF EXISTS ${tableName}`);
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

async function makeReqToDb(queries, ...values) {
    try {
        var client = await pool.connect();
        await client.query('BEGIN');
        if (typeof queries === 'string') {
            var result = await client.query(queries, values.length ? values.flat() : undefined);
        } else if (Array.isArray(queries)) {
            queries.forEach(async (query, i) => {
                result = await client.query(query, values[i]?.flat());
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
        });
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
    data['crypto-pair'] = data['crypto-pair'].toUpperCase();
    data.amount = parseFloat(data.amount);
    data.price = parseFloat(data.price);
    data.id && (data.id = parseInt(data.id));
}

async function getAllPairs() {
    try {
        var response = await fetch('https://api.binance.com/api/v3/ticker/price');
        var data = await response.json();
        var result = data.map((item) => {
            return formatPairForView(item.symbol)
        });
        return result;
    } catch (error) {
        return [];
    }
}

function formatPairForView(str) {
    var coinsList = ['USDT', 'USDC', 'TUSD', 'FDUSDT', 'BNB', 'BTC', 'ETH', 'DAI', 'XRP', 'DOGE', 'AEUR', 'EURI'];
    var regExp = new RegExp(`(${coinsList.join('|')})$`);
    var overlap = str.match(regExp)?.[0];
    return overlap ? str.replace(overlap, `/${overlap}`) : str;
}






export async function getRealizedPnL() {
    var r = [
        `CREATE TEMPORARY TABLE IF NOT EXISTS last_date_of_sale AS
        SELECT crypto_pair, max(date) as last_date_of_sale
        FROM transactions
        WHERE transaction_type = 'продажа'  
            AND user_id = $1
            AND date >= $2
            AND date <= $3
        GROUP BY crypto_pair`,
        `CREATE TEMPORARY TABLE IF NOT EXISTS total_purchased AS
        SELECT crypto_pair, sum(amount) as total_purchased
        FROM transactions
        JOIN last_date_of_sale USING(crypto_pair)
        WHERE transaction_type = 'покупка' AND date <= last_date_of_sale AND user_id = $1
            AND date >= $2
            AND date <= $3
        GROUP BY crypto_pair`,
        `CREATE TEMPORARY TABLE IF NOT EXISTS avg_purchase_price AS
        SELECT crypto_pair, sum(amount / total_purchased * price) as avg_purchase_price
        FROM transactions
        JOIN total_purchased USING(crypto_pair)
        JOIN last_date_of_sale USING (crypto_pair)
        WHERE transaction_type = 'покупка' AND date <= last_date_of_sale AND user_id = $1
            AND date >= $2
            AND date <= $3
        GROUP BY crypto_pair`,
        `CREATE TEMPORARY TABLE IF NOT EXISTS total_sold AS
        SELECT crypto_pair, sum(amount) as total_sold
        FROM transactions
        WHERE transaction_type = 'продажа' AND user_id = $1
            AND date >= $2
            AND date <= $3
        GROUP BY crypto_pair`,
        `CREATE TEMPORARY TABLE IF NOT EXISTS avg_sold_price AS
        SELECT crypto_pair, sum(amount / total_sold * price) as avg_sold_price
        FROM transactions
        JOIN total_sold USING(crypto_pair)
        WHERE transaction_type = 'продажа' AND user_id = $1
            AND date >= $2
            AND date <= $3
        GROUP BY crypto_pair`,
        `SELECT crypto_pair, total_sold, round(avg_sold_price, 7) AS avg_sold_price, ROUND(total_sold * avg_sold_price, 2) AS received, ROUND((avg_sold_price / avg_purchase_price - 1) * 100, 2) || '% | ' || ROUND((avg_sold_price - avg_purchase_price) * total_sold, 2) as profit
        FROM total_sold
        JOIN avg_sold_price USING(crypto_pair)
        JOIN avg_purchase_price USING(crypto_pair)`
    ]
    var res = await makeReqToDb(r, [22, '2024-10-10', '2024-10-15'], [22, '2024-10-10', '2024-10-15'], [22, '2024-10-10', '2024-10-15'], [22, '2024-10-10', '2024-10-15'], [22, '2024-10-10', '2024-10-15'])
    console.log(res.rows)
}
// getRealizedPnL()

export default routes;