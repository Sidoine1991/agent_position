# Migration GPS Coordinates for Missions

## Overview
This migration adds GPS coordinate storage to the `missions` table to fix the empty GPS coordinates display in the mission history.

## Files Created/Modified

### 1. Database Migration
- **File**: `database/add_mission_gps_columns.sql`
- **Purpose**: Adds GPS coordinate columns to the missions table
- **Action**: Execute this SQL script in your Supabase SQL editor

### 2. Backend Updates
- **File**: `server.js` (lines ~3641-3642, ~3825-3826)
- **Changes**: 
  - Start mission now saves `start_lat` and `start_lon`
  - End mission now saves `end_lat` and `end_lon`

- **File**: `www/routes-modern.js` (lines ~381-385, ~449-453)
- **Changes**: 
  - PostgreSQL routes updated to include GPS coordinates
  - Start mission saves GPS coordinates
  - End mission saves GPS coordinates

### 3. Backfill Script
- **File**: `scripts/backfill_mission_gps.js`
- **Purpose**: Populates GPS coordinates for existing missions from their checkins
- **Usage**: `node scripts/backfill_mission_gps.js`

## Migration Steps

### Step 1: Database Schema Update
1. Open your Supabase dashboard
2. Go to SQL Editor
3. Execute the contents of `database/add_mission_gps_columns.sql`

### Step 2: Deploy Backend Changes
1. Deploy the updated `server.js` and `www/routes-modern.js` files
2. The new GPS coordinates will be saved for all new missions

### Step 3: Backfill Existing Missions (Optional)
1. Run the backfill script: `node scripts/backfill_mission_gps.js`
2. This will populate GPS coordinates for existing missions using their first and last checkins

## Verification

After migration, check that:
1. New missions show GPS coordinates in the mission history
2. Existing missions (after backfill) show GPS coordinates
3. The mission history display shows coordinates instead of "-"

## Notes

- The frontend code in `www/app.js` line 1604 already expects these fields
- No frontend changes are required
- GPS coordinates are stored as DECIMAL(10,8) for latitude and DECIMAL(11,8) for longitude
- The backfill script is safe to run multiple times (it only updates missions that need GPS coordinates)
