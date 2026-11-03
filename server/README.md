# Tasty Corner API

## Local setup

1. Copy `.env.example` to `.env` and add your Neon pooled `DATABASE_URL` and direct `DIRECT_URL`.
2. Install dependencies with `npm install`.
3. Generate Prisma Client: `npm run db:generate`.
4. Create/apply a development migration: `npm run db:migrate -- --name init`.
5. Seed demo data: `npm run db:seed`.
6. Start the API: `npm run dev`.

The API defaults to `http://localhost:4000`. Demo seeding refuses to run with `NODE_ENV=production`.

The public API is available at `/api/restaurant`, `/api/categories`, and `/api/menu`. Protected operations use the HTTP-only `tasty_session` cookie. R2 upload support activates only after all R2 variables are configured.
