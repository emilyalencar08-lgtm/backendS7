const express = require('express');
const jwt = require('jsonwebtoken');
const http = require('http');
const WebSocket = require('ws');

const app = express();
app.use(express.json());

const SECRET_KEY = 'my_secret_key';

const users = [
  { id: 1, username: 'user1', password: 'password1', role: 'user' },
  { id: 2, username: 'admin', password: 'adminpass', role: 'admin' }
];

// Gera o token JWT
function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    SECRET_KEY,
    { expiresIn: '1h' }
  );
}

// Valida token
function authenticateWebSocket(token, cb) {
  if (!token) return cb('Token não fornecido');

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) return cb('Token inválido');
    cb(null, decoded);
  });
}

// Rota de login
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  const user = users.find(
    (u) => u.username === username && u.password === password
  );

  if (!user) {
    return res.status(401).json({ erro: 'Credenciais inválidas' });
  }

  const token = generateToken(user);

  res.json({
    mensagem: 'Login realizado com sucesso',
    token
  });
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Conexão WebSocket
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost:3000');
  const token = url.searchParams.get('token');

  authenticateWebSocket(token, (err, user) => {
    if (err) {
      ws.send(JSON.stringify({ erro: err }));
      ws.close();
      return;
    }

    ws.user = user;

    ws.send(
      JSON.stringify({
        mensagem: `Conectado com sucesso como ${user.role}`,
        usuario: user.username
      })
    );

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);

        // Exemplo de ação só para admin
        if (message.tipo === 'monitorar_salas') {
          if (ws.user.role !== 'admin') {
            ws.send(
              JSON.stringify({
                erro: 'Acesso negado: apenas admin pode monitorar salas'
              })
            );
            return;
          }

          ws.send(
            JSON.stringify({
              mensagem: 'Admin autorizado a monitorar salas'
            })
          );
          return;
        }

        // Mensagem comum
        ws.send(
          JSON.stringify({
            mensagem: `Mensagem recebida de ${ws.user.username}`,
            conteudo: message.conteudo
          })
        );
      } catch (error) {
        ws.send(JSON.stringify({ erro: 'Mensagem em formato inválido' }));
      }
    });
  });
});

server.listen(3000, () => {
  console.log('Servidor rodando em http://localhost:3000');
});

