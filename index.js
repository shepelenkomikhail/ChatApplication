const express = require('express');
const cors = require('cors');
const { createServer } = require('node:http');
const { join } = require('node:path');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const { availableParallelism } = require('node:os');
const cluster = require('node:cluster');
const { createAdapter, setupPrimary } = require('@socket.io/cluster-adapter');

if (cluster.isPrimary) {
    const numCPUs = 1;
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

    app.use(cors({
        origin: '*',
        methods: ['GET', 'POST', 'DELETE'],
    }));

    app.options('*', cors());

    app.use(express.static('public'));

    app.get("/", (req, res) => {
        res.sendFile(join(__dirname, 'index.html'));
    });

    app.delete('/', async (req, res) => {
        console.log('Received DELETE request');
        try {
            await db.run(`DELETE FROM messages`);
            res.status(200).json({ success: true, message: 'Table "messages" deleted successfully.' });
        } catch (error) {
            console.error('Error clearing table:', error.message);
            res.status(500).json({ success: false, message: 'Failed to delete table.', error: error.message });
        }
    });

    const io = new Server(server, {
        connectionStateRecovery: {},
        adapter: createAdapter(),
        cors: {
            origin: "*",
            methods: ["GET", "POST", "DELETE"]
        }
    });

    io.on('connection', async (socket) => {
        console.log(`Client connected: ${socket.id}`);
        socket.on('chat message', async (msg, clientOffset, callback) => {
            console.log(`Received message: "${msg}" from ${socket.id} with offset: ${clientOffset}`);

            let result;
            try {
                result = await db.run('INSERT INTO messages (content, client_offset) VALUES (?, ?)', msg, clientOffset);
                console.log(`✅ Message saved to DB with ID: ${result.lastID}`);
            } catch (e) {
                if (e.errno === 19 /* SQLITE_CONSTRAINT */) {
                    console.log(`⚠️ Duplicate message ignored: ${clientOffset}`);
                    if (typeof callback === 'function') {
                        callback({ success: false, error: "Duplicate message" });
                    }
                    return;
                }
                return;
            }

            io.emit('chat message', msg, result.lastID, socket.id);
            console.log(`📢 Message broadcasted: "${msg}"`);

            if (typeof callback === 'function') {
                console.log("🔄 Sending callback response to client...");
                callback({ success: true, message: "Message received and stored" });
            } else {
                console.log("⚠️ Callback is not a function, cannot send acknowledgment!");
            }
        });

        if (!socket.recovered) {
            try {
                await db.each('SELECT id, content FROM messages WHERE id > ?',
                    [socket.handshake.auth.serverOffset || 0],
                    (_err, row) => {
                        socket.emit('chat message', row.content, row.id);
                    }
                );
            } catch (e) {
                console.error(e);
            }
        }
    });

    const port = process.env.PORT || 3000;
    server.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
}

main();