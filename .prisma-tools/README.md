# Prisma offline helper

`fake-schema-engine` is a tiny stub used only when `prisma generate` cannot
download Prisma's schema-engine binary (for example in offline/sandboxed CI).

From the repository root:

```bash
npm run prisma:generate
```

The script passes `PRISMA_SCHEMA_ENGINE_BINARY` to the Prisma CLI. At runtime
the application does not use this stub — it uses `@prisma/client` directly
with the node-postgres (`pg`) driver adapter.
