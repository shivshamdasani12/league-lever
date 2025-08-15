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
    if (!p?.full_name || !p?.position) continue;
    const sp: SleeperPlayer = { ...p, player_id: id };
    const pos = String(p.position).toUpperCase();
    if (!byPos[pos]) byPos[pos] = [];
    byPos[pos].push(sp);
  }
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
  for (const c of candidates) {
    const score = compareTwoStrings(target, normalizeName(c.full_name ?? ""));
    const teamBoost = teamHint && c.team && teamHint === c.team ? 0.05 : 0;
    const total = score + teamBoost;
    if (total > bestScore) {
      best = c;
      bestScore = total;
    }
  }
  return bestScore >= 0.6 ? best : null; // threshold
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
    const out = [];
    
    for (const tr of bodyRows) {
      const tds = Array.from(tr.querySelectorAll("td"));
      const row = {};
      
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
      const rows = await limit(() => scrapePosition(browser, pos));
      await sleep(600); // small delay between positions

      for (const r of rows as any[]) {
        const name = parsePlayerName(r);
        if (!name) continue;
        const teamHint =
          (r["_team_hint"] ?? "").toString().toUpperCase().replace(/[^\w]/g, "") || undefined;

        const matched = matchPlayer(name, r._pos as FPPos, teamHint, sleeperIndex);
        if (!matched) continue;

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
        // validate shape
        OutRow.parse(out);
        all.push(out);
      }
    }

    const payload = { ok: all.length > 0, count: all.length, data: all };
    // print summary
    console.log(JSON.stringify({ ok: payload.ok, count: payload.count, sample: all.slice(0, 5) }, null, 2));

    // optional POST to Supabase if configured
    const INGEST_URL = process.env.INGEST_URL;
    const INGEST_API_KEY = process.env.INGEST_API_KEY;

    if (payload.ok && INGEST_URL && INGEST_API_KEY) {
      const res = await fetch(INGEST_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Authorization": `Bearer ${INGEST_API_KEY}`,
          "apikey": INGEST_API_KEY,
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
