#!/bin/bash

export INGEST_URL="https://dcqxqetlbgtaceyospij.supabase.co/functions/v1/ingest-projections"
export INGEST_API_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjcXhxZXRsYmd0YWNleW9zcGlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3NzYzNjcsImV4cCI6MjA3MDM1MjM2N30.jaXUVmROotCjxJoMtO8aZL5iutjWxvTjspXK1DSJfso"

echo "Environment variables set:"
echo "INGEST_URL: $INGEST_URL"
echo "INGEST_API_KEY: ${INGEST_API_KEY:0:20}..."

npm run scrape:projections -- --season 2025 --week 1 --scoring PPR


