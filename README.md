# Pantry Log

Live at **[pantry-log-steel.vercel.app](https://pantry-log-steel.vercel.app)**.

A small pantry inventory tracker. Each item has a name, quantity, unit, and a
low-stock threshold; the UI shows colour-coded status pills (in stock / low /
out) and a stats strip. Data is stored in the browser's `localStorage`.

Add items one at a time, **paste a whole list** (e.g. `rice, pasta x2,
olive oil 1 l`), or **scan a receipt photo** — handy after a shop. Scanned or
pasted text always lands in a textarea with a live preview so you can fix it
before anything is added.

## Stack

- TypeScript (strict)
- [Vite](https://vitejs.dev/) for dev server and bundling
- No framework — a tiny observable `Store` drives plain DOM rendering
- [tesseract.js](https://github.com/naptha/tesseract.js) for on-device receipt
  OCR — loaded lazily; the engine + English model are fetched from a CDN the
  first time a receipt is scanned (needs a network connection that once)

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
```

## Scripts

| Command              | What it does                                  |
| -------------------- | ---------------------------------------------- |
| `npm run dev`        | Start the Vite dev server with HMR            |
| `npm run build`      | Type-check, then build to `dist/`             |
| `npm run preview`    | Serve the production build locally            |
| `npm run typecheck`  | Run `tsc --noEmit`                            |
| `npm test`           | Run the unit test suite once                  |
| `npm run test:watch` | Run tests in watch mode                       |

Tests run under [Vitest](https://vitest.dev/) with a jsdom environment. Every
`src/*.ts` module has a matching `src/*.test.ts`; modules that touch the DOM
(`view.ts`, `addDialog.ts`, `bulkDialog.ts`) are tested against a shared DOM
fixture (`src/test/fixture.ts`) rather than a real browser, and `tesseract.js`
is mocked in `receiptScan.test.ts` so the suite runs fully offline.

## Layout

```
index.html          Markup + font links; loads src/main.ts
src/
  main.ts           Entry point — imports styles, starts the app
  app.ts            Wires DOM events to the Store, keeps the view in sync
  store.ts          All app state + the only place items are mutated
  view.ts           Renders the list, stats, and banners from state
  addDialog.ts      The "Add pantry item" dialog
  bulkDialog.ts     The "Add several items" dialog (scan / paste + live preview)
  parseBulk.ts      Free-text list -> item drafts (quantities, units, merge)
  receiptScan.ts    Receipt photo -> OCR -> candidate item lines
  status.ts         statusOf() / statusLabel() — stock classification
  storage.ts        localStorage load/save (with legacy-item backfill)
  categoryCollapse.ts  Which category sections are collapsed (localStorage)
  examples.ts       Seed data shown on first visit
  types.ts          Shared types (PantryItem, Category, Unit, Status, Filter)
  dom.ts            Small DOM helpers (byId, h, svg)
  styles.css        All styling (light + dark themes)
  test/fixture.ts   Shared DOM fixture + dialog stubs for the DOM-facing tests
```
