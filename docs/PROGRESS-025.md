# Constrained hosted workflow suggestions

The reported brewery-menu prompt produced an unavailable agent/skill selection in an authenticated browser reproduction. The user's earlier generic 502 could not be attributed retroactively: network exceptions from ANS or OpenAI previously shared the generic workflow error.

Planner output now uses an enum of exact discovered agent/skill choices and the server maps those choices back to IDs. It cannot generate arbitrary IDs or cross-pair skills. The planner also explicitly understands that a general summarizer can summarize user-supplied menu text without claiming it can retrieve the menu. Empty discovery is actionable. ANS timeouts/HTTP failures and model connection/timeouts now return stage-specific errors without upstream payloads or credentials.

Regression tests verify allowed choices, rejection of fabricated choices, exact mapping, empty discovery, and sanitized timeout feedback. Seven targeted workflow API tests pass; full suite, build, and exact-prompt browser validation follow.

Validation completed: all 66 tests and the production build pass. The exact user prompt, “Extract key ideas from a brewery menu”, successfully generated a two-step suggestion through the authenticated browser using real discovery and model services. No menu was retrieved and no workflow was executed. The original generic error is now split into actionable discovery/model failure categories; the reproduced invalid selection is prevented by the output schema.
