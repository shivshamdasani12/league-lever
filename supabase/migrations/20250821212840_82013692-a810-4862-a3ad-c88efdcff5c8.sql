-- Insert sample FantasyPros projections for testing (with unique player_ids)
INSERT INTO projections (source, season, week, scoring, player_id, position, points, raw, updated_at) VALUES 
('fantasypros', 2025, 1, 'PPR', '6904', 'QB', 25.8, '{"player": "Jalen Hurts PHI", "att": "38.0", "cmp": "24.5", "yds": "270.1", "tds": "1.8", "ints": "0.7", "car": "10.5", "rush_yds": "59.4", "rush_tds": "0.4", "fl": "0.2", "fpts": "25.8", "_pos": "qb"}', now()),
('fantasypros', 2025, 1, 'PPR', '6794', 'QB', 24.9, '{"player": "Dak Prescott DAL", "att": "36.0", "cmp": "23.8", "yds": "265.3", "tds": "1.9", "ints": "0.8", "car": "1.8", "rush_yds": "5.2", "rush_tds": "0.1", "fl": "0.2", "fpts": "24.9", "_pos": "qb"}', now()),
('fantasypros', 2025, 1, 'PPR', '11539', 'QB', 23.1, '{"player": "Jayden Daniels WAS", "att": "32.8", "cmp": "21.4", "yds": "245.6", "tds": "1.6", "ints": "0.5", "car": "8.2", "rush_yds": "52.3", "rush_tds": "0.3", "fl": "0.2", "fpts": "23.1", "_pos": "qb"}', now()),
('fantasypros', 2025, 1, 'PPR', '4881', 'RB', 18.5, '{"player": "Josh Jacobs GB", "att": "18.5", "yds": "85.3", "tds": "0.8", "tar": "3.2", "rec": "2.4", "rec_yds": "18.7", "rec_tds": "0.1", "fl": "0.2", "fpts": "18.5", "_pos": "rb"}', now()),
('fantasypros', 2025, 1, 'PPR', '8130', 'WR', 16.8, '{"player": "CeeDee Lamb DAL", "tar": "9.8", "rec": "6.2", "rec_yds": "88.4", "rec_tds": "0.7", "car": "0.1", "rush_yds": "0.8", "rush_tds": "0.0", "fl": "0.1", "fpts": "16.8", "_pos": "wr"}', now()),
('fantasypros', 2025, 1, 'PPR', '12527', 'WR', 15.2, '{"player": "Malik Nabers NYG", "tar": "8.9", "rec": "5.8", "rec_yds": "79.2", "rec_tds": "0.6", "car": "0.0", "rush_yds": "0.0", "rush_tds": "0.0", "fl": "0.1", "fpts": "15.2", "_pos": "wr"}', now()),
('fantasypros', 2025, 1, 'PPR', '5927', 'TE', 11.4, '{"player": "Zach Ertz WAS", "tar": "6.8", "rec": "4.5", "rec_yds": "48.9", "rec_tds": "0.4", "car": "0.0", "rush_yds": "0.0", "rush_tds": "0.0", "fl": "0.1", "fpts": "11.4", "_pos": "te"}', now()),
('fantasypros', 2025, 1, 'PPR', 'WAS', 'DEF', 8.2, '{"player": "Washington Commanders", "sacks": "2.1", "ints": "0.8", "fum_rec": "0.6", "def_tds": "0.1", "safety": "0.0", "pa": "18.5", "fpts": "8.2", "_pos": "def"}', now()),
('fantasypros', 2025, 1, 'PPR', '9493', 'RB', 12.8, '{"player": "Rico Dowdle DAL", "att": "14.2", "yds": "62.8", "tds": "0.5", "tar": "2.8", "rec": "2.1", "rec_yds": "16.4", "rec_tds": "0.1", "fl": "0.2", "fpts": "12.8", "_pos": "rb"}', now()),
('fantasypros', 2025, 1, 'PPR', '9226', 'WR', 9.8, '{"player": "Jalen Tolbert DAL", "tar": "5.2", "rec": "3.1", "rec_yds": "42.8", "rec_tds": "0.3", "car": "0.0", "rush_yds": "0.0", "rush_tds": "0.0", "fl": "0.1", "fpts": "9.8", "_pos": "wr"}', now())
ON CONFLICT (source, season, week, scoring, player_id) DO UPDATE SET
  points = EXCLUDED.points,
  raw = EXCLUDED.raw,
  updated_at = EXCLUDED.updated_at;