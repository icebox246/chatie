require('dotenv').config();
const http = require('http')
const express = require('express');
const cookieParser = require('cookie-parser')
const WS = require('ws');
const db = require('./db');
const avatar = require('./avatar');

db.initTables()

const app = express();

app.set('view engine', 'pug');
app.use(express.urlencoded({extended: true}));
app.use(cookieParser());

app.use(express.static('public'));

app.get('/', async (req, res) => {
    const token = req.cookies.chatToken;
    const userInfo = (token) ? await db.getUserInfo(token) : null;

    res.render('landing', {login: userInfo ? userInfo.login : null});
})

app.post('/register', async (req, res) => {
    if (req.body && req.body.login && req.body.password) {
        const outcome = await db.addUser(req.body.login, req.body.password);
        if (outcome == 'successful') {
            const token = await db.loginUser(req.body.login, req.body.password);
            if (token == 'failed') {
                res.render(
                    'fail',
                    {what: 'login, because account info is wrong!', lnk: '/'});
                return;
            }

            if (token == 'error') {
                res.render(
                    'fail', {what: 'login, due to database error!', lnk: '/'});
                return;
            }

            res.cookie('chatToken', token);

            res.redirect('/');
        } else if (outcome == 'taken') {
            res.render(
                'fail',
                {what: 'register, because this login is taken!', lnk: '/'})
        } else {
            res.render(
                'fail', {what: 'register, due to database error!', lnk: '/'})
        }
    } else {
        res.status(400);
        res.end();
    }
})

app.post('/login', async (req, res) => {
    if (req.body && req.body.login && req.body.password) {
        const token = await db.loginUser(req.body.login, req.body.password);
        if (token == 'failed') {
            res.render(
                'fail',
                {what: 'login, because account info is wrong!', lnk: '/'});
            return;
        }

        if (token == 'error') {
            res.render(
                'fail', {what: 'login, due to database error!', lnk: '/'});
            return;
        }

        res.cookie('chatToken', token);

        res.redirect('/');
    } else {
        res.status(400);
        res.end();
    }
})

app.get('/logout', (_req, res) => {
    res.cookie('chatToken', '');
    res.redirect('/');
})

app.get('/chat', async (req, res) => {
    const token = req.cookies.chatToken;
    const userInfo = (token) ? await db.getUserInfo(token) : null;
    if (!userInfo) {
        res.status(403);
        res.end();
        return;
    }
    res.render('chat', {
        login: userInfo.login,
        channels: userInfo.channels !== null ? userInfo.channels : []
    });
})

app.get('/avatar/:name', (req, res) => {
    if (!req.params.name) {
        res.send(404);
        res.end();
        return;
    }

    res.type('image/svg+xml');
    res.send(avatar.generateAvatar(req.params.name));
    res.end();
})


const server = http.createServer(app)
const wss = new WS.Server({server});

wss.on('connection', async (socket, request) => {
    const token = request.headers.cookie.split(';')
                      .map(v => [key, val] = v.trim().split('='))
                      .filter(p => {
                          let [k, _] = p;
                          return k == 'chatToken'
                      })[0][1];

    const userInfo = (token) ? await db.getUserInfo(token) : null;

    if (userInfo) {
        socket.on('message', async (message) => {
            const data = await JSON.parse(message);

            console.log(data);

            if (data.msg) {
                const messageId = await db.addMessage(
                    userInfo.id, data.msg.text, data.msg.channel);
                if (messageId == null) return;

                data.msg.name = userInfo.login;
                data.msg.id = messageId;

                wss.clients.forEach(
                    c => c.send(JSON.stringify({msg: data.msg})));
            }
            if (data.fetch) {
                if (data.fetch.newest) {
                    const messages =
                        await db.fetchNewestMessages(data.fetch.channel);
                    socket.send(JSON.stringify(
                        {append: {channel: data.fetch.channel, messages}}));
                } else if (data.fetch.before) {
                    const messages = await db.fetchMessagesBefore(
                        data.fetch.channel, data.fetch.before);
                    socket.send(JSON.stringify(
                        {prepend: {channel: data.fetch.channel, messages}}));
                }
            }

            if (data.subscribe) {
                await db.subscribeUserToChannel(userInfo.id, data.subscribe);
            }
            if (data.unsubscribe) {
                await db.unsubscribeUserToChannel(
                    userInfo.id, data.unsubscribe);
            }

            if (data.delete && data.delete.id) {
                const res = await db.deleteMessage(data.delete.id);

                if (res)
                    wss.clients.forEach(
                        c => c.send(JSON.stringify({delete: {...res}})));
            }
        });
    } else {
        socket.close();
    }
})


server.listen(process.env.PORT);
