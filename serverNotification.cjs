const express = require('express');
const { Server } = require('ws');
const cors = require('cors');

const app = express();
const PORT = 6001;

// Middleware pour les requêtes CORS
app.use(cors());
app.use(express.json());

// Créer un serveur WebSocket
const wss = new Server({ noServer: true });

const clients = {}; // Pour stocker les connexions des utilisateurs

// Gérer les connexions WebSocket
wss.on('connection', (ws, req) => {
    const userId = req.headers['sec-websocket-protocol'];

    if (!userId) {
        ws.close(); // Fermer la connexion si userId n'est pas fourni
        console.error('User ID not provided, connection closed.');
        return;
    }

    clients[userId] = ws; // Stocker le client avec son ID utilisateur
    console.log(`User connected: ${userId}`);

    ws.on('close', () => {
        delete clients[userId]; // Supprimer le client à la déconnexion
        console.log(`User disconnected: ${userId}`);
    });

    // Gérer les erreurs de connexion WebSocket
    ws.on('error', (error) => {
        console.error(`WebSocket error for user ${userId}:`, error);
    });
});

// Écouter les connexions HTTP pour mise à niveau vers WebSocket
const server = app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});

server.on('upgrade', (request, socket, head) => {
    const userId = request.headers['sec-websocket-protocol'];

    if (!userId) {
        socket.destroy(); // Fermer la connexion si userId n'est pas fourni
        console.error('User ID not provided for WebSocket upgrade, connection closed.');
        return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});

// Fonction pour diffuser un message à un utilisateur spécifique
const broadcastToUser = (userId, message) => {
    if (clients[userId]) {
        clients[userId].send(JSON.stringify(message));
    } else {
        console.warn(`User ${userId} is not connected, message not sent.`);
    }
};

// Endpoint pour recevoir les messages de Laravel et diffuser via WebSocket
app.post('/broadcast', (req, res) => {
    const { userId, message } = req.body;

    // Vérifier si l'utilisateur est connecté
    if (!clients[userId]) {
        return res.status(404).send({ status: 'User not connected' });
    }

    // Diffuser le message à l'utilisateur
    broadcastToUser(userId, { message });
    res.status(200).send({ status: 'Message broadcasted' });
});
