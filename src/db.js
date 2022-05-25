const postgres = require('postgres')

const crypto = require('crypto');
const {v4: uuidv4} = require('uuid');

function sha256(msg) {
    return crypto.createHash('sha256').update(msg).digest('base64');
}

const sql = postgres(process.env.DATABASE_URL, {ssl: false});

async function initTables() {
    await sql`
		create table if not exists UserAcc
		(
			id 			serial 		PRIMARY KEY,
			login 		text 		UNIQUE NOT NULL,
			passHash	text		NOT NULL,
			token		text		NOT NULL,
			channels	varchar(10)[] DEFAULT '{"main"}'
		);
	`

        await sql`
		create table if not exists Message
		(
			id 			serial 		PRIMARY KEY,
			userId		int			REFERENCES UserAcc (id),
			content		text		NOT NULL,
			channel		varchar(10) NOT NULL
		);
	`
}

async function addUser(login, password) {
    try {
        if ((await sql`select login from UserAcc where login = ${login};`)
                .count != 0) {
            return 'taken';
        }

        await sql`
		insert into UserAcc (login, passHash, token)
			values (${login},${sha256(password)},${uuidv4()});
		`;

        return 'successful';
    } catch (e) {
        return 'error';
    }
}

async function loginUser(login, password) {
    try {
        const res = await sql`
		select token from UserAcc 
		where login = ${login} and passHash = ${sha256(password)};
		`
        if (res.count == 0) {
            return 'failed';
        }

        return res.shift().token;
    } catch (e) {
        console.error(e);
        return 'error';
    }
}

async function getUserInfo(token) {
    try {
        const res = await sql`
		select id,login,channels from UserAcc 
		where token = ${token};
		`
        if (res.count == 0) {
            return null;
        }

        return res.shift();
    } catch (e) {
        console.error(e);
        return null;
    }
}

async function addMessage(userId, text, chann) {
    try {
        const res = await sql`
		insert into Message (userId,content,channel)
		values (${userId},${text},${chann})
		returning id;
		`

        if (res.count == 0) {
            return null;
        }

        return res.shift().id;
    } catch (e) {
        console.error(e);
        return null;
    }
}

async function deleteMessage(messageId) {
    try {
        const res = await sql`
		delete from Message 
		where id = ${messageId}
		returning id,channel;
		`

        if (res.count == 0) {
            return null;
        }

        return res.shift();
    } catch (e) {
        console.error(e);
        return null;
    }
}

async function fetchNewestMessages(chann, limit = 20) {
    try {
        const res = await sql`
		select Message.id as id, UserAcc.login as name, Message.content as text
		from Message left join UserAcc on Message.userId = UserAcc.id
		where Message.channel = ${chann}
		order by Message.id desc
		limit ${limit};
		`
        return res.flat().reverse();
    } catch (e) {
        console.error(e);
        return null;
    }
}

async function fetchMessagesBefore(chann, before, limit = 20) {
    try {
        const res = await sql`
		select Message.id as id, UserAcc.login as name, Message.content as text
		from Message left join UserAcc on Message.userId = UserAcc.id
		where Message.id < ${before}
			and Message.channel = ${chann}
		order by Message.id desc
		limit ${limit};
		`
        return res.flat().reverse();
    } catch (e) {
        console.error(e);
        return null;
    }
}

async function subscribeUserToChannel(userId, chann) {
    try {
        await sql`
		update UserAcc 
		set channels = array_append(channels,${chann})
		where UserAcc.id = ${userId};
		`
    } catch (e) {
        console.error(e);
    }
}

async function unsubscribeUserToChannel(userId, chann) {
    try {
        await sql`
		update UserAcc 
		set channels = array_remove(channels,${chann})
		where UserAcc.id = ${userId};
		`
    } catch (e) {
        console.error(e);
    }
}

module.exports = {
    sql,
    initTables,
    addUser,
    loginUser,
    getUserInfo,
    addMessage,
    deleteMessage,
    fetchNewestMessages,
    fetchMessagesBefore,
    subscribeUserToChannel,
    unsubscribeUserToChannel,
}

