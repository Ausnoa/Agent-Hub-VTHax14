# Retire standalone History page

Removed History/Execution from the main navigation and removed history shortcuts in the agent builder and local agent list. The old /execution index redirects to My Agents, including hosted access, and it is no longer a login destination. Agent tests, workflow run records, inline results, and individual local run detail routes remain intact. No database changes or data deletion.

Login destination regression test passes; production build and deployed navigation/redirect checks follow.
