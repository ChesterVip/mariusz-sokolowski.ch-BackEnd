# mariusz-sokolowski.ch-BackEnd
My First Own full BackEnd with users mailing

## Local development with the frontend

1. Install dependencies and start the backend:
   - `npm install`
   - Copy `.env.example` to `.env.local`, then adjust any secrets and make sure `ALLOWED_ORIGINS` contains `http://localhost:5173`.
   - `npm run start:dev` (default port: `3000`)
2. Configure the frontend located in `../FrontEnd/Stronka_React_M_S`:
   - `npm install`
   - Copy `.env.example` to `.env.local` and set `VITE_API_BASE_URL=http://localhost:3000` (or another backend URL).
   - `npm run dev` (default Vite port: `5173`)

The backend now whitelists the local Vite origin (`http://localhost:5173` and `http://127.0.0.1:5173`) out of the box, so the frontend can communicate with the API during development without extra configuration. Update `ALLOWED_ORIGINS` in your `.env.local` when deploying to other environments.
