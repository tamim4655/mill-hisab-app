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
2. Add a typed serializer/parser for the existing database and unit-test round trips, including legacy optional fields. (Initial local deletion-event capture for payments and expenses is now in place.)
3. Add spreadsheet discovery/creation and header validation.
4. Add append-only, idempotent change synchronization and a one-table month filter/export.
5. Test two-device simultaneous edits, offline retries, duplicate retries, deletion/tombstones, first-time migration, and full restore.
6. Only then offer a test APK. Preserve the existing Firebase backup/sync path until the user verifies Sheets behavior.

## OAuth and cross-device discovery findings (2026-11-18)

- Google’s official Sheets API scope guide explicitly lists `drive.file` as a supported, recommended non-sensitive scope for Sheets API operations. The current narrow scope can therefore be used for spreadsheet creation and values read/write on files the app is authorized to access. See https://developers.google.com/workspace/sheets/api/scopes.
- The Sheets API itself has no list-spreadsheets method. Google’s create/manage guide says finding a user's spreadsheets uses Drive `files.list`, and listing all spreadsheets requires a restricted Drive scope. See https://developers.google.com/workspace/sheets/api/guides/create.
- Therefore, do not implement broad Drive-wide discovery under the current narrow permission. Preferred flow: create on first phone; use Google Picker on another phone to select the same sheet (Picker + `drive.file`), then store the selected spreadsheet ID locally. This requires enabling Google Picker API and configuring an API key in the Cloud project before implementation/testing.

- Fixed a missed integration in the existing app save path: normal database saves now call the existing `onCloudLocalSave` hook after local persistence/render. This lets the retained Firebase sync receive ordinary edits (including the local tombstone journal) when its existing login/connection is active. This is not Google Sheets upload, and the legacy whole-database Firebase conflict model remains unchanged.

- Payment and expense deletion now records a local tombstone in `db.syncTombstones` before the existing array item is removed. Each event carries an operation ID, record type/ID, original record snapshot, deletion time, and device ID. The journal currently has no size cap: deletion events are retained rather than silently discarded until a safe remote acknowledgement/compaction protocol exists. These events are persisted with the normal local database save. They are not uploaded to Sheets; the existing Firebase whole-database path can carry the local journal, but this does not provide general conflict-safe record merging. A simple export of the current DB cannot reconstruct deletions that were never synchronized.

## Current status

- Verified the existing local JSON data model and documented a one-table, lossless row format.
- Added a Settings control that starts the native Google Sheets authorization flow.
- Added Android `AuthorizationClient` authorization for the narrow `drive.file` scope. The short-lived access token remains in native memory and is not exposed to WebView JavaScript or persisted.
- Existing Firebase code remains in the project as a temporary fallback while the Sheets path is developed and tested.
- Added local tombstone capture for payment and expense deletions; this is only a local journal, not cloud synchronization.
- Google Picker integration, reading/writing actual records, change-log merge/acknowledgement, month filtering in Sheets, and end-to-end two-device tests remain unimplemented. Workbook creation is available, but it does not yet sync any app data.


## Latest implementation update (2026-11-19)

- Added a native Google Sheets API request that creates a spreadsheet titled "মিল হিসাব" with one worksheet titled "হিসাব" after the user grants the existing `drive.file` authorization.
- The app writes the documented 16-column table header (including the `deleted` tombstone flag) to row 1 using the Sheets Values API.
- The returned spreadsheet ID is stored locally in Android SharedPreferences; the WebView receives only the spreadsheet ID and a user-facing result, never the OAuth access token.
- The creation control is exposed in Settings after successful authorization. This is a first-device workbook-creation step only.
- Not yet implemented: writing actual customer/meal/payment/expense records, reading and merging sheet rows, retry/idempotency journal operations, selecting the same spreadsheet on another phone, and two-device verification. Creating the workbook and its header is not yet data synchronization.
- Build `44629726178` for commit `bcce3de` completed successfully, including JavaScript syntax checks, Android debug APK build, and artifact upload. This confirms buildability only; the APK has not been tested on a physical device.


## Follow-up implementation update (2026-11-20)

- Expanded the sheet header range from `A1:O1` to `A1:P1` and added the `deleted` column so the actual header matches the documented tombstone-capable row schema.
- Added a native-side reuse guard: if this installation already has a saved spreadsheet ID, the create action reuses that workbook and retries header setup instead of creating another duplicate workbook. The access token remains native-only.
- A fresh Android build is running for this change. This is still workbook setup only; actual record synchronization and second-device selection remain outstanding.


## Read-only workbook verification update (2026-11-20)

- Added a native read-only check action in Settings. It requires a live native Google Sheets access token and the workbook ID saved by the first-device creation flow.
- The check requests values from `'হিসাব'!A1:P`, verifies that a 16-column header begins with `schema_version` and ends with `deleted`, and reports the number of returned rows (including the header).
- This check does not write, clear, or delete any spreadsheet data. It is a connection/schema smoke check only; it does not verify that app records have synchronized.
- Build workflow run [44631507161](https://github.com/tamim4655/mill-hisab-app/actions/runs/44631507161) for commit `812b77644de01c9a0ef9512bcaf23a2ff68ce69c` completed successfully and uploaded the debug APK artifact `mill-hisab-debug-apk` (8,171,777 bytes; artifact ID `14582860470`; expires 2026-11-26 22:46:55 UTC).
- Still outstanding: record serialization and round-trip tests, safe append-only/idempotent change operations, remote read/merge, cross-device workbook selection, and two-device/offline/deletion/restore testing. Do not describe the current build as a working multi-device Sheets sync release.
