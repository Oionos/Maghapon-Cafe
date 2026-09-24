import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as orderStore from '../src/lib/store/orderStore.js';
import * as menuSource from '../src/lib/store/menuSource.js';
import { menu, extras } from '../src/data/menu.js';

const KEYS = ['maghapon-cart', 'maghapon-orders', 'maghapon-bookings', 'maghapon-rewards'];

function installStorageStub() {
  const map = new Map();
  globalThis.localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
  return map;
}

let store;
beforeEach(() => {
  store = installStorageStub();
});

test('a placed order is prepended and gets a MAG- id, as before', () => {
  const draft = {
    customer: { name: 'Andy', phone: '0917' },
    items: [{ name: 'Barako Brew', variant: 'Iced', modifiers: [], qty: 1, unit: 120 }],
    total: 120,
  };
  const order = orderStore.placeOrder(draft);
  assert.match(order.id, /^MAG-\d{4}$/);
  assert.equal(order.status, 'Received');
  assert.equal(order.type, 'Pickup');
  const saved = JSON.parse(store.get('maghapon-orders'));
  assert.equal(saved.length, 1);
  assert.equal(saved[0].id, order.id);
  assert.deepEqual(orderStore.listOrders(), saved);
});

test('placeOrder dedupes against existing numbers via the returned id', () => {
  const seen = new Set();
  for (let i = 0; i < 25; i += 1) {
    const o = orderStore.placeOrder({ customer: {}, items: [], total: 0 });
    assert.equal(seen.has(o.id), false, 'duplicate order number ' + o.id);
    seen.add(o.id);
  }
});

test('updateOrderStatus patches one order and reports whether it existed', () => {
  const o = orderStore.placeOrder({ customer: {}, items: [], total: 0 });
  assert.equal(orderStore.updateOrderStatus(o.id, 'Preparing'), true);
  assert.equal(orderStore.listOrders()[0].status, 'Preparing');
  assert.equal(orderStore.updateOrderStatus('MAG-0000', 'Served'), false);
});

test('seedOrders persists the whole array it is given', () => {
  orderStore.seedOrders([{ id: 'MAG-1111', status: 'Received', items: [], total: 0 }]);
  assert.equal(orderStore.listOrders().length, 1);
  // The "only seed an empty pipeline" rule lives in admin.astro's getOrders(), which this test
  // never loads; seedOrders itself writes unconditionally, so a second call replaces the store.
  orderStore.seedOrders([
    { id: 'MAG-2222', status: 'Received', items: [], total: 0 },
    { id: 'MAG-3333', status: 'Received', items: [], total: 0 },
  ]);
  assert.equal(orderStore.listOrders().length, 2);
});

test('bookings unshift with a BK- id and the same field order', () => {
  const b = orderStore.placeBooking({
    name: 'Andy', phone: '0917', date: '2026-09-30', time: '19:00',
    guests: 4, eventType: 'Casual',
  });
  assert.match(b.id, /^BK-\d{6}$/);
  assert.deepEqual(Object.keys(b), ['id', 'name', 'phone', 'date', 'time', 'guests', 'eventType',
    'createdAt']);
  assert.equal(JSON.parse(store.get('maghapon-bookings'))[0].id, b.id);
});

test('rewards join pushes after existing entries', () => {
  const first = orderStore.joinRewardsList({ name: 'Andy', email: 'a@b.co' });
  const second = orderStore.joinRewardsList({ name: 'Bea', email: 'b@b.co' });
  const list = JSON.parse(store.get('maghapon-rewards'));
  // Rewards push (the signup list reads oldest-first) while bookings unshift (admin shows the
  // newest first); two distinguishable joins are what pins which of the two this surface uses.
  assert.equal(list.length, 2);
  assert.deepEqual(list[0], first);
  assert.deepEqual(list[1], second);
});

test('the cart is a mirrored draft, not derived state', () => {
  const cart = [{ key: 'k|Iced|', id: 'x', name: 'Barako Brew', variant: 'Iced', modifiers: [],
    unit: 120, qty: 1 }];
  orderStore.setCart(cart);
  assert.deepEqual(orderStore.getCart(), cart);
  assert.deepEqual(orderStore.getCart(), JSON.parse(store.get('maghapon-cart')));
});

test('corrupt storage reads as empty instead of throwing', () => {
  for (const k of KEYS) store.set(k, '{not json');
  assert.deepEqual(orderStore.getCart(), []);
  assert.deepEqual(orderStore.listOrders(), []);
  assert.deepEqual(orderStore.listBookings(), []);
  assert.deepEqual(orderStore.listRewards(), []);
  store.set('maghapon-orders', JSON.stringify({ nope: true }));
  assert.deepEqual(orderStore.listOrders(), []);
});

test('no key name changed, so an existing demo device keeps its data', () => {
  orderStore.setCart([]); orderStore.placeOrder({ customer: {}, items: [], total: 0 });
  orderStore.placeBooking({ name: 'A', phone: '1', date: 'd', time: 't', guests: 1,
    eventType: 'x' });
  orderStore.joinRewardsList({ name: 'A', email: 'a@b.co' });
  assert.deepEqual([...store.keys()].sort(), KEYS.slice().sort());
});

// TOLERATED, NOT ENDORSED. exit-record §11 item 4 ruled on this: main's two raw booking reads
// did JSON.parse(getItem(k) || '[]'), which THREW on an unparseable value, so the submit
// handler aborted and the corrupt bytes survived in storage. The seam reads tolerantly, so an
// unparseable or non-array value is reported as empty and the NEXT write overwrites it. That is
// a real behaviour change on hand-edited or half-written storage, accepted deliberately and
// pinned here so it can never be mistaken for the status quo. The assertions below fail in both
// directions: a tolerant read that silently kept the old value would fail the "replaced" check,
// and restoring main's throw would fail the "reads as empty" check.
test('CORRUPT BOOKINGS ARE DISCARDED, NOT REPAIRED: read empty, next write overwrites', () => {
  const draft = { name: 'Andy', phone: '0917', date: '2026-10-01', time: '19:00',
    guests: 2, eventType: 'Casual' };
  for (const corrupt of ['{not json', '{"a":1}']) {
    store.set('maghapon-bookings', corrupt);
    assert.deepEqual(orderStore.listBookings(), [], `${corrupt} must read as empty`);
    const placed = orderStore.placeBooking(draft);
    assert.deepEqual(JSON.parse(store.get('maghapon-bookings')), [placed],
      `${corrupt} must be gone after the next write`);
    store.clear();
  }
});

test('menuSource serves the exact arrays data/menu.js exports', () => {
  // Identity, not shape. `Array.isArray(x) || typeof x === 'object'` is satisfied by `[]`, `{}` and
  // `null`-ish objects alike, so it asserts nothing; and a getMenu() that returned a filtered,
  // copied or re-sorted variant would keep the app working while silently diverging from the
  // server-rendered menu. Reference equality is what the seam actually promises today.
  assert.equal(menuSource.getMenu(), menu);
  assert.equal(menuSource.getExtras(), extras);
  // `menu` is FLAT (39 items, each with `variants`); `getMenu()[0].items` is undefined, so an
  // `.items.length` assertion throws. Category grouping is the separate `categories` export.
  assert.equal(menuSource.getMenu()[0].variants.length > 0, true);
  assert.ok(menuSource.getExtras().length > 0);
});
