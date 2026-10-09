# Isha KC Volunteer Outreach

Static web app (HTML/CSS/JS) with a Google Sheet as the backend, via a Google Apps Script web app. Same pattern as the check-in app.

**Flow:** an active volunteer opens the page, picks their name, then taps any number of inactive volunteers and confirms. Those people are tied to them and disappear from everyone else's list. Phone numbers never leave the sheet; the page only receives names.

## Setup

1. **Create the sheet.** In Google Sheets, create a new spreadsheet, then File > Import > Upload `volunteers-sheet.csv` and choose "Replace current sheet". Rename the tab to `Volunteers`.
   Columns: `ID, Name, Phone, Region, Groups, Active Volunteer, Assigned To ID, Assigned To, Assigned At`.
   (Regenerate from `data/volunteers.json` if the active/inactive split changes.)
2. **Add the backend.** In the sheet: Extensions > Apps Script, delete the default code, paste `apps-script.js`, save.
3. **Deploy.** Deploy > New deployment > type Web app > Execute as: Me > Who has access: Anyone > Deploy. Authorize when prompted and copy the `/exec` URL.
4. **Connect the page.** Open `index.html` (or host the folder on GitHub Pages). On first load, paste the `/exec` URL into the setup box. To bake it in for everyone, set `appsScriptUrl` in `script.js`.

After changing `apps-script.js`, use Deploy > Manage deployments > Edit > New version.

## Notes

- Claims are serialized with a script lock, so two people can't take the same volunteer. If someone is taken first, the page tells the user and refreshes the list.
- Volunteers can remove their own picks ("Remove"), which makes the person available again.
- The "Assigned To" and "Assigned At" columns in the sheet give you the final mapping.
- Anyone with the page URL can pick a name; there is no login (same as the reference app).
