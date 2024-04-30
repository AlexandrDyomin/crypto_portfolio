import { createServer } from 'http';
import routes from './routes.js';

const PROTOCOL = process.env.PROTOCOL;
const HOST = process.env.HOST;
const PORT = process.env.PORT;

const server = createServer();
server.on('request', handleRequest);
server.listen(PORT, HOST, handleConnection);

async function handleRequest(req, res) {  
    res.setHeader('Access-Control-Allow-Origin', `http://${HOST}:${PORT}`);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    
    var extention = req.url.match(/\.\w+$/)?.[0];
    if (extention) {
        routes.sendResource(req, res, { extention });
        return;
    }
    
    var pathname = req.url.match(/\/.*/)[0];
    routes[pathname] ? routes[pathname](req, res) : routes.postPage404(req, res);
}

function handleConnection() {
    console.log(`Server is running on ${PROTOCOL}://${HOST}:${PORT}`);
}