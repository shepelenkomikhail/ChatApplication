const express = require('express');
const { createServer } = require('node:http');
const { join } = require('node:path');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const { availableParallelism } = require('node:os');
const cluster = require('node:cluster');
const { createAdapter, setupPrimary } = require('@socket.io/cluster-adapter');

if (cluster.isPrimary) {
    const numCPUs = availableParallelism();
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork({
            PORT: 3000 + i
        });
    }
    return setupPrimary();
}

async function main() {
    const db = await open({
        filename: 'chat.db',
        driver: sqlite3.Database
    });

    await db.exec(`CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, client_offset TEXT UNIQUE, content TEXT);`);

    const app = express();
    const server = createServer(app);
    const io = new Server(server, { connectionStateRecovery: {}, adapter: createAdapter() });

    app.use(express.static('public'));

    app.get('/', (req, res) => {
        res.sendFile(join(__dirname, 'index.html'));
    });

    app.delete('/', async (req, res) => {
        try {
            await db.run(`DELETE FROM messages`);
            res.status(200).json({ success: true, message: 'Table "messages" deleted successfully.' });
        } catch (error) {
            console.error('Error clearing table:', error.message);
            res.status(500).json({ success: false, message: 'Failed to delete table.', error: error.message });
        }
    });


    io.on('connection', async (socket) => {
        socket.on('chat message', async (msg, clientOffset, callback) => {
            let result;
            try {
                result = await db.run('INSERT INTO messages (content, client_offset) VALUES (?, ?)', msg, clientOffset);
            } catch (e) {
                if (e.errno === 19 /* SQLITE_CONSTRAINT */) { if (typeof callback === 'function') callback(); }
                return;
            }
            io.emit('chat message', msg, result.lastID, socket.id);
            if (typeof callback === 'function') callback();
        });

        if (!socket.recovered) {
            try {
                await db.each('SELECT id, content FROM messages WHERE id > ?',
                    [socket.handshake.auth.serverOffset || 0],
                    (_err, row) => {
                        socket.emit('chat message', row.content, row.id);
                    }
                )
            } catch (e) {
                console.error(e)
            }
        }
    });

    const port = process.env.PORT || 3000;

    server.listen(port, () => {
        console.log(`server running at http://localhost:${port}`);
    });
}

main();