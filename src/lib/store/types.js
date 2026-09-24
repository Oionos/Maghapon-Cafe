/**
 * Phase-2 API contract. Plain JS by choice (AGENTS.MD §3.3 forbids a new toolchain), so the
 * shapes live in JSDoc: the http adapter must return exactly these.
 * @typedef {Object} Customer {string} name {string} phone
 * @typedef {Object} OrderItem {string} name {string} variant {string[]} modifiers
 *   {number} qty {number} unit
 * @typedef {Object} Order {string} id {Customer} customer {string} type {OrderItem[]} items
 *   {number} total {string} status {string} createdAt
 * @typedef {Object} Booking {string} id {string} name {string} phone {string} date
 *   {string} time {number} guests {string} eventType {string} createdAt
 * @typedef {Object} RewardsEntry {string} name {string} email {string} createdAt
 * @typedef {Object} CartLine {string} key {string} id {string} name {string} variant
 *   {string[]} modifiers {number} unit {number} qty
 */
export {};
