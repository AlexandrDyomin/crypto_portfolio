import { renderFile } from 'pug';
import { readFileSync } from 'fs';

const PROTOCOL = process.env.PROTOCOL;
const HOST = process.env.HOST;
const PORT = process.env.PORT;

var routes = {
    '/': sendIndexPage,
    '/login': sendLoginPage,
    '/sign_up': sendSignUpPage,
    sendResource,
    postPage404
};

async function sendIndexPage(req, res) {
    try {
        var isLogined = true;
        res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
        res.end(renderFile('./index.pug', { 
            cache: true,
            isLogined
        }));
    } catch (err) {
        handleError(res, err);
    }
}

async function sendLoginPage(req, res) {
    try {
        var isLogined = true;
        res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
        res.end(renderFile('./login/index.pug', { 
            cache: true,
            isLogined,
            action: `${PROTOCOL}://${HOST}:${PORT}/`,
            loginPlaceholder: 'Логин',
            passwordPlaceholder: 'Пароль',
            buttonText: 'Войти',
            linkToSignUp: `${PROTOCOL}://${HOST}:${PORT}/sign_up`
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
            action: `${PROTOCOL}://${HOST}:${PORT}/login`,
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
    res.end(err.message);
}

export default routes;
