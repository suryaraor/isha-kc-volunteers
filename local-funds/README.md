# Isha KC Local Funds

Tracks money that active volunteers contribute for local expenses (e.g. sesame oil for satsangs and Isha programs). Static page on GitHub Pages, Google Sheet as the backend via Apps Script, same pattern as the outreach app in the parent folder.

Live at `https://suryaraor.github.io/isha-kc-volunteers/local-funds/`

**Views**
- **Donors**: every donor with their total, number of contributions, and last date. Tap a name for the breakdown.
- **Balance & spending**: total received, spent, balance; who currently holds the money; spending per initiative (with how many units the balance still covers); full history of entries.
- **Add entry**: PIN protected; also used to edit an existing entry. Three kinds of entry:
  - *Donation*: donor gave money, and who received it (that person now holds it).
  - *Expense*: a holder spent money on an initiative (optional quantity, e.g. 2 bottles).
  - *Handover*: cash moved from one holder to another.

Anyone with the link can view. Only people with the PIN can change data. Once unlocked, every entry under "All entries" has:
- **Edit**: opens it in the entry form; change any field (including the type) and tap "Update entry".
- **Void / Restore**: keeps the row in the history but stops it counting, so the change is visible and reversible.
- **Delete**: tap twice to remove the row from the sheet for good.

## Setup

1. **Create a new Google Sheet** (separate from the volunteer contact sheet), e.g. "Isha KC Local Funds".
2. **Add the backend.** Extensions > Apps Script, delete the default code, paste `apps-script.js`, save.
3. **Create the tabs.** In the editor, pick `setup` in the function dropdown and Run. This creates `Transactions` and `Initiatives` (seeded with sesame oil, $12 per small bottle).
4. **Set the PIN.** Project Settings (gear) > Script properties > Add `EDIT_PIN` with the PIN you'll share with fund keepers.
5. **Deploy.** Deploy > New deployment > Web app > Execute as: Me > Who has access: Anyone. Copy the `/exec` URL.
6. **Connect the page.** Set `appsScriptUrl` in `script.js` to that URL and push, or paste it into the setup box on first load (saved in that browser only).

After changing `apps-script.js`, use Deploy > Manage deployments > Edit > New version.

## Sheet layout

- `Transactions`: `ID, Date, Type, Amount, From, To, Initiative, Qty, Note, Entered At, Voided`
- `Initiatives`: `Name, Unit, Unit Cost, Notes`. Add a row to start tracking a new initiative; it shows up in the Expense dropdown on the next load.

Holder balances: a Donation adds to "To", an Expense subtracts from "From" (the payer), a Handover moves from "From" to "To". Names are matched case-insensitively, so pick names from the suggestions to keep them consistent.

If a volunteer pays out of pocket, record it as an Expense paid by them; their holder balance goes negative, which shows they are owed. A Handover to them from a holder settles it.
