# Card scanner API (FastAPI + OpenCV)

Heuristic centering, edge, corner, and sharpness signals for the Grade Ranger scanner UI. **Not** official grading.

## Setup (Windows)

1. Open a terminal in this folder (`scanner-api`).
2. Create a virtual environment (recommended):

   ```text
   python -m venv .venv
   .venv\Scripts\activate
   ```

3. Install dependencies:

   ```text
   pip install -r requirements.txt
   ```

4. Run the server:

   ```text
   python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
   ```

5. Check health: open `http://127.0.0.1:8000/health` — you should see `{"ok":true}`.

## Connect the Vite app

In the **project root** (parent of `scanner-api`), create a `.env` file:

```text
VITE_SCANNER_API_URL=http://127.0.0.1:8000
```

Restart `npm run dev`. Use **Analyze card** on the dashboard — the browser calls `POST /analyze` with `{ "imageBase64": "..." }`.

## Two-terminal workflow

- **Terminal A:** this API (`uvicorn` as above).
- **Terminal B:** project root, `npm run dev` for the React app.

If `VITE_SCANNER_API_URL` is unset, the UI runs **demo placeholder** scores only.
