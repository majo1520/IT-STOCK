#!/usr/bin/env node

/**
 * Script to generate localStorage export instructions
 * 
 * Usage:
 *   node export_localstorage.js
 */

console.log(`
===== ReactStock localStorage Export Instructions =====

To export your localStorage data from the browser:

1. Open your ReactStock application in the browser
2. Open the browser developer tools:
   - Chrome/Edge: Press F12 or Ctrl+Shift+I (Cmd+Option+I on Mac)
   - Firefox: Press F12 or Ctrl+Shift+I (Cmd+Option+I on Mac)
   - Safari: Enable developer tools in Preferences > Advanced, then press Cmd+Option+I

3. Go to the Console tab
4. Copy and paste the following command:

copy(JSON.stringify(Object.keys(localStorage).reduce((obj, key) => {
  obj[key] = localStorage.getItem(key);
  return obj;
}, {})))

5. The command will copy all localStorage data to your clipboard
6. Create a new file named 'localstorage_export.json' in the reactstock/backend directory
7. Paste the clipboard contents into this file and save it

===== Next Steps =====

After creating the localstorage_export.json file, run:

node run_migrations.js
node migrate_from_localstorage.js

This will migrate your localStorage data to the PostgreSQL database.
`); 