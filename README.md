# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/53ea3618-a3fa-4f5a-8708-057a2f30b5e5

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/53ea3618-a3fa-4f5a-8708-057a2f30b5e5) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/53ea3618-a3fa-4f5a-8708-057a2f30b5e5) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

---

## Import from Sleeper (MVP)

This app supports importing Sleeper leagues via Supabase Edge Functions (no token required).

Flow:
- Go to /import/sleeper (also available via “Import from Sleeper” button on Dashboard/Sidebar)
- Choose “By Username” (enter Sleeper username + season) or “By League ID”
- Select a league (username path) → Review → Import
- On success you’ll be redirected to the League page populated with teams/rosters (and matchups if provided).

Edge Functions used:
- sleeper-lookup-user → resolve Sleeper user_id from username
- sleeper-user-leagues → list user leagues for a season
- sleeper-league-snapshot → fetch league, users, rosters (and optional week matchups)
- sleeper-import → upsert data into Supabase tables

Notes:
- Authentication is required (uses current Supabase session automatically)
- Imports are idempotent via unique constraints
- No client env vars needed for Sleeper (open API)

Run locally:
- npm i && npm run dev
- Open the preview URL shown by Lovable; sign in, then go to /import/sleeper

