# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## Card scanner (optional local API)

The main app card scanner can call a small Python service for OpenCV-based heuristics.

1. Copy `.env.example` to `.env` and set `VITE_SCANNER_API_URL=http://127.0.0.1:8000` when the API is running.
2. Follow [scanner-api/README.md](scanner-api/README.md) to install dependencies and start FastAPI.
3. Run the frontend with `npm run dev` in a second terminal.

If `VITE_SCANNER_API_URL` is left empty, the UI shows **demo** placeholder scores so you can develop without Python.

## Member portal

Signed-in users can open **`/portal`** to build a portfolio (Supabase), with a **Grading decisions** section reserved for upcoming submit-vs-hold tooling. The legacy **`/dashboard`** URL redirects to **`/portal/portfolio`**.
