#!/usr/bin/env node

// Set environment variables
process.env.INGEST_URL = "https://dcqxqetlbgtaceyospij.supabase.co/functions/v1/ingest-projections";
process.env.INGEST_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjcXhxZXRsYmd0YWNleW9zcGlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3NzYzNjcsImV4cCI6MjA3MDM1MjM2N30.jaXUVmROotCjxJoMtO8aZL5iutjWxvTjspXK1DSJfso";

console.log("Environment variables set:");
console.log("INGEST_URL:", process.env.INGEST_URL);
console.log("INGEST_API_KEY:", process.env.INGEST_API_KEY.substring(0, 20) + "...");

// Import and run the scraping script
import('./scrape-fantasypros.js').then(async (module) => {
  try {
    await module.main();
  } catch (error) {
    console.error("Error running scraping script:", error);
    process.exit(1);
  }
}).catch(error => {
  console.error("Error importing scraping script:", error);
  process.exit(1);
});

