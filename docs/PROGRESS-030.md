# Chat windows follow their cats

Hosted cat avatars now report their current position to the chat runtime. Compact chat windows anchor above the selected cat (or below when needed), move with pointer/keyboard dragging, and clamp within the viewport. Resizing the window or chat content recalculates placement. Expanded chat remains a full workspace panel; minimizing returns it to its cat. Existing chat state, execution and saved history are unchanged. The Dashboard changes requested earlier were reverted at the user's request and are not part of this update.

A geometry regression test covers drag deltas, viewport boundaries and mobile sizing. Production build and browser checks follow.

Hosted keyboard test confirmed the popup follows its cat. Narrow-screen inspection exposed potential overlap when neither side fits the full chat; compact chat height now adapts to the available space above/below its avatar, keeping the cat reachable. Dashboard changes remain reverted.
