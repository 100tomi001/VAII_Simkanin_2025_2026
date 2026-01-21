PDX Forum / Wiki
README (EN / SK)

========================================================
EN
========================================================

Overview
- SPA forum + wiki inspired by Paradox Plaza forum and EU wiki.
- Frontend: React (Vite). Backend: Node.js + Express + PostgreSQL.
- Auth uses JWT, roles: user / moderator / admin.

Features
- Forum: topics, posts, categories, tags, search, pagination.
- Wiki: articles, categories, editor, recent changes, drafts.
- Reactions: like + custom reactions, summary counts.
- Follows: follow topics and users.
- Messages + notifications.
- Moderation: reports, bans, mute, permissions.
- File uploads: avatar, wiki images, badges, reactions.

Requirements
- Node.js 20+
- PostgreSQL 14+

Dependencies (main)
- Backend: express, pg, cors, dotenv, bcryptjs, jsonwebtoken, multer, express-rate-limit, helmet
- Frontend: react, react-dom, react-router-dom, axios, vite

Project structure
- /pdx_forum/backend : Express API + DB queries
- /pdx_forum/frontend : React SPA (Vite)

Setup
1) Create a PostgreSQL DB and set backend .env:
   PORT=4000
   DATABASE_URL=postgres://postgres:1234@localhost:5432/forum
   JWT_SECRET=super_tajny_string
   CORS_ORIGIN=http://localhost:5173

2) Backend
   cd pdx_forum/backend
   npm install
   npm run dev

3) Frontend
   cd ../frontend
   npm install
   npm run dev

Note
- If you pull new changes, run `npm install` again in backend and frontend to update dependencies.

Open in browser:
- http://localhost:5173

Database (core entities)
- forum_categories, topics, posts
- tags, topic_tags (M:N)
- reactions, post_reactions, topic_reactions (M:N)
- users, user_follows (M:N), user_badges (M:N)
- wiki_articles, wiki_categories, wiki_article_history
- reports, notifications, messages
- moderator_permissions, bans

Security
- Password hashing: bcrypt
- JWT auth, protected endpoints
- CORS allowlist
- Rate limiting for /api and auth endpoints
- SQL queries use parameters (protection against SQL injection)
- Server-side validation for inputs

File uploads
- POST /api/uploads/avatar
- POST /api/uploads/wiki
- POST /api/uploads/badge
- POST /api/uploads/reaction
Files stored in /uploads and served by backend.

Roles / permissions
- admin: full access
- moderator: limited by moderator_permissions table
- user: standard access

Repo
- Git repository: https://github.com/100tomi001/VAII_Simkanin_2025_2026


========================================================
SK
========================================================

Prehlad
- SPA forum + wiki inspirovane Paradox Plaza a EU wiki.
- Frontend: React (Vite). Backend: Node.js + Express + PostgreSQL.
- Autentifikacia cez JWT, roly: user / moderator / admin.

Funkcie
- Forum: temy, prispevky, kategorie, tagy, vyhladavanie, strankovanie.
- Wiki: clanky, kategorie, editor, recent changes, drafts.
- Reakcie: like + custom reakcie, sumarizacie.
- Follow: sledovanie tem a uzivatelov.
- Spravy + notifikacie.
- Moderacia: reporty, bany, mute, prava.
- Uploady suborov: avatar, wiki obrazky, badge, reaction.

Pozadavky
- Node.js 20+
- PostgreSQL 14+

Zavislosti (hlavne)
- Backend: express, pg, cors, dotenv, bcryptjs, jsonwebtoken, multer, express-rate-limit, helmet
- Frontend: react, react-dom, react-router-dom, axios, vite

Struktura projektu
- /pdx_forum/backend : Express API + DB query
- /pdx_forum/frontend : React SPA (Vite)

Instalacia
1) Vytvor DB a nastav backend .env:
   PORT=4000
   DATABASE_URL=postgres://postgres:1234@localhost:5432/forum
   JWT_SECRET=super_tajny_string
   CORS_ORIGIN=http://localhost:5173

2) Backend
   cd pdx_forum/backend
   npm install
   npm run dev

3) Frontend
   cd ../frontend
   npm install
   npm run dev

Poznamka
- Ak stiahnes nove zmeny, spusti `npm install` znova v backend aj frontend.

Otvori v prehliadaci:
- http://localhost:5173

Databaza (hlavne entity)
- forum_categories, topics, posts
- tags, topic_tags (M:N)
- reactions, post_reactions, topic_reactions (M:N)
- users, user_follows (M:N), user_badges (M:N)
- wiki_articles, wiki_categories, wiki_article_history
- reports, notifications, messages
- moderator_permissions, bans

Bezpecnost
- Hesla hashovane (bcrypt)
- JWT auth, chranene endpointy
- CORS allowlist
- Rate limit pre /api a auth
- SQL s parametrami (ochrana proti SQL injection)
- Server-side validacia vstupov

Uploady
- POST /api/uploads/avatar
- POST /api/uploads/wiki
- POST /api/uploads/badge
- POST /api/uploads/reaction
Subory sa ukladaju do /uploads a obsluhuje ich backend.

Roly / prava
- admin: plny pristup
- moderator: obmedzeny podla moderator_permissions
- user: standardny pristup
