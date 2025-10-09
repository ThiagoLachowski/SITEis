const path = require('path');
const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// segurança mínima para cookies/JWT
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-prod';

app.use(cookieParser());

// Pasta do front-end (caminho até ../siteiS/front a partir de siteiS2/back)
const FRONT_DIR = path.join(__dirname, '..', '..', 'siteiS', 'front');

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Função que verifica se o request é para rota pública
const PUBLIC_PATHS = ['/login', '/login.html', '/cadastro.html', '/health', '/register', '/contact', '/favicon.ico'];

function isPublic(reqPath) {
  const p = reqPath.split('?')[0];
  // arquivos estáticos com essas extensões também são públicos (index.css, scripts, imagens, fontes)
  const staticExt = /\.(css|js|png|jpg|jpeg|svg|ico|woff2?|ttf|map)$/i;
  return PUBLIC_PATHS.includes(p) || p.startsWith('/img') || p.startsWith('/css') || p.startsWith('/js') || staticExt.test(p);
}

// middleware que protege rotas: se não public e sem cookie válido -> redireciona para /login.html
app.use((req, res, next) => {
  try {
    // proteger também a raiz '/'
    if (isPublic(req.path)) return next();
    const token = req.cookies && req.cookies['siteis_token'];
    if (!token) return res.redirect('/login.html');
    try {
      jwt.verify(token, JWT_SECRET);
      return next();
    } catch (e) {
      return res.redirect('/login.html');
    }
  } catch (e) {
    return next();
  }
});

// Servir arquivos estáticos do front
app.use(express.static(FRONT_DIR));

// Endpoint de health
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Receber contato (ex: form action POST /contact)
app.post('/contact', (req, res) => {
  const data = {
    time: new Date().toISOString(),
    ip: req.ip,
    body: req.body,
  };

  const msgsFile = path.join(__dirname, 'messages.json');
  let msgs = [];
  try {
    if (fs.existsSync(msgsFile)) {
      const raw = fs.readFileSync(msgsFile, 'utf8');
      msgs = JSON.parse(raw || '[]');
    }
  } catch (e) {
    console.error('Erro lendo messages.json', e);
  }

  msgs.push(data);

  try {
    fs.writeFileSync(msgsFile, JSON.stringify(msgs, null, 2), 'utf8');
  } catch (e) {
    console.error('Erro escrevendo messages.json', e);
    return res.status(500).json({ error: 'Não foi possível salvar a mensagem' });
  }

  res.json({ status: 'ok', saved: true });
});

// Endpoint de registro de usuário
app.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ error: 'Campos faltando' });

    const usersFile = path.join(__dirname, 'users.json');
    let users = [];
    try {
      if (fs.existsSync(usersFile)) {
        const raw = fs.readFileSync(usersFile, 'utf8');
        users = JSON.parse(raw || '[]');
      }
    } catch (e) {
      console.error('Erro lendo users.json', e);
      return res.status(500).json({ error: 'Erro interno' });
    }

    const exists = users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
    if (exists) return res.status(409).json({ error: 'Email já cadastrado' });

    const bcrypt = require('bcryptjs');
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);

    const newUser = {
      id: Date.now(),
      name,
      email: email.toLowerCase(),
      passwordHash: hash,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);

    try {
      fs.writeFileSync(usersFile, JSON.stringify(users, null, 2), 'utf8');
    } catch (e) {
      console.error('Erro escrevendo users.json', e);
      return res.status(500).json({ error: 'Não foi possível salvar usuário' });
    }

    // Não retornar o hash ao cliente
    const { passwordHash, ...safe } = newUser;
    return res.json({ ok: true, user: safe });
  } catch (e) {
    console.error('Erro no /register', e);
    return res.status(500).json({ error: 'Erro interno' });
  }
});

// Endpoint de logout: limpa cookie
app.post('/logout', (req, res) => {
  res.clearCookie('siteis_token');
  return res.json({ ok: true });
});

// Endpoint de login
app.post('/login', (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Campos faltando' });

    const usersFile = path.join(__dirname, 'users.json'); //12
    let users = [];
    try {
      if (fs.existsSync(usersFile)) {
        const raw = fs.readFileSync(usersFile, 'utf8');
        users = JSON.parse(raw || '[]');
      }
    } catch (e) {
      console.error('Erro lendo users.json', e);
      return res.status(500).json({ error: 'Erro interno' });
    }

    const user = users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
    if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });

    const bcrypt = require('bcryptjs');
    const ok = bcrypt.compareSync(password, user.passwordHash || '');
    if (!ok) return res.status(401).json({ error: 'Credenciais inválidas' });

    const { passwordHash, ...safe } = user;
    // gerar JWT e setar cookie HttpOnly
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '2h' });
    res.cookie('siteis_token', token, { httpOnly: true, sameSite: 'Lax' });
    return res.json({ ok: true, user: safe });
  } catch (e) {
    console.error('Erro no /login', e);
    return res.status(500).json({ error: 'Erro interno' });
  }
});

// Fallback: enviar index.html para rotas desconhecidas (SPA friendly)
app.get('*', (req, res) => {
  const indexPath = path.join(FRONT_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Arquivo não encontrado');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
