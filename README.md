# Pantry Log

Live at **[pantry-log-steel.vercel.app](https://pantry-log-steel.vercel.app)**.

A small pantry inventory tracker. Each item has a name, quantity, unit, and a
low-stock threshold; the UI shows colour-coded status pills (in stock / low /
out) and a stats strip. Data is stored in the browser's `localStorage`, and
can optionally sync across devices via a shared **pantry code** — see
[Cross-device sync](#cross-device-sync-optional) below.

Add items one at a time — optionally **snapping a photo of the product** to
fill in the name — **paste a whole list** (e.g. `rice, pasta x2, olive oil 1
l`), or **scan a receipt photo** — handy after a shop. Anything scanned or
pasted lands as an editable guess (a filled-in field, or a textarea with a
live preview), so it's always reviewed before anything is added.

## Stack

- TypeScript (strict)
- [Vite](https://vitejs.dev/) for dev server and bundling
- No framework — a tiny observable `Store` drives plain DOM rendering
- [tesseract.js](https://github.com/naptha/tesseract.js) for on-device OCR —
  loaded lazily; the engine + English/Dutch models are fetched from a CDN the
  first time something is scanned (needs a network connection that once).
  Receipts and single-product photos use different page-segmentation
  settings, since a receipt is a uniform column of text but a product label
  has one name in a much bigger font than everything around it. Both
  recognize English and Dutch text/wording (comma decimals, € prices, "BTW"/
  "totaal"/"korting" etc. on receipts, Dutch packaging fine print on labels).
- [Firebase Firestore](https://firebase.google.com/docs/firestore) (optional)
  for cross-device sync — also lazy-loaded, only touched at all once a
  project is configured (see below)

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
```

## Cross-device sync (optional)

Without any setup, this app is purely local: items live in `localStorage` on
whichever device/browser you're using, with no account and no server. Adding
a Firebase project turns on sync across devices — **without a sign-in step**:

- The app generates a random 6-character **pantry code** per device and shows
  it in the "Sync" dialog.
- Enter that same code on another device (via "Have a code from another
  device?") and both devices read/write the same shared pantry from then on.
- This is **not real per-user security** — it's the same model as a shared
  Google Doc link: anyone who has the code can read and write that pantry.
  Fine for household inventory data; don't use this pattern for anything
  sensitive.

### Setup

1. Create a free project at [console.firebase.google.com](https://console.firebase.google.com).
2. In the project, enable **Firestore Database** (Build → Firestore Database → Create database; start in production mode).
3. Paste the contents of [`firestore.rules`](firestore.rules) into Firestore's **Rules** tab and publish. These rules only check that a document id looks like a real pantry code — see the comment in that file for the security model.
4. In Project settings → General → "Your apps", add a **Web app** and copy its config values.
5. Copy `.env.example` to `.env.local` and fill in the four `VITE_FIREBASE_*` values from that config. (These are safe to expose client-side — Firebase's web config isn't a secret; access is controlled by the rules file instead.)
6. Restart `npm run dev` (or redeploy). The header's "Sync" button now shows a real pantry code instead of the "not set up" message.

Leaving `.env.local` absent is completely fine — the app just stays local-only, exactly as before.

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
(`view.ts`, `addDialog.ts`, `bulkDialog.ts`, `syncDialog.ts`) are tested
against a shared DOM fixture (`src/test/fixture.ts`) rather than a real
browser. `tesseract.js` is mocked in `receiptScan.test.ts` /
`productScan.test.ts`, and `firebase/firestore` is mocked in
`remoteSync.test.ts` / `storeSync.test.ts`, so the whole suite runs fully
offline with no real OCR engine or Firebase project needed.

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
  productScan.ts    Single product photo -> OCR -> guessed item name
  syncDialog.ts     The "Sync across devices" dialog (pantry code + join form)
  firebaseClient.ts Lazy Firebase/Firestore init; isSyncConfigured flag
  pantryCode.ts     Generate/validate/store the 6-character pantry code
  remoteSync.ts     Firestore subscribe/push for one pantry's shared document
  status.ts         statusOf() / statusLabel() — stock classification
  storage.ts        localStorage load/save (with legacy-item backfill)
  categoryCollapse.ts  Which category sections are collapsed (localStorage)
  examples.ts       Seed data shown on first visit
  types.ts          Shared types (PantryItem, Category, Unit, Status, Filter)
  dom.ts            Small DOM helpers (byId, h, svg)
  styles.css        All styling (light + dark themes)
  test/fixture.ts   Shared DOM fixture + dialog stubs for the DOM-facing tests
firestore.rules     Recommended Firestore security rules (see setup above)
.env.example        Template for the optional Firebase config
```
