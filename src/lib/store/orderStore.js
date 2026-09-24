// Device-state surface. Phase 2 replaces local.js with http.js behind this same file.
import { createOrder } from '../cart.js';
import * as local from './local.js';

export function getCart() {
  return local.loadCart();
}

export function setCart(cart) {
  local.saveCart(cart);
}

export function listOrders() {
  return local.loadOrders();
}

export function seedOrders(orders) {
  local.saveOrders(orders);
}

export function placeOrder({ customer, items, total }) {
  const orders = local.loadOrders();
  const order = createOrder({ customer, items, total, orders });
  local.saveOrders([order, ...orders]);
  return order;
}

export function updateOrderStatus(id, status) {
  const orders = local.loadOrders();
  const target = orders.find((o) => o.id === id);
  if (!target) return false;
  target.status = status;
  local.saveOrders(orders);
  return true;
}

export function listBookings() {
  return local.loadBookings();
}

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

export function listRewards() {
  return local.loadRewards();
}

export function joinRewardsList(draft) {
  const rewards = local.loadRewards();
  const entry = { ...draft, createdAt: new Date().toISOString() };
  rewards.push(entry);
  local.saveRewards(rewards);
  return entry;
}
