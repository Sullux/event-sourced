# Subscriptions & Query Predicates

`@sullux/event-engine` provides a rich subscription and query engine supporting live reactive streaming, point-in-time historical replay, and bounded queries.

---

## Subscription Modes

### 1. Active Subscriptions (`catchUp: true`)
Performs a historical replay of all matching past events starting from the beginning of time (or from a given `since` ULID/timestamp), and seamlessly transitions to live real-time events without duplicate deliveries or gaps.

```javascript
const unsubscribe = engine.subscribe({
  predicate: { type: 'chat.message.sent' },
  catchUp: true,
  since: '01H3ZX9Y2K7R9B...', // optional cursor
  handler: async (event) => {
    updateConversationUI(event)
  },
})
```

### 2. Passive Subscriptions (`catchUp: false`)
Listens exclusively for new live events arriving after subscription registration:

```javascript
engine.subscribe({
  predicate: { type: 'user.logged_in' },
  handler: async (event) => {
    logActivity(event)
  },
})
```

### 3. One-Off Snapshot Queries (`query`)
Fetches a static array of events matching a predicate without establishing a live streaming connection:

```javascript
const events = await engine.query({
  predicate: {
    type: 'invoice.issued',
    'payload.customerId': 'cust_123',
  },
  limit: 50,
})
```

---

## Predicate Expression Syntax

Predicates are evaluated against event headers and payloads in both JavaScript (for live streams) and compiled SQL queries (for SQLite indexes).

### Exact Value & Nested Keys
```javascript
{
  type: 'order.created',
  'payload.status': 'pending',
  'payload.customer.tier': 'premium'
}
```

### Comparison Operators (`gt`, `gte`, `lt`, `lte`, `in`)
```javascript
{
  timestamp: { gte: 1700000000000, lt: 1710000000000 },
  'payload.amount': { gt: 100 },
  'payload.category': { in: ['electronics', 'hardware'] }
}
```

### Wildcards & Glob Matching
```javascript
{
  type: 'order.*', // matches order.created, order.cancelled, etc.
}
```

### Logical Operators (`some`, `not`)
```javascript
{
  some: [
    { type: 'payment.succeeded' },
    { type: 'payment.refunded' },
  ],
  not: {
    'payload.testMode': true,
  }
}
```
