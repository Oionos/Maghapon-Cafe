// cart.js — pure cart/order/booking helpers. No DOM access.
// Persistence now lives in store/local.js; everything here is data in, data out.

// Line-item key = item id + variant label + modifier ids (locked in brief)
export function lineKey(item, variant, modifiers) {
  const size = variant && variant.label ? variant.label : '';
  const mods = (modifiers || []).map((m) => m.id).join(',');
  return [item.id, size, mods].join('|');
}

export function lineUnit(variant, modifiers) {
  return variant.price + (modifiers || []).reduce((sum, m) => sum + m.price, 0);
}

// addItem returns a NEW cart array — never mutates the input
export function addItem(cart, item, variant, modifiers, qty) {
  const key = lineKey(item, variant, modifiers);
  const unit = lineUnit(variant, modifiers);
  const existing = cart.find((line) => line.key === key);
  if (existing) {
    return cart.map((line) => (line.key === key ? { ...line, qty: line.qty + qty } : line));
  }
  return [
    ...cart,
    {
      key,
      id: item.id,
      name: item.name,
      variant: variant.label,
      modifiers: (modifiers || []).map((m) => m.name),
      unit,
      qty,
    },
  ];
}

export function removeItem(cart, key) {
  return cart.filter((line) => line.key !== key);
}

export function updateQty(cart, key, qty) {
  if (qty <= 0) return removeItem(cart, key);
  return cart.map((line) => (line.key === key ? { ...line, qty } : line));
}

export function cartTotal(cart) {
  return cart.reduce((sum, line) => sum + line.unit * line.qty, 0);
}

export function cartCount(cart) {
  return cart.reduce((sum, line) => sum + line.qty, 0);
}

export function formatPeso(amount) {
  return '₱' + amount;
}

// Unique order number like MAG-1024, checked against existing orders
export function nextOrderNumber(orders) {
  const used = new Set(orders.map((o) => o.id));
  let candidate;
  do {
    candidate = 'MAG-' + (1000 + Math.floor(Math.random() * 9000));
  } while (used.has(candidate));
  return candidate;
}

export function createOrder({ customer, items, total, orders }) {
  return {
    id: nextOrderNumber(orders),
    customer,
    type: 'Pickup',
    items,
    total,
    status: 'Received',
    createdAt: new Date().toISOString(),
  };
}