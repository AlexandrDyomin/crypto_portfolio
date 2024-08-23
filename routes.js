import { renderFile } from 'pug';
import { readFileSync } from 'fs';
import pool from './pgPool.js';
import { generateRandomHexString as generateSessionId, hash, verify } from './cryptography.js';

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
            var result = await makeReqToDb('SELECT id, crypto_pair, date, transaction_type, amount, price, amount * price AS sum FROM transactions WHERE user_id = $1', [userId]);
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
    '/p2p': 'sendP2pPage',
    '/realizedPnL': 'sendRealizedPnL',
    '/unrealizedPnL': 'sendUnrealizedPnL',
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
                'INSERT INTO transactions(user_id, crypto_pair, date, transaction_type, amount, price) VALUES($1, $2, $3, $4, $5, $6)', 
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
            var result = await makeReqToDb('DELETE FROM transactions WHERE id=$1', [id]);
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
                `UPDATE transactions 
                SET crypto_pair = $1, date = $2, transaction_type = $3, amount = $4, price = $5
                WHERE id = $6`, 
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
            await makeReqToDb('INSERT INTO users (login, password) VALUES ($1, $2)', [login, await hash(password)]);
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
                `SELECT id, password FROM users WHERE login = $1`, 
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
            await makeReqToDb('INSERT INTO sessions (session_id, user_id) VALUES ($1, $2)', [session_id, user_id]);
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
    var client = await pool.connect();
    var result = await client.query(query, values.flat());
    client.release();
    return result;
}

async function getUserId(session_id) {
    var userId = (await makeReqToDb(
        'SELECT user_id FROM sessions WHERE session_id = $1', 
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
    data.date = new Date(data.date).toISOString().match(/\d{4}-\d{2}-\d{2}/)[0];
    data.amount = parseFloat(data.amount);
    data.price = parseFloat(data.price);
    data.id && (data.id = parseInt(data.id));
}

export default routes;