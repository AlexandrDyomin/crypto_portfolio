import { renderFile } from 'pug';
import { readFileSync } from 'fs';
import pool from './pgPool.js';
import prepareQueryToCreateAccount from './sql_commands/creating_accounts.js';
import generateSessionId from './generateSessionId.js';

const PROTOCOL = process.env.PROTOCOL;
const HOST = process.env.HOST;
const PORT = process.env.PORT;

var routes = {
    '/': sendIndexPage,
    '/login': sendLoginPage,
    '/sign_up': sendSignUpPage,
    '/create_accaunt': createAccaunt,
    '/auth': authenticate,
    sendResource,
    postPage404
};

// handlers
async function sendIndexPage(req, res) {
    try {
        var { session_id } = parceString(req.headers.cookie || '', '; ');
        if (session_id) {
            var userId = (await makeReqToDb(
                'SELECT user_id FROM sessions WHERE session_id = $1', 
                session_id
            )).rows[0]?.user_id;
        }
        
        if (!session_id || !userId) {
            redirect(res, '/login');
            return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(renderFile('./index.pug', { cache: true }));
    } catch (err) {
        handleError(res, err);
    }
}

async function sendLoginPage(req, res) {
    try {
        var { session_id, authError } = parceString(req.headers.cookie || '', '; ');
        if (session_id) {
            var userId = (await makeReqToDb(
                'SELECT user_id FROM sessions WHERE session_id = $1', 
                session_id
            )).rows[0]?.user_id;
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
            warning
        }));
    } catch (err) {
        handleError(res, err);
    }
}

async function sendSignUpPage(req, res) {
    try {
        res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
        res.end(renderFile('./sign_up/index.pug', { 
            cache: true,
            action: `${PROTOCOL}://${HOST}:${PORT}/create_accaunt`,
            loginPlaceholder: 'Логин',
            passwordPlaceholder: 'Пароль',
            buttonText: 'Создать аккаунт',
            linkToLogin: `${PROTOCOL}://${HOST}:${PORT}/login`
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
            var data = parceString(body[0].toString());
            var query = prepareQueryToCreateAccount(data.login, data.password);
            await makeReqToDb(query);
            redirect(res, '/login');
        } catch (e) {
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
            var { login, password } = parceString(body[0].toString());
            await makeReqToDb(`SELECT id FROM users WHERE login = $1 AND password = $2`, [login, password]);
            var user_id = (await makeReqToDb(`SELECT id FROM users WHERE login = $1 AND password = $2`, [login, password])).rows[0]?.id;
            if (!user_id) {
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

function parceString(qs, sep = '&') {
    var data = qs.split(sep).map((item) => item.split('='));
    return Object.fromEntries(data);
}

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

export default routes;