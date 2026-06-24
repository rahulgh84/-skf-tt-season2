# SKF Table Tennis Season 2 Website

## Manager Login
Default password: `skf2026`

Change it in:
`assets/app.js`

Find:
`const MANAGER_PASSWORD = 'skf2026';`

## GitHub Hosting Steps
1. Create a GitHub repository, for example: `skf-table-tennis-season2`
2. Upload all files from this folder: `index.html`, `assets/styles.css`, `assets/app.js`
3. Go to repository Settings → Pages
4. Under Build and deployment, choose Deploy from branch
5. Select branch `main` and folder `/root`
6. Save
7. Your site will be available as a GitHub Pages URL.

## Important
This is a static website using browser Local Storage. Data is stored on the same device/browser. For multi-user live score updates across phones, use Firebase/Supabase later.
