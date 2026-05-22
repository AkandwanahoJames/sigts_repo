// backend/src/intranet-websocket.js — hardened LAN peer channel (ping/pong, bounded payloads)
const WebSocket = require('ws');

const clients = new Set();
const MAX_MESSAGE_BYTES = 64 * 1024;
const PING_INTERVAL_MS = 30000;

function setupIntranetWebSocket(server) {
    const wss = new WebSocket.Server({
        server,
        path: '/intranet',
        maxPayload: MAX_MESSAGE_BYTES,
        clientTracking: true,
    });

    const heartbeatTimer = setInterval(() => {
        for (const ws of clients) {
            if (ws.isAlive === false) {
                clients.delete(ws);
                ws.terminate();
                continue;
            }
            ws.isAlive = false;
            try {
                ws.ping();
            } catch (_) {
                /**/
            }
        }
    }, PING_INTERVAL_MS);

    wss.on('close', () => clearInterval(heartbeatTimer));

    wss.on('connection', (ws, req) => {
        const clientIp = req.socket.remoteAddress;
        ws.isAlive = true;
        ws.on('pong', () => {
            ws.isAlive = true;
        });

        clients.add(ws);

        ws.send(
            JSON.stringify({
                type: 'connected',
                peers: clients.size,
                timestamp: new Date().toISOString(),
            })
        );

        broadcastIntranetMessage({
            type: 'peer_joined',
            peer: clientIp,
            totalPeers: clients.size,
        });

        ws.on('message', (data) => {
            if (data && data.length > MAX_MESSAGE_BYTES) return;
            try {
                const message = JSON.parse(data);
                handleIntranetMessage(ws, message);
            } catch (_) {
                /**/
            }
        });

        ws.on('close', () => {
            clients.delete(ws);
            broadcastIntranetMessage({
                type: 'peer_left',
                totalPeers: clients.size,
            });
        });

        ws.on('error', () => {
            clients.delete(ws);
        });
    });
}

function broadcastIntranetMessage(message) {
    const data = JSON.stringify(message);
    clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(data);
            } catch (_) {
                /**/
            }
        }
    });
}

function handleIntranetMessage(ws, message) {
    switch (message.type) {
        case 'get_peers':
            ws.send(
                JSON.stringify({
                    type: 'peers_list',
                    peers: clients.size,
                })
            );
            break;
        case 'sync_request':
            broadcastIntranetMessage({
                type: 'content_update',
                source: message.source,
                at: new Date().toISOString(),
            });
            break;
        default:
            break;
    }
}

module.exports = { setupIntranetWebSocket, broadcastIntranetMessage };
