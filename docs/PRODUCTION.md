# EDUNova production setup

## Backend environment

Copy `backend/.env.example` to `backend/.env` and replace every placeholder.
Production requires:

- `NODE_ENV=production`
- `MONGO_URI` for the production MongoDB database
- a random `JWT_SECRET` containing at least 32 characters
- `FRONTEND_URL` or comma-separated `CORS_ORIGINS`
- valid SMTP values for email delivery

Never commit the real `.env` file or email app password.

## Frontend environment

If frontend and backend are on different origins, create `frontend/.env.production`:

```env
VITE_API_ORIGIN=https://api.example.com
```

Leave `VITE_API_ORIGIN` empty when a reverse proxy serves `/api` and `/uploads` from the same origin.

## Verify before deployment

```bash
cd backend
npm ci
npm run check
npm test

cd ../frontend
npm ci
npm run lint
npm run build
```

Start the backend with `npm start`. Deploy the generated `frontend/dist` directory using a static web server. Configure HTTPS and make `/api` and `/uploads` reach the backend when using a same-origin deployment.
