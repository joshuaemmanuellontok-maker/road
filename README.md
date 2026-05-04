
  # Soteria Crowd-Service App

  This repository now follows a split-platform setup:

  - Web admin in the repository root (`Vite + React`)
  - Local backend API in [`backend`](./backend)
  - Mobile user and agent app in [`mobile`](./mobile)
  - Shared domain models in [`packages/shared`](./packages/shared)

  The original design source is available at https://www.figma.com/design/11UepabEelG10HItKQS9TB/RoadResQ-Crowd-Service-App.

  ## Web admin

  Install dependencies in the repository root:

  `npm i`

  Start the web admin:

  `npm run dev:web`

  ## Backend API

  The local PostgreSQL-backed API lives in [`backend`](./backend).

  1. Copy [`backend/.env.example`](./backend/.env.example) to `backend/.env`
  2. Set `DATABASE_URL` to your local PostgreSQL connection string
  3. `cd backend`
  4. `npm i`
  5. `npm run dev`

  Starter routes:

  - `GET /api/health`
  - `GET /api/repair-shops`
  - `POST /api/users/register`
  - `POST /api/agent-applications/register`
  - `POST /api/emergency-dispatches`
  - `PATCH /api/dispatches/:dispatchId/status`

  ## Mobile app

  The React Native mobile scaffold lives in [`mobile`](./mobile). It is intended for:

  - `user` flows
  - `agent` flows

  Typical Expo setup:

  1. `cd mobile`
  2. Copy [`mobile/.env.example`](./mobile/.env.example) to `mobile/.env`
  3. Set `EXPO_PUBLIC_API_BASE_URL` to `http://YOUR-PC-IP:4000/api`
  4. `npm i`
  5. `npm run start`

  ## Shared package

  Shared types and starter domain constants live in [`packages/shared/src/index.ts`](./packages/shared/src/index.ts).
  
