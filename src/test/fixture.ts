import { vi } from 'vitest';

/**
 * A minimal stand-in for index.html's body: every id the app's modules look
 * up with `byId`, so a module can be imported (its top-level `byId` calls
 * run at import time) against a DOM that actually has them.
 */
export const FIXTURE_HTML = `
  <div class="wrap">
    <header class="app">
      <div class="brand"><h1>Pantry Log</h1><span class="tag" id="lastUpdated"></span></div>
      <div class="actions">
        <button id="openBulk">Scan</button>
        <button id="openAdd">Add item</button>
      </div>
    </header>

    <section class="stats">
      <div class="stat"><div class="n" id="statTotal">0</div></div>
      <div class="stat low"><div class="n" id="statLow">0</div></div>
      <div class="stat out"><div class="n" id="statOut">0</div></div>
    </section>

    <div class="banner" id="exampleBanner" hidden>
      <button id="clearExamples">Clear examples</button>
    </div>

    <div class="controls">
      <input type="text" id="searchInput">
      <div class="chips" id="filterChips">
        <button class="chip" data-filter="all" aria-pressed="true">All <span class="count" id="cAll"></span></button>
        <button class="chip" data-filter="good">In stock <span class="count" id="cGood"></span></button>
        <button class="chip" data-filter="low">Low <span class="count" id="cLow"></span></button>
        <button class="chip" data-filter="out">Out <span class="count" id="cOut"></span></button>
      </div>
    </div>

    <div class="list" id="list"></div>

    <div class="empty" id="emptyState" hidden></div>
  </div>

  <dialog id="addDialog">
    <form id="addForm">
      <input type="text" id="fName">
      <input type="number" id="fQty" value="1">
      <select id="fUnit">
        <option value="pcs">pcs</option>
        <option value="jars">jars</option>
        <option value="cans">cans</option>
        <option value="bags">bags</option>
        <option value="boxes">boxes</option>
        <option value="g">g</option>
        <option value="kg">kg</option>
        <option value="ml">ml</option>
        <option value="l">l</option>
      </select>
      <input type="number" id="fThresh" value="1">
      <select id="fCategory">
        <option value="daily" selected>Daily essentials</option>
        <option value="india">From India</option>
        <option value="bulk">Bulk staples</option>
      </select>
      <button type="button" id="cancelAdd">Cancel</button>
      <button type="submit">Add to pantry</button>
    </form>
  </dialog>

  <dialog id="bulkDialog">
    <form id="bulkForm">
      <button type="button" id="scanReceipt">Scan a receipt photo</button>
      <input type="file" id="receiptFile" hidden>
      <div id="scanStatus" hidden></div>
      <textarea id="bulkText"></textarea>
      <select id="bulkCategory">
        <option value="daily" selected>Daily essentials</option>
        <option value="india">From India</option>
        <option value="bulk">Bulk staples</option>
      </select>
      <div id="bulkPreview" hidden></div>
      <button type="button" id="cancelBulk">Cancel</button>
      <button type="submit" id="bulkSubmit" disabled>Add items</button>
    </form>
  </dialog>
`;

/** Reset the document to the fixture markup. */
export function mountFixture(): void {
  document.body.innerHTML = FIXTURE_HTML;
}

/**
 * jsdom's <dialog> support varies by version and isn't the point of these
 * tests anyway — stub show/close so `.open` still reflects reality without
 * depending on jsdom's own implementation.
 */
export function stubDialogs(): void {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });
}
