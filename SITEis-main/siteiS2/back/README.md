# Backend simples para siteiS

Instruções rápidas para rodar o backend que serve o front-end estático em `../front`.

Pré-requisitos
- Node.js (recomendado v16+)

Passos

1. Abra um terminal na pasta `siteiS2/back`.
2. Instale dependências: `npm install`.
3. Inicie o servidor: `npm start`.

O servidor irá servir os arquivos estáticos do front (pasta `siteiS/front`) em `http://localhost:3000`.

Endpoints úteis
- GET /health — retorna {status: 'ok'}
- POST /contact — espera um JSON ou form-urlencoded; salva mensagens em `messages.json` na pasta `back`.
 - POST /register — recebe JSON { name, email, password } e salva um usuário em `users.json` com a senha hasheada (bcrypt).

Testando o cadastro
- Garanta que você está na pasta `siteiS2/back` e rode:

	npm install
	npm start

- Abra `siteiS/front/cadastro.html` via navegador (ou acesse http://localhost:3000/cadastro.html) e preencha o formulário.
- Após cadastro bem-sucedido, o arquivo `users.json` será atualizado com o novo usuário (a senha não é salva em texto claro).
