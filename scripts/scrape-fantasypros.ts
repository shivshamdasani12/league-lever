/**
 * Usage:
 *   npm run scrape:projections -- --season 2025 --week 1 --scoring PPR
 *
 * Behavior:
 *  - Scrapes FantasyPros projections for QB/RB/WR/TE/K/DST
 *  - Parses table by headers (robust to column order)
 *  - Polite: single page at a time + small delay
 *  - Fetches Sleeper players and fuzzy-matches names -> player_id
 *  - Prints { ok, count, data } to stdout
 *  - If INGEST_URL and INGEST_API_KEY env vars are set, POSTs to edge function
 */

import { chromium, Browser } from "playwright";
import { fetch } from "undici";
import { compareTwoStrings } from "string-similarity";
import pLimit from "p-limit";
import { z } from "zod";

type FPPos = "qb" | "rb" | "wr" | "te" | "k" | "dst";

const ARGS = parseArgs(process.argv.slice(2));
const SEASON = toInt(ARGS.season ?? "2025");
const WEEK = toInt(ARGS.week ?? "1");
const SCORING = String(ARGS.scoring ?? "PPR").toUpperCase(); // PPR | HALF | STD
const POSITIONS: FPPos[] = ["qb", "rb", "wr", "te", "k", "dst"];

const FP_URL = (pos: FPPos) =>
  `https://www.fantasypros.com/nfl/projections/${pos}.php?week=${WEEK}&scoring=${SCORING}`;

const SLEEPER_PLAYERS_URL = "https://api.sleeper.app/v1/players/nfl";

const OutRow = z.object({
  source: z.literal("fantasypros"),
  season: z.number(),
  week: z.number(),
  scoring: z.string(),
  player_id: z.string(),
  position: z.string(),
  points: z.number().nullable(),
  raw: z.record(z.any()),
});
type OutRow = z.infer<typeof OutRow>;

// ---------- helpers ----------
function parseArgs(list: string[]) {
  // parse --key value
  const out: Record<string, string> = {};
  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    if (t.startsWith("--")) {
      const key = t.slice(2);
      const val = list[i + 1]?.startsWith("--") || !list[i + 1] ? "true" : list[++i];
      out[key] = val;
    }
  }
  return out;
}

