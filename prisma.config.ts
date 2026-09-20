// Prisma 7 CLI config: connection URLs no longer live in schema.prisma.
// This file is only used by the Prisma CLI (db pull, generate) — the direct
// (non-pooled) connection is used here because introspection/migration
// commands don't work reliably through the transaction pooler.
// See docs/DECISION-006-PRISMA-INTEGRATION.md.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DIRECT_URL,
  },
});
