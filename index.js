import { createServer } from 'http';
import routes from './routes.js';
import pool from './pgPool.js';

const PROTOCOL = process.env.PROTOCOL;
const HOST = process.env.HOST;
const PORT = process.env.PORT;

const server = createServer();
server.on('request', handleRequest);
server.listen(PORT, HOST, handleConnection);
server.on('close', handleClose);

async function handleRequest(req, res) {  
    res.setHeader('Access-Control-Allow-Origin', `http://${HOST}:${PORT}`);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    
    var contentType = defineContentType(req.url)
    if (contentType) {
        routes.sendResource(req, res, { contentType });
        return;
    }
    
    var pathname = new URL(req.url, `http://${HOST}:${PORT}`).pathname
    routes[pathname] ? routes[pathname](req, res) : routes.postPage404(req, res);
}

function handleConnection() {
    console.log(`Server is running on ${PROTOCOL}://${HOST}:${PORT}`);
}

function defineContentType(url) {
    var contentTypes = {
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.map': 'text/plain',
        '.ico': 'image/x-icon',
        '.jpg': 'image/jpeg',
        '.png': 'image/jpeg'

    };
    var extention = url.match(/\.js|\.css|\.map|\.ico|\.jpg|\.png/)?.[0];
    return contentTypes[extention];
}

function handleClose() {
    pool.end();
}