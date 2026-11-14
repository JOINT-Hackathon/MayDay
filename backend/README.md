# Mayday TEAM5 backend

Based on JOINT-Hackathon/TEAM5_BE at `cd1189e0c174993a7159d23e4e40d032bb726a68`.

From the parent frontend project:

```bash
npm run backend:build
npm run backend:start
```

Java 21 is required. The default server listens on `127.0.0.1:8080` and persists accounts, sessions and records in the parent project's `data/mayday.mv.db`. Restarting does not erase this database. Do not delete the data directory; deployments must provide persistent storage or an external database.

Run `npm run backend:check` from the parent project to verify authentication, ownership, CRUD, ordering, and actual process-restart persistence using a separate temporary database.

See [integration guide](../docs/TEAM5_INTEGRATION.md) for endpoint details and deployment limits.
