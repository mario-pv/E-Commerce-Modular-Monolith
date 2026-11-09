# MySQL schema migrations

Flyway owns the schema; application startup runs versioned migrations before
Hibernate validates it (`ddl-auto: validate`). Hibernate no longer updates it.

- **Empty database:** start normally. Flyway executes V1 (the original schema)
  and V2 (Spring Modulith 2.1 publication lifecycle fields).
- **Already Flyway-managed database:** start normally. Applied migrations remain
  recorded in `flyway_schema_history`; only pending versions execute.
- **Existing pre-Flyway local demo database:** use the explicit, one-time adoption
  procedure below. Default startup deliberately refuses a non-empty database
  without migration history rather than silently treating it as version 1.

## Adopt the existing local database without deleting data

1. Stop the application, leave MySQL/data volumes intact, and take a database
   backup using your normal MySQL tooling. Verify the target `DB_URL` and schema.
   Do not use Flyway clean, delete tables, or run `docker compose down -v`.
2. Confirm the original tables match `V1__legacy_schema.sql`: `inventory_stock`,
   `order_orders`, and `event_publication`. This adoption path is for that legacy
   schema, not an arbitrary non-empty database or an already partially upgraded
   Hibernate schema. Restore/rehearse the backup in a separate database first.
3. For **one local startup only**, set the Spring profile `local-db-upgrade`:

   ```powershell
   mvn spring-boot:run "-Dspring-boot.run.profiles=local-db-upgrade"
   ```

   For an IDE, select the same Spring profile. For Docker, stop the normal app,
   keep only MySQL running, build the upgraded image, and run a temporary app
   container with the one-time profile:

   ```powershell
   docker compose stop app
   docker compose up -d --wait mysql
   docker compose build app
   docker compose run --rm --no-deps -e SPRING_PROFILES_ACTIVE=local-db-upgrade app
   ```

   Wait for successful startup, complete the checks below, then stop that
   temporary app with Ctrl+C. `compose run` does not publish the service's ports;
   it is used here for schema adoption, not browsing the storefront. Start the
   normal app afterwards with `docker compose up -d --wait app` (no upgrade profile).

   This opt-in enables `baseline-on-migrate` at version **1**, records the existing
   schema without running V1, then applies V2. Baseline-on-migrate is unsafe for
   unknown database targets; do not set it globally or leave this profile enabled.
4. Check successful startup/Hibernate validation and `flyway_schema_history`:
   version 1 must be `BASELINE`, version 2 must be `SQL`, both successful. Check
   your existing stock quantities, orders, and event rows against the backup.
5. Stop the app, remove the one-time profile, then start normally. Keep the
   backup. Never edit a migration that has already run; add a new version.

V2 preserves the existing binary publication IDs, event JSON, listener IDs, the
`com.portfolio.modulith.order.OrderCreatedEvent` type name, and timestamps.
Completed legacy rows become `COMPLETED`; incomplete rows become `FAILED` so they
remain eligible for explicit retry. `completion_attempts` starts at zero and has
a database default of zero; `last_resubmission_date` remains null. This does not
configure automatic event retries or erase completed history.

## Verification

`SchemaMigrationIT` starts separate Spring-managed `mysql:8.0.44` containers for
an empty database and the legacy schema plus fixture stock/order/outbox rows.
Both paths use actual Flyway startup followed by Hibernate validation; the fresh
path also creates an order and waits for its persisted outbox completion. Neither
test uses the developer datasource. Existing H2 and concurrency tests explicitly
disable Flyway because those tests use Hibernate `create-drop` instead.

```powershell
mvn -B -Dtest=NoUnitTests -Dsurefire.failIfNoSpecifiedTests=false -Dit.test=SchemaMigrationIT verify
```
