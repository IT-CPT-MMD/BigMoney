# BM Core React Rebuild

This is a React/Vite rebuild of the uploaded BM Core system.

## What changed
- UI is rendered through React (`src/App.jsx`).
- Original IDs/classes and layout are preserved.
- Existing Supabase/business logic is preserved in `src/legacyApp.js`.
- Original CSS is preserved in `src/styles.css`.
- Assets are placed in `public/assets`.

## Run locally
```bash
npm install
npm run dev
```

Open:
- Login: `http://localhost:5173/`
- App: `http://localhost:5173/app.html`

## Build for hosting
```bash
npm run build
```

Upload the generated `dist` folder to Netlify.
