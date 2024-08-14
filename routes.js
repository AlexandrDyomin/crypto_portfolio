import { renderFile } from 'pug';
import { readFileSync } from 'fs';
import pool from './pgPool.js';
import { generateRandomHexString as generateSessionId, hash, verify } from './cryptography.js';

const PROTOCOL = process.env.PROTOCOL;
const HOST = process.env.HOST;
const PORT = process.env.PORT;

var routes = {
    '/': sendIndexPage,
    '/login': sendLoginPage,
    '/sign_up': sendSignUpPage,
    '/create_accaunt': createAccaunt,
    '/auth': authenticate,
    '/transactions': sendTransactionsPage,
    '/p2p': 'sendP2pPage',
    '/realizedPnL': 'sendRealizedPnL',
    '/unrealizedPnL': 'sendUnrealizedPnL',
    sendResource,
    postPage404
};

// handlers
async function sendIndexPage(req, res) {
    try {
        var { session_id } = parseCookie(req.headers.cookie || '');
        if (session_id) {
            var userId = await getUserId(session_id);
        }
        
        if (!session_id || !userId) {
            redirect(res, '/login');
            return;
        }

        var thead = ['Пара', 'Количество', 'Средняя цена покупки', 'Сумма', 'Текущая цена', 'Изменение цены'];

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(renderFile('./index.pug', { 
            cache: true,
            title: 'Кошелёк',
            h1: 'Кошелёк',
            thead,
            rows: [{ ticker: 'btc', amount: 12 }]
        }));
    } catch (err) {
        handleError(res, err);
    }
}



async function sendTransactionsPage(req, res) {
    try {
        var { session_id } = parseCookie(req.headers.cookie || '');
        if (session_id) {
            var userId = await getUserId(session_id);
        }
        
        if (!session_id || !userId) {
            redirect(res, '/login');
            return;
        }
        var thead = ['Пара', 'Дата', 'Тип транзакции', 'Количество', 'Цена', 'Сумма', ''];
        var rows = await getRows(userId);
        formatData(rows);

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(renderFile('./transactions.pug', { 
            cache: true,
            title: 'Транзакции',
            h1: 'Транзакции',
            thead,
            rows
        }));
    } catch (err) {
        handleError(res, err);
    }
    
    async function getRows(id) {
        var result = await makeReqToDb('SELECT id, crypto_pair, date, transaction_type, amount, price, amount * price AS sum FROM transactions WHERE user_id = $1', [id]);
        return result.rows;
    }
}


function formatData(rows) {
    var formatterDates = new Intl.DateTimeFormat('ru');
    rows.forEach((row) => {
        row.date = formatterDates.format(row.date);
        ['amount', 'price', 'sum'].forEach((prop) => {
            row[prop] = parseFloat(row[prop]).toString();
        })
    });
}

async function sendLoginPage(req, res) {
    try {
        var { session_id, authError } = parseCookie(req.headers.cookie || '');
        if (session_id) {
            var userId = await getUserId(session_id);
        }
        
        if (session_id && userId) {
            redirect(res, '/');
            return;
        }

        if (authError === 'true') {
            var warning = 'Ошибочка вышла. 😕 Попробуйте еще разок.'
        }

        res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
        res.end(renderFile('./login/index.pug', { 
            cache: true,
            action: `${PROTOCOL}://${HOST}:${PORT}/auth`,
            loginPlaceholder: 'Логин',
            passwordPlaceholder: 'Пароль',
            buttonText: 'Войти',
            linkToSignUp: `${PROTOCOL}://${HOST}:${PORT}/sign_up`,
            warning,
            title: 'Вход',
            h1: 'Вход'
        }));
    } catch (err) {
        handleError(res, err);
    }
}

async function sendSignUpPage(req, res) {
    try {
        var { session_id, accountCreationError } = parseCookie(req.headers.cookie || '');
        if (session_id) {
            var userId = await getUserId(session_id);
        }

        if (session_id && userId) {
            redirect(res, '/');
            return;
        }
        
        if (accountCreationError === 'true') {
            var warning = 'Выбирите другой логин, пожалуйста! 😕'
        }

        res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
        res.end(renderFile('./sign_up/index.pug', { 
            cache: true,
            action: `${PROTOCOL}://${HOST}:${PORT}/create_accaunt`,
            loginPlaceholder: 'Логин',
            passwordPlaceholder: 'Пароль',
            buttonText: 'Создать аккаунт',
            linkToLogin: `${PROTOCOL}://${HOST}:${PORT}/login`,
            warning,
            title: 'Создание аккаунта',
            h1: 'Создайте свой аккаунт'
        }));
    } catch (err) {
        handleError(res, err);
    }
}

function sendResource(req, res, { contentType, cacheControl = 'public, max-age=604800' }) {
    try {
        if (!contentType) throw Error('Тип контента не определён');
        var resource = readFileSync(`.${req.url}`);
        res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': cacheControl});
        res.end(resource);
    } catch(err) {
        handleError(res, err);
    }
}

function postPage404(req, res) {
    res.writeHead(404);
    res.end('Page not found');
}

function handleError(res, err, codeResponse = 500, headers = { 'Content-Type': 'text/html; charset=utf-8' }) {
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
            handleError(res, err);
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
                console.log(2222)
                res.setHeader('Set-Cookie', 'authError=true; max-age=1');
                redirect(res, '/login');
                return;
            } 
            
            var session_id = generateSessionId();
            await makeReqToDb('INSERT INTO sessions (session_id, user_id) VALUES ($1, $2)', [session_id, user_id]);
            res.setHeader('Set-Cookie', `session_id=${session_id}; SameSite=Strict; HttpOnly; max-age=604800;`)
            redirect(res, '/');
        } catch (err) {
            handleError(res, err);
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

function redirect(res, location) {
    res.writeHead(302, { 'Location': location });
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

export default routes;