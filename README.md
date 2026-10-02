# Class 10 Revision Planner

- public/index.html: the website
- netlify/functions/sync.mjs: accounts and cross-device sync (uses Netlify Blobs)
- package.json, netlify.toml: Netlify settings

Deploy with Git (recommended): push this folder to GitHub, then in Netlify choose
"Add new site" > "Import an existing project" and pick the repo. No build command needed.

Or with the CLI:  npm install -g netlify-cli && npm install && netlify deploy --prod
(When asked for a publish directory use "public".)
