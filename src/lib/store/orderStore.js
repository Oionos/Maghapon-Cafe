// Device-state surface. Phase 2 replaces local.js with http.js behind this same file.
import { createOrder } from '../cart.js';
import * as local from './local.js';

/**
 * @typedef {import('./types.js').CartLine} CartLine
 * @typedef {import('./types.js').Order} Order
 * @typedef {import('./types.js').OrderItem} OrderItem
 * @typedef {import('./types.js').Customer} Customer
 * @typedef {import('./types.js').Booking} Booking
 * @typedef {import('./types.js').RewardsEntry} RewardsEntry
 */

/** @returns {CartLine[]} */
export function getCart() {
  return local.loadCart();
}

/** @param {CartLine[]} cart */
export function setCart(cart) {
  local.saveCart(cart);
}

/** @returns {Order[]} */
export function listOrders() {
  return local.loadOrders();
}

/** @param {Order[]} orders */
export function seedOrders(orders) {
  local.saveOrders(orders);
}

/**
 * @param {{ customer: Customer, items: OrderItem[], total: number }} draft
 * @returns {Order}
 */
export function placeOrder({ customer, items, total }) {
  const orders = local.loadOrders();
  const order = createOrder({ customer, items, total, orders });
  local.saveOrders([order, ...orders]);
  return order;
}

/**
 * @param {string} id
 * @param {string} status
 * @returns {boolean} false when no order carries that id
 */
export function updateOrderStatus(id, status) {
  const orders = local.loadOrders();
  const target = orders.find((o) => o.id === id);
  if (!target) return false;
  target.status = status;
  local.saveOrders(orders);
  return true;
}

/** @returns {Booking[]} */
export function listBookings() {
  return local.loadBookings();
}

/**
 * @param {{ name: string, phone: string, date: string, time: string,
 *   guests: number, eventType: string }} draft
 * @returns {Booking}
 */
export function placeBooking(draft) {
  const bookings = local.loadBookings();
  const booking = {
    id: 'BK-' + Date.now().toString().slice(-6),
    ...draft,
    createdAt: new Date().toISOString(),
  };
  bookings.unshift(booking);
  local.saveBookings(bookings);
  return booking;
}

/** @returns {RewardsEntry[]} */
export function listRewards() {
  return local.loadRewards();
}

/**
 * @param {{ name: string, email: string }} draft
 * @returns {RewardsEntry}
 */
export function joinRewardsList(draft) {
  const rewards = local.loadRewards();
  const entry = { ...draft, createdAt: new Date().toISOString() };
  rewards.push(entry);
  local.saveRewards(rewards);
  return entry;
}
