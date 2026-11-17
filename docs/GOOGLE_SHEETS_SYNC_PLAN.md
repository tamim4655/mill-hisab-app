# Google Sheets sync implementation plan

## Current data model (verified from index.html)

The app's canonical local database is stored as JSON in localStorage key `meal_manager_bn_v1`:

- `customers[]`: `id`, `name`, `rate`, `openingDue`, `active`, `startDate` (legacy seed entries may omit some optional fields).
- `meals`: object keyed by ISO date (`YYYY-MM-DD`), then customer ID, then meal count.
- `mealRates`: object keyed by ISO date, then customer ID, then the rate used for that date.
- `payments[]`: `id`, `date`, `cid`, `amount`, `method`.
- `expenses[]`: `id`, `date`, `title`, `category`, `amount`.

Do not assume that a monthly report is the full database: customer metadata, opening balances, historical daily meal rates, and inactive members must also survive migration.

## One-spreadsheet / one-table representation

Use one worksheet named `হিসাব` and one header row. Each data row represents one typed record, with a stable key:

| Column | Purpose |
| --- | --- |
| schema_version | Row format version |
| record_type | `customer`, `meal`, `payment`, or `expense` |
| record_id | Stable ID; meal key is date + customer ID |
| month | `YYYY-MM`, for month filtering |
| date | ISO date; blank only for customer metadata |
| member_id | Customer ID where applicable |
| member_name | Snapshot label for readable reports |
| quantity | Meal count for meal rows |
| unit_rate | Historical rate for meal rows |
| amount | Payment/expense amount or opening due |
| category | Payment method or expense category |
| description | Expense title or optional note |
| payload_json | Full record JSON for lossless reconstruction |
| updated_at | UTC timestamp for conflict ordering |
| device_id | Originating installation ID |
| deleted | Tombstone flag; never silently erase a row during sync |

All months remain in this single table; the `month` column enables filtering. The `payload_json` field preserves optional and future fields so the sheet view does not become a lossy export.

## Concurrency and safety requirements

- Never clear and rewrite the whole sheet on each phone save. That can erase another phone's recent edits.
- Prefer append-only change rows with stable operation IDs and tombstones; derive the latest record state deterministically when reading. Do not rely on timestamps alone to resolve ties.
- Before enabling writes, define idempotency, duplicate detection, retry handling, and conflict UX.
- Keep Firestore sync and local JSON backups intact during rollout. Sheets must first be tested as a parallel destination; do not remove the existing cloud path until migration and restore tests pass.
- On first connection, compare local and remote state and require an explicit choice if both contain data. Take a local backup before importing or replacing anything.
- Never put service-account private keys, client secrets, or long-lived refresh tokens in the APK.

## Implementation sequence

1. Add Android Google authorization for the minimum Sheets/Drive scopes and a Settings-only connection flow; do not treat the Google ID token used for Firebase Auth as a Sheets API access token.
2. Add a typed serializer/parser for the existing database and unit-test round trips, including legacy optional fields.
3. Add spreadsheet discovery/creation and header validation.
4. Add append-only, idempotent change synchronization and a one-table month filter/export.
5. Test two-device simultaneous edits, offline retries, duplicate retries, deletion/tombstones, first-time migration, and full restore.
6. Only then offer a test APK. Preserve the existing Firebase backup/sync path until the user verifies Sheets behavior.

## OAuth and cross-device discovery findings (2026-11-18)

- Google’s official Sheets API scope guide explicitly lists `drive.file` as a supported, recommended non-sensitive scope for Sheets API operations. The current narrow scope can therefore be used for spreadsheet creation and values read/write on files the app is authorized to access. See https://developers.google.com/workspace/sheets/api/scopes.
- The Sheets API itself has no list-spreadsheets method. Google’s create/manage guide says finding a user's spreadsheets uses Drive `files.list`, and listing all spreadsheets requires a restricted Drive scope. See https://developers.google.com/workspace/sheets/api/guides/create.
- Therefore, do not implement broad Drive-wide discovery under the current narrow permission. Preferred flow: create on first phone; use Google Picker on another phone to select the same sheet (Picker + `drive.file`), then store the selected spreadsheet ID locally. This requires enabling Google Picker API and configuring an API key in the Cloud project before implementation/testing.
- Existing record deletion is currently a physical array filter in the web app (`delPay`, `deleteExpense`); it is not a tombstone. A safe sync journal must capture deletion events before removal, or the UI/data model must be changed to retain tombstones. A simple export of the current DB cannot reconstruct those deletions across devices.

## Current status

- Verified the existing local JSON data model and documented a one-table, lossless row format.
- Added a Settings control that starts the native Google Sheets authorization flow.
- Added Android `AuthorizationClient` authorization for the narrow `drive.file` scope. The short-lived access token remains in native memory and is not exposed to WebView JavaScript or persisted.
- Existing Firebase code remains in the project as a temporary fallback while the Sheets path is developed and tested.
- Not yet implemented: Google Picker integration, spreadsheet creation, reading/writing rows, change-log merge, month filtering in Sheets, and end-to-end two-device tests. The current authorization control alone does not sync any data.
