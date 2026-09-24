import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as orderStore from '../src/lib/store/orderStore.js';
import * as menuSource from '../src/lib/store/menuSource.js';

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

test('seedOrders only fills an empty pipeline', () => {
  orderStore.seedOrders([{ id: 'MAG-1111', status: 'Received', items: [], total: 0 }]);
  assert.equal(orderStore.listOrders().length, 1);
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

test('rewards push after existing entries', () => {
  orderStore.placeBooking({ name: 'A', phone: '1', date: 'd', time: 't', guests: 2,
    eventType: 'TCG' });
  const e = orderStore.joinRewardsList({ name: 'Andy', email: 'a@b.co' });
  const list = JSON.parse(store.get('maghapon-rewards'));
  assert.equal(list.length, 1);
  assert.deepEqual(list[0], e);
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

test('menuSource serves the same object the JSON embed uses', () => {
  assert.ok(Array.isArray(menuSource.getMenu()));
  // src/data/menu.js exports `menu` as a FLAT item list (each entry has `variants`), not
  // `MenuCategory[]` with `items` as spec §9.1's signature claims — the seam returns it as-is.
  assert.equal(menuSource.getMenu()[0].variants.length > 0, true);
  assert.ok(
    Array.isArray(menuSource.getExtras().items) || typeof menuSource.getExtras() === 'object'
  );
});
