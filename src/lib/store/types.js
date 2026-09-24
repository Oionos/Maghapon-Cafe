/**
 * Phase-2 API contract. Plain JS by choice (AGENTS.MD §3.3 forbids a new toolchain), so the
 * shapes live in JSDoc: the http adapter must return exactly these.
 */
/**
 * @typedef {Object} Customer
 * @property {string} name
 * @property {string} phone
 */
/**
 * @typedef {Object} OrderItem
 * @property {string} name
 * @property {?string} variant
 * @property {string[]} modifiers
 * @property {number} qty
 * @property {number} unit
 */
/**
 * @typedef {Object} Order
 * @property {string} id
 * @property {Customer} customer
 * @property {string} type
 * @property {OrderItem[]} items
 * @property {number} total
 * @property {string} status
 * @property {string} createdAt
 */
/**
 * @typedef {Object} Booking
 * @property {string} id
 * @property {string} name
 * @property {string} phone
 * @property {string} date
 * @property {string} time
 * @property {number} guests
 * @property {string} eventType
 * @property {string} createdAt
 */
/**
 * @typedef {Object} RewardsEntry
 * @property {string} name
 * @property {string} email
 * @property {string} createdAt
 */
/**
 * @typedef {Object} CartLine
 * @property {string} key
 * @property {string} id
 * @property {string} name
 * @property {?string} variant
 * @property {string[]} modifiers
 * @property {number} unit
 * @property {number} qty
 */
export {};