function toInt(s: string) {
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error(`Expected number, got ${s}`);
  return n | 0;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeName(n: string) {
  return n
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/'/g, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTeamAbbreviation(fullTeamName: string): string {
  const teamMap: Record<string, string> = {
    'PITTSBURGH': 'PIT',
    'DENVER': 'DEN',
    'WASHINGTON': 'WAS',
    'ARIZONA': 'ARI',
    'CINCINNATI': 'CIN',
    'NEWENGLAND': 'NE',
    'PHILADELPHIA': 'PHI',
    'MINNESOTA': 'MIN',
    'SANFRANCISCO': 'SF',
    'CHICAGO': 'CHI',
    'LOSANGELES': 'LAR', // Default to Rams, will handle Chargers separately
    'HOUSTON': 'HOU',
    'MIAMI': 'MIA',
    'KANSASCITY': 'KC',
    'NEWYORK': 'NYG', // Default to Giants, will handle Jets separately
    'TAMPABAY': 'TB',
    'ATLANTA': 'ATL',
    'SEATTLE': 'SEA',
    'CLEVELAND': 'CLE',
    'JACKSONVILLE': 'JAX',
    'DALLAS': 'DAL',
    'GREENBAY': 'GB',
    'BUFFALO': 'BUF',
    'DETROIT': 'DET',
    'INDIANAPOLIS': 'IND',
    'LASVEGAS': 'LV',
    'BALTIMORE': 'BAL',
    'CAROLINA': 'CAR',
    'NEWORLEANS': 'NO',
    'TENNESSEE': 'TEN'
  };
  
  return teamMap[fullTeamName] || fullTeamName;
}
// ---------- Sleeper index ----------
type SleeperPlayer = {
  player_id: string;
  full_name?: string;
  position?: string;
  team?: string;
};

async function getSleeperIndex() {
  const res = await fetch(SLEEPER_PLAYERS_URL);
  const all = (await res.json()) as Record<string, any>;
  const byPos: Record<string, SleeperPlayer[]> = {};
  
  for (const [id, p] of Object.entries<any>(all)) {
    if (!p?.position) continue;
    
    // For defenses, we need to handle the case where full_name might be null
    if (p.position === 'DEF') {
      if (!p?.team) continue; // Must have a team
      const sp: SleeperPlayer = { 
        ...p, 
        player_id: id,
        full_name: p.full_name || `Team ${p.team}` // Provide fallback name
      };
      if (!byPos['DEF']) byPos['DEF'] = [];
      byPos['DEF'].push(sp);
      continue;
    }
    
    // For other positions, require full_name
    if (!p?.full_name) continue;
    const sp: SleeperPlayer = { ...p, player_id: id };
    const pos = String(p.position).toUpperCase();
    if (!byPos[pos]) byPos[pos] = [];
    byPos[pos].push(sp);
  }
  
  console.log(`Sleeper index created:`, Object.fromEntries(
    Object.entries(byPos).map(([pos, players]) => [pos, players.length])
  ));
  
  return byPos;
}

function matchPlayer(
  fpName: string,
  pos: FPPos,
  teamHint: string | undefined,
  indexByPos: Record<string, SleeperPlayer[]>
): SleeperPlayer | null {
  const candidates = indexByPos[pos.toUpperCase()] ?? [];
  const target = normalizeName(fpName);
  let best: SleeperPlayer | null = null;
  let bestScore = 0;
  
  // Special handling for defenses - lower threshold and team-based matching
  const isDefense = pos === 'dst';
  const threshold = isDefense ? 0.2 : 0.6; // Even lower threshold for defenses
  
  for (const c of candidates) {
    const score = compareTwoStrings(target, normalizeName(c.full_name ?? ""));
    let teamBoost = 0;
    
    // Enhanced team matching for defenses
    if (isDefense && teamHint && c.team) {
      if (teamHint === c.team) {
        teamBoost = 0.3; // Strong team match
      } else if (teamHint.includes(c.team) || c.team.includes(teamHint)) {
        teamBoost = 0.15; // Partial team match
      }
    } else if (teamHint && c.team && teamHint === c.team) {
      teamBoost = 0.05; // Regular team boost for non-defenses
    }
    
    const total = score + teamBoost;
    if (total > bestScore) {
      best = c;
      bestScore = total;
    }
  }
  
  // For defenses, also try to find by team abbreviation if no good match found
  if (isDefense && !best && teamHint) {
    console.log(`Trying to find defense by team abbreviation: ${teamHint}`);
    const teamMatch = candidates.find(c => c.team === teamHint);
    if (teamMatch) {
      console.log(`Found defense by team: ${teamMatch.full_name} (${teamMatch.team})`);
      return teamMatch;
    }
  }
  
  return bestScore >= threshold ? best : null;
}

// ---------- scraping ----------
async function scrapePosition(browser: Browser, pos: FPPos) {
  const url = FP_URL(pos);
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });

  // Try to find a table with headers
  const rows = await page.evaluate(() => {
    const table = document.querySelector("table") || 
                  document.querySelector(".table-responsive table") || 
                  document.querySelector("#data table");
    
    if (!table) return [];
    
    const headers = Array.from(table.querySelectorAll("thead th")).map(th => 
      (th.textContent || "").trim().toLowerCase()
    );
    
    const bodyRows = Array.from(table.querySelectorAll("tbody tr"));
          const out: any[] = [];
      
      for (const tr of bodyRows) {
        const tds = Array.from(tr.querySelectorAll("td"));
        const row: any = {};
        
        tds.forEach((td, i) => {
          const key = headers[i] || `col_${i}`;
          row[key] = (td.textContent || "").trim();
        });
        
        // Extract team hint from player cell
        if (tds[0]) {
          const playerText = (tds[0].textContent || "").trim();
          const teamMatch = playerText.match(/\(([^)]+)\)/);
          if (teamMatch) row._team_hint = teamMatch[1];
        }
        
        out.push(row);
      }
    
    return out;
  });

  await page.close();
  return rows.map((r: any) => ({ ...r, _pos: pos }));
}

function parsePoints(row: Record<string, string>): number | null {
  const candidates = [
    "fpts",
    "pts",
    "fantasy pts",
    "fantasy points",
    "proj",
    "projected pts",
  ];
  for (const k of candidates) {
    if (k in row) {
      const n = Number(String(row[k]).replace(/[^\d.-]/g, ""));
      if (Number.isFinite(n)) return Number(n.toFixed(2));
    }
  }
  return null;
}

