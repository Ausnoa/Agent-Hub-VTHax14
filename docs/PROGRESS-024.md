# Visible workflow suggestion feedback

Reproduced the reported Compose issue in an authenticated hosted-mode browser: an invoice extraction/summary suggestion returned a valid two-step draft, but the button never indicated progress and the graph updated above the prompt. Suggestion errors also appeared only at the top of the long page.

Added suggestion-specific loading text and live status beside the button, local error feedback, minimum-description guidance, and a success message with the draft name and step count. Moved the graph below the prompt and focus/scroll it into view after successful generation. Failed suggestions preserve the existing draft. Empty drafts receive explicit feedback. Suggestions are disabled while the workspace is initially loading.

TypeScript validation passes. Production build and browser verification follow before deployment. No API, environment, or database changes.
