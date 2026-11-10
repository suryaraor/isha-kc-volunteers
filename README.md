# Isha KC Volunteer Outreach

Static web app (HTML/CSS/JS) with a Google Sheet as the backend, via a Google Apps Script web app. Same pattern as the check-in app.

**Flow:** an active volunteer opens the page, picks their name, then taps any number of inactive volunteers and confirms. Those people are tied to them and disappear from everyone else's list. The pick list only receives names; phone numbers are sent only for the volunteers already assigned to you, shown under "Your volunteers" as WhatsApp links.

## Monthly check-ins

The top of the page counts down to the next Satsang (2nd Saturday of the month). Each "month" runs from the Sunday after one Satsang through the next one, and is named for the month its Satsang falls in.

Under "Your volunteers", each person is a collapsible card with four icon questions: how you reached them, their Shambhavi practice, whether they're coming to Satsang, and how their personal life is going. Each tap saves right away to a `Status` tab, one row per volunteer per month (the tab is created automatically). Tapping a different answer overwrites that month's value. When a new month starts, the cards start out blank and the earlier months stay in the sheet.

## Satsang material signups

Live at `https://suryaraor.github.io/isha-kc-volunteers/material-signup/` (also linked from the countdown on the outreach page).

Active volunteers pick their name, which is shared with the outreach page in the same browser, and tap an item tile. A panel slides up where they choose **This month**, **Whole year** (the next 12 Satsangs), or tap any specific months. Months someone else already covers are greyed out and skipped. Reopening the tile shows their months, so they can add or drop months, or cancel them all. Tiles are orange while still needed, green when you have them, and grey when someone else has them. The header counts how many items are still needed, and a button shares the open list to WhatsApp.

It uses the same sheet and Apps Script as the outreach page. Two tabs are created automatically on first load:
- `Materials`: the item list (Key, Item, Icon, People Needed, Active). Edit it to rename items, change icons, ask for more than one person (every item starts at 1), or set Active to `no` to hide an item. Don't change a Key once people have signed up for it.
- `Material Signups`: one row per person per item per Satsang month. A whole-year signup writes 12 rows, one per month.

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