function parsePlayerName(row: Record<string, string>): string {
  // common headers: 'player', 'name'
  const raw = (row["player"] ?? row["name"] ?? "").trim();
  if (!raw) return raw;
  return raw.split("(")[0].trim();
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const sleeperIndex = await getSleeperIndex();
    const limit = pLimit(1); // be polite: one page at a time

    const all: OutRow[] = [];
    for (const pos of POSITIONS) {
      console.log(`Scraping position: ${pos}`);
      const rows = await limit(() => scrapePosition(browser, pos));
      console.log(`Found ${rows.length} rows for ${pos}`);
      await sleep(600); // small delay between positions

      for (const r of rows as any[]) {
        const name = parsePlayerName(r);
        if (!name) continue;
        
        // Special handling for defenses - extract team from name
        let teamHint = (r["_team_hint"] ?? "").toString().toUpperCase().replace(/[^\w]/g, "") || undefined;
        
        if (pos === 'dst' && !teamHint) {
          // For defenses, try to extract team from the name
          console.log(`Processing defense: ${name}`);
          
          // Handle special cases first
          if (name.includes('Los Angeles Chargers')) {
            teamHint = 'LAC';
          } else if (name.includes('Los Angeles Rams')) {
            teamHint = 'LAR';
          } else if (name.includes('New York Jets')) {
            teamHint = 'NYJ';
          } else if (name.includes('New York Giants')) {
            teamHint = 'NYG';
          } else {
            // Use regex for other teams
            const teamMatch = name.match(/(\w+(?:\s+\w+)*?)\s+(?:Steelers|Broncos|Commanders|Cardinals|Bengals|Patriots|Eagles|Vikings|49ers|Bears|Rams|Texans|Dolphins|Chiefs|Giants|Buccaneers|Falcons|Seahawks|Browns|Jaguars|Cowboys|Packers|Bills|Lions|Colts|Raiders|Chargers|Ravens|Jets|Panthers|Saints|Titans)$/i);
            if (teamMatch) {
              const fullTeamName = teamMatch[1].toUpperCase().replace(/[^\w]/g, "");
              teamHint = getTeamAbbreviation(fullTeamName);
              console.log(`Extracted team hint: ${fullTeamName} -> ${teamHint}`);
            } else {
              console.log(`Could not extract team from: ${name}`);
            }
          }
          
          if (teamHint) {
            console.log(`Final team hint: ${teamHint}`);
          }
        }

        let matched: SleeperPlayer | null = null;
        
        // Special handling for defenses - match by team abbreviation instead of name
        if (pos === 'dst') {
          if (teamHint) {
            // For defenses, we'll use the team abbreviation as the player_id
            // This matches how Sleeper stores defense players (team abbreviation as ID)
            matched = {
              player_id: teamHint,
              full_name: `${teamHint} Defense`,
              position: 'DEF',
              team: teamHint
            } as SleeperPlayer;
            console.log(`Defense created for team: ${teamHint} -> ${matched.player_id}`);
          } else {
            console.log(`No team hint for defense: ${name}`);
          }
        } else {
          // Regular position matching
          matched = matchPlayer(name, r._pos as FPPos, teamHint, sleeperIndex);
        }
        
        console.log(`Match result for ${name} (${pos}):`, matched ? `Matched to ${matched.player_id}` : 'No match');
        
        if (!matched) {
          console.log(`No match found for ${name} (${pos})`);
          continue;
        }
        
        // For defenses, ensure we create the projection properly
        if (pos === 'dst' && matched) {
          console.log(`Creating defense projection for ${matched.team} (${matched.player_id})`);
        }

        const out: OutRow = {
          source: "fantasypros",
          season: SEASON,
          week: WEEK,
          scoring: SCORING,
          player_id: matched.player_id,
          position: matched.position ?? r._pos.toString().toUpperCase(),
          points: parsePoints(r),
          raw: r,
        };
        
        // Debug logging for defenses
        if (pos === 'dst') {
          console.log(`Defense projection object:`, JSON.stringify(out, null, 2));
        }
        
        // validate shape
        try {
          OutRow.parse(out);
          all.push(out);
          if (pos === 'dst') {
            console.log(`Defense projection validated and added: ${matched.team}`);
          }
        } catch (error) {
          console.error(`Validation failed for ${pos} projection:`, error);
          if (pos === 'dst') {
            console.error(`Defense validation error for ${matched.team}:`, error);
          }
        }
      }
    }

    const payload = { ok: all.length > 0, count: all.length, data: all };
    // print summary
    console.log(`Final array size: ${all.length}`);
    console.log(`Defenses in array: ${all.filter(item => item.position === 'DEF' || item.position === 'DST').length}`);
    console.log(JSON.stringify({ ok: payload.ok, count: payload.count, sample: all.slice(0, 5) }, null, 2));

    // optional POST to Supabase if configured
    const INGEST_URL = process.env.INGEST_URL;
    const INGEST_API_KEY = process.env.INGEST_API_KEY;

            if (payload.ok && INGEST_URL && INGEST_API_KEY) {
          const res = await fetch(INGEST_URL, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "authorization": `Bearer ${INGEST_API_KEY}`,
            },
            body: JSON.stringify({ data: all }),
          });
      if (!res.ok) {
        const text = await res.text();
        console.error("Ingest failed:", res.status, text);
        process.exitCode = 1;
      } else {
        const j = await res.json().catch(() => ({}));
        console.log("Ingest ok:", j);
      }
    }
  } catch (e) {
    console.error("Scrape error:", e);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});