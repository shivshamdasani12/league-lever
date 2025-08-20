-- Clear all active wagers for the woody league
-- This migration will change the status of all active bets to 'cancelled'

-- First, let's see what leagues exist and find the woody league
-- SELECT id, name FROM leagues WHERE name ILIKE '%woody%';

-- Update all active bets in the woody league to cancelled status
UPDATE bets 
SET 
  status = 'cancelled',
  settled_at = NOW()
WHERE 
  league_id IN (
    SELECT id FROM leagues WHERE name ILIKE '%woody%'
  ) 
  AND status = 'active';

-- Also clear any offered bets that might be problematic
UPDATE bets 
SET 
  status = 'cancelled',
  settled_at = NOW()
WHERE 
  league_id IN (
    SELECT id FROM leagues WHERE name ILIKE '%woody%'
  ) 
  AND status = 'offered';
