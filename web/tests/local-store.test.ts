import { strict as assert } from "node:assert";
import { beforeEach, test } from "node:test";
import { createLocalStore, onStorageFailure, resetStorageFailure, storageFailed } from "../src/lib/local-store.ts";
import { decodeTrip, encodeTrip } from "../src/lib/trip-storage.ts";

class FakeStorage {
  data = new Map<string, string>();
  full = false;
  getItem(k: string) {
    return this.data.has(k) ? this.data.get(k)! : null;
  }
  setItem(k: string, v: string) {
    if (this.full) throw new Error("QuotaExceededError");
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

const g = globalThis as unknown as { localStorage: FakeStorage; window: EventTarget };
let storage: FakeStorage;

beforeEach(() => {
  storage = new FakeStorage();
  g.localStorage = storage;
  g.window = new EventTarget();
  resetStorageFailure();
});

const numbers = (key = "t") => createLocalStore<number[]>(key, [], { decode: (v) => (Array.isArray(v) ? (v as number[]) : undefined) });

test("schrijven en lezen via de opslag", () => {
  const s = numbers();
  s.write([1, 2]);
  assert.equal(storage.getItem("t"), "[1,2]");
  assert.deepEqual(s.read(), [1, 2]);
  assert.equal(storageFailed(), false);
});

test("volle opslag: de waarde blijft in het geheugen en er komt één melding", () => {
  const s = numbers();
  s.write([1]);
  storage.full = true;
  let notices = 0;
  const off = onStorageFailure(() => notices++);
  let changes = 0;
  s.subscribe(() => changes++);
  s.write([1, 2]);
  s.write([1, 2, 3]);
  assert.deepEqual(s.read(), [1, 2, 3], "Bewaar werkt nog tijdens dit bezoek");
  assert.equal(storage.getItem("t"), "[1]");
  assert.equal(storageFailed(), true);
  assert.equal(notices, 1, "maar één keer melden");
  assert.equal(changes, 2);
  off();
  // Lukt het later weer, dan gaat de opslag weer voor
  storage.full = false;
  s.write([4]);
  assert.equal(storage.getItem("t"), "[4]");
  assert.deepEqual(s.read(), [4]);
});

test("geblokkeerde opslag (getItem en setItem gooien): geheugen werkt", () => {
  g.localStorage = {
    getItem() {
      throw new Error("SecurityError");
    },
    setItem() {
      throw new Error("SecurityError");
    },
  } as unknown as FakeStorage;
  const s = numbers();
  assert.deepEqual(s.read(), []);
  s.write([7]);
  assert.deepEqual(s.read(), [7]);
  assert.equal(storageFailed(), true);
});

test("storage-event: ook bij alles wissen in een ander tabblad (key null)", () => {
  const s = numbers();
  s.write([1]);
  let calls = 0;
  const off = s.subscribe(() => calls++);
  const fire = (key: string | null) => {
    const e = new Event("storage") as Event & { key: string | null };
    e.key = key;
    g.window.dispatchEvent(e);
  };
  fire("anders");
  assert.equal(calls, 0);
  fire("t");
  assert.equal(calls, 1);
  storage.data.clear();
  fire(null);
  assert.equal(calls, 2);
  assert.deepEqual(s.read(), []);
  off();
  fire(null);
  assert.equal(calls, 2);
});

test("kapotte of ongeldige opslag geeft de standaardwaarde", () => {
  storage.setItem("t", "{kapot");
  assert.deepEqual(numbers().read(), []);
  storage.setItem("u", JSON.stringify({ geen: "lijst" }));
  assert.deepEqual(numbers("u").read(), []);
});

test("reisopslag: oude lijst wordt omgezet en met versie teruggeschreven", () => {
  storage.setItem("reis", JSON.stringify([{ slug: "a", nights: 0 }, { slug: "b", nights: 40 }, { slug: "a", nights: 2 }]));
  const s = createLocalStore("reis", [], { decode: decodeTrip, encode: encodeTrip });
  assert.deepEqual(s.read(), [{ slug: "a", nights: 1 }, { slug: "b", nights: 21 }]);
  s.write([...s.read(), { slug: "c", nights: 3 }]);
  assert.deepEqual(JSON.parse(storage.getItem("reis")!), { v: 2, stops: [{ slug: "a", nights: 1 }, { slug: "b", nights: 21 }, { slug: "c", nights: 3 }] });
  assert.deepEqual(s.read(), [{ slug: "a", nights: 1 }, { slug: "b", nights: 21 }, { slug: "c", nights: 3 }]);
});
