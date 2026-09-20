# Restore hosted Discover registry

The local main branch was clean and matched GitHub at 5101d86, whose Vercel deployment reported success. The apparent stale Discover screen came from WorkspaceAccess selecting the public marketplace on external hostnames while localhost rendered the registry screen.

Restored the existing hosted registry screen at /discover via WorkflowPages discover mode. This brings back the two-column composition graph and ANS search layout while retaining authenticated hosted APIs and private saved agents. Local-only endpoints remain restricted.

TypeScript validation and the production build pass. Deployment verification is pending; authenticated ANS search needs a signed-in production session.
