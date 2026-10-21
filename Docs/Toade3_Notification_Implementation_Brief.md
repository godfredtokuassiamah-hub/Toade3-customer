# Toade3 notifications: user implementation brief

Source of truth: `Docs/Toade3_Notification_Architecture.md` (spec v1.0.0, saved verbatim).

## Priority → presentation (user's table)

| Priority | Examples | Presentation |
| --- | --- | --- |
| P0, action required | New vendor order, rider pickup ready, rejected order, operational incident | Persistent task or exception card; eligible push and escalation |
| P1, important update | Order accepted, on the way, delivered, support reply | Order capsule update, contextual banner or background push |
| P2, routine feedback | Added to cart, filters applied, preparation started | Inline feedback or quiet status update |
| P3, optional offers | Promotions, subscribed availability alerts | Consent-based notifications with frequency limits |

## Rules from the user
- One shared notification engine with separate audience policies for Customers, Vendors, Riders and Admin.
- Business event first → durable queue → policies → inbox records → delivery workers.
- Dismissing or reading a notification never accepts an order, claims a job or confirms delivery.
- A push provider receipt doesn't prove display, so order screens and task boards must stay usable when an alert is missed.
- The implementation prompt is spec §17 (plus the user's restatement, which also asks for: one transient banner at a time, coalescing same-order updates, suppressing obsolete alerts, keeping unresolved Vendor/Rider tasks discoverable after dismissal, private Realtime authorisation, safe routing, listeners registered once, reconcile on resume/reconnect, dedupe of push + Realtime, validation before navigating, Live Activities in a separate adapter, and tests for duplicate/out-of-order events, permission denial, account switching, withdrawn assignments, cold-start taps, worker crashes and provider outages with synthetic recipients).

## Capsule visual reference (the user's attached image)
- A pill-shaped capsule with a near-black body (#090909) and a black outer rim.
- Left: a 40pt white circle with a black shopping-bag glyph.
- Title (white, Manrope semibold 16): e.g. "Ready in 5 min". Subtitle (#BDBDBD, 13): "Order #TD-0042 • 2 items".
- Right: a charcoal (#30302E) pill button "View order", white text, ≥48pt hit area.
- An inset rounded-capsule progress stroke around the whole perimeter: the neutral track is #30302E and the progressed segment is Toade3 yellow #FCB501. In the image the yellow runs from the top-centre clockwise round the right end to the bottom-centre (about half).
- Must be live text + an SVG/native path, never the PNG. Per spec §3 the ETA copy appears only from a fresh server estimate; otherwise use honest fallback text ("Preparing your meal" / "Checking the latest timing").
- Motion: 220–300ms restrained, no bounce (the user has repeatedly asked for no bouncy animation in this app).
