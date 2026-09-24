// src/lib/store/local.js — the only module allowed to name localStorage. Copied verbatim from
// cart.js's persistence block in Phase 0 so demo devices keep their data across the upgrade.

const CART_KEY = 'maghapon-cart';
const ORDERS_KEY = 'maghapon-orders';
const BOOKINGS_KEY = 'maghapon-bookings';
const REWARDS_KEY = 'maghapon-rewards';

export function loadCart() {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

export function loadOrders() {
  try {
    const raw = JSON.parse(localStorage.getItem(ORDERS_KEY));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function saveOrders(orders) {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
}

export function loadBookings() {
  try {
    const raw = JSON.parse(localStorage.getItem(BOOKINGS_KEY));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function saveBookings(bookings) {
  localStorage.setItem(BOOKINGS_KEY, JSON.stringify(bookings));
}

export function loadRewards() {
  try {
    const raw = JSON.parse(localStorage.getItem(REWARDS_KEY));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function saveRewards(rewards) {
  localStorage.setItem(REWARDS_KEY, JSON.stringify(rewards));
}
