-- Fix the database constraint issue with the players table
-- The issue is that the 'name' column has a NOT NULL constraint but some player inserts are trying to insert NULL values

-- First, let's make the 'name' column nullable to prevent the constraint error
ALTER TABLE players ALTER COLUMN name DROP NOT NULL;