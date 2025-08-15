# FantasyPros Projections Pipeline Setup

This guide sets up an end-to-end pipeline to scrape FantasyPros weekly projections, store them in Supabase, and make them available to your fantasy football app.

## 🚀 Quick Start

1. **Run SQL Schema** (in Supabase SQL Editor)
2. **Deploy Edge Function** 
3. **Install Dependencies**
4. **Test Locally**
5. **Set up GitHub Actions**

## 📋 Prerequisites

- Supabase project with PostgreSQL
- Node.js 18+ and npm
- GitHub repository with Actions enabled

## 🗄️ 1. Database Schema

Copy and paste this SQL into your **Supabase SQL Editor**:

```sql
-- 1) Raw drops from the scraper (staging)
create table if not exists public.projections_raw (
  id bigserial primary key,
  source text not null,              -- 'fantasypros'
  season int not null,
  week int not null,
  ext_player_key text not null,      -- "Name|Team|Pos"
  player_name text not null,
  team text,
  position text,
  projected_points numeric(6,2),
  stats jsonb,
  collected_at timestamptz default now(),
  unique (source, season, week, ext_player_key)
);

-- 2) Mapping FantasyPros -> Sleeper
create table if not exists public.player_map (
  source text not null,              -- 'fantasypros'
  ext_player_key text not null,      -- "Name|Team|Pos"
  sleeper_player_id text,            -- from public.players.player_id
  confidence numeric,                -- 0..1
  manual boolean default false,
  updated_at timestamptz default now(),
  primary key (source, ext_player_key)
);

-- 3) Final, per-player projections (fast to query)
create table if not exists public.projections (
  source text not null,
  season int not null,
  week int not null,
  sleeper_player_id text not null,
  position text,
  projected_points numeric(6,2),
  stats jsonb,
  collected_at timestamptz default now(),
  unique (source, season, week, sleeper_player_id)
);

-- (Optional) Where matchup lines will be stored
create table if not exists public.matchup_lines (
  league_id text not null,
  week int not null,
  home_roster_id text not null,
  away_roster_id text not null,
  home_wp numeric(5,4) not null,     -- 0..1
  spread numeric(6,2) not null,      -- home - away
  total numeric(6,2) not null,
  updated_at timestamptz default now(),
  primary key (league_id, week, home_roster_id, away_roster_id)
);

-- Enable RLS
alter table public.projections_raw enable row level security;
alter table public.player_map enable row level security;
alter table public.projections enable row level security;
alter table public.matchup_lines enable row level security;

-- Read policies for authenticated app users
drop policy if exists "read projections_raw" on public.projections_raw;
create policy "read projections_raw" on public.projections_raw
for select using (auth.role() = 'authenticated');

drop policy if exists "read player_map" on public.player_map;
create policy "read player_map" on public.player_map
for select using (auth.role() = 'authenticated');

drop policy if exists "read projections" on public.projections;
create policy "read projections" on public.projections
for select using (auth.role() = 'authenticated');

drop policy if exists "read matchup_lines" on public.matchup_lines;
create policy "read matchup_lines" on public.matchup_lines
for select using (auth.role() = 'authenticated');
```

## 🔧 2. Deploy Edge Function

### Deploy the function:
```bash
supabase functions deploy ingest-projections
```

### Set function secrets (in Supabase Dashboard):
1. Go to **Functions** → **ingest-projections** → **Settings** → **Secrets**
2. Add these secrets:
   - `SUPABASE_URL` = Your project URL
   - `SUPABASE_SERVICE_ROLE_KEY` = Your service role key
   - `INGEST_SECRET` = A long random string (e.g., `fp_ingest_2025_secret_key`)

### Get your function URL:
```
https://<PROJECT_ID>.supabase.co/functions/v1/ingest-projections
```

## 📦 3. Install Dependencies

```bash
# Install Playwright
npm install -D playwright

# Install Playwright browsers
npx playwright install chromium
```

## 🧪 4. Test Locally

### Test scraper (JSON output only):
```bash
SEASON=2025 WEEK=1 SCORING=PPR npm run scrape:fp
```

### Test full pipeline (with ingest):
```bash
SEASON=2025 WEEK=1 SCORING=PPR \
INGEST_URL="https://<PROJECT_ID>.supabase.co/functions/v1/ingest-projections" \
INGEST_SECRET="your_secret_here" \
npm run scrape:fp
```

## 🤖 5. GitHub Actions Setup

### Add repository secrets (GitHub → Settings → Secrets → Actions):
- `INGEST_URL` = Your Supabase function URL
- `INGEST_SECRET` = Same secret used in the function

### The workflow will run automatically at 02:30 ET daily, or manually via:
GitHub → Actions → "Scrape FantasyPros (daily)" → "Run workflow"

## 📊 6. Verify Success

After running, check your Supabase tables:

```sql
-- Check raw data
SELECT COUNT(*) FROM projections_raw WHERE source = 'fantasypros';

-- Check mappings
SELECT COUNT(*) FROM player_map WHERE source = 'fantasypros';

-- Check final projections
SELECT COUNT(*) FROM projections WHERE source = 'fantasypros';

-- Sample of mapped players
SELECT 
  pm.ext_player_key,
  pm.sleeper_player_id,
  pm.confidence,
  p.full_name,
  p.team,
  p.position
FROM player_map pm
JOIN players p ON pm.sleeper_player_id = p.player_id
WHERE pm.source = 'fantasypros'
LIMIT 10;
```

## 🔍 Troubleshooting

### Playwright timeouts:
- Increase `waitForSelector` timeout in scraper
- Site may be slow during peak hours

### 401 Unauthorized:
- Check `INGEST_SECRET` matches between scraper and function
- Verify function secrets are set correctly

### Few mapped players:
- Check team aliases in `TEAM_ALIASES` object
- Verify your `players` table has correct team/position data
- Consider manual mapping UI for unmapped players

### Database errors:
- Ensure all tables exist and RLS policies are correct
- Check function has service role access

## 📈 Usage in Your App

Query projections for a specific week:

```typescript
// Get all QB projections for Week 1
const { data: qbProjections } = await supabase
  .from('projections')
  .select('*')
  .eq('source', 'fantasypros')
  .eq('season', 2025)
  .eq('week', 1)
  .eq('position', 'QB');

// Get specific player projection
const { data: playerProj } = await supabase
  .from('projections')
  .select('*')
  .eq('source', 'fantasypros')
  .eq('season', 2025)
  .eq('week', 1)
  .eq('sleeper_player_id', 'player_id_here')
  .single();
```

## 🔄 Weekly Updates

The scraper currently hardcodes `WEEK: '1'` in the GitHub Action. To update weekly:

1. **Manual**: Edit `.github/workflows/scrape-fp.yml` and change `WEEK: '1'` to current week
2. **Automatic**: Future enhancement could detect current NFL week

## 🚀 Next Steps

After this pipeline is working, implement:

1. **Matchup Lines Endpoint**: Compute spreads/totals using projections
2. **Admin UI**: Manual player mapping for unmapped players
3. **Multiple Scoring Formats**: STD, HALF, PPR projections
4. **Historical Data**: Store multiple weeks/seasons

## 📝 Notes

- **Scraping Frequency**: Once daily to be respectful to FantasyPros
- **Data Freshness**: All app reads come from your DB, not live scraping
- **Cost**: Minimal - just Supabase storage and Edge Function invocations
- **Reliability**: GitHub Actions with retry logic for production use

---

**Need help?** Check the troubleshooting section or review the function logs in Supabase Dashboard.
