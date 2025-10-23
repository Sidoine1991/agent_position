#!/usr/bin/env node

/**
 * Script to backfill GPS coordinates for existing missions
 * This script extracts start and end GPS coordinates from checkins and updates the missions table
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);

async function backfillMissionGPS() {
  try {
    console.log('🔄 Starting GPS coordinates backfill for missions...');
    
    // 1. Get all missions that don't have GPS coordinates
    const { data: missions, error: missionsError } = await supabaseClient
      .from('missions')
      .select('id, agent_id, date_start, date_end, status')
      .or('start_lat.is.null,start_lon.is.null,end_lat.is.null,end_lon.is.null');
    
    if (missionsError) {
      throw missionsError;
    }
    
    console.log(`📊 Found ${missions?.length || 0} missions to process`);
    
    if (!missions || missions.length === 0) {
      console.log('✅ No missions need GPS backfill');
      return;
    }
    
    let processed = 0;
    let updated = 0;
    let errors = 0;
    
    // 2. Process each mission
    for (const mission of missions) {
      try {
        console.log(`\n🔍 Processing mission ${mission.id}...`);
        
        // Get checkins for this mission, ordered by timestamp
        const { data: checkins, error: checkinsError } = await supabaseClient
          .from('checkins')
          .select('lat, lon, timestamp')
          .eq('mission_id', mission.id)
          .order('timestamp', { ascending: true });
        
        if (checkinsError) {
          console.warn(`⚠️  Error fetching checkins for mission ${mission.id}:`, checkinsError.message);
          errors++;
          continue;
        }
        
        if (!checkins || checkins.length === 0) {
          console.log(`⚠️  No checkins found for mission ${mission.id}`);
          processed++;
          continue;
        }
        
        // Extract start and end coordinates
        const startCheckin = checkins[0];
        const endCheckin = checkins[checkins.length - 1];
        
        const startLat = startCheckin?.lat;
        const startLon = startCheckin?.lon;
        const endLat = endCheckin?.lat;
        const endLon = endCheckin?.lon;
        
        // Only update if we have valid coordinates
        const hasStartCoords = Number.isFinite(startLat) && Number.isFinite(startLon);
        const hasEndCoords = Number.isFinite(endLat) && Number.isFinite(endLon);
        
        if (!hasStartCoords && !hasEndCoords) {
          console.log(`⚠️  No valid GPS coordinates found for mission ${mission.id}`);
          processed++;
          continue;
        }
        
        // Prepare update data
        const updateData = {};
        if (hasStartCoords) {
          updateData.start_lat = startLat;
          updateData.start_lon = startLon;
        }
        if (hasEndCoords) {
          updateData.end_lat = endLat;
          updateData.end_lon = endLon;
        }
        
        // Update the mission
        const { error: updateError } = await supabaseClient
          .from('missions')
          .update(updateData)
          .eq('id', mission.id);
        
        if (updateError) {
          console.warn(`⚠️  Error updating mission ${mission.id}:`, updateError.message);
          errors++;
        } else {
          console.log(`✅ Updated mission ${mission.id}:`, {
            start: hasStartCoords ? `${startLat}, ${startLon}` : 'N/A',
            end: hasEndCoords ? `${endLat}, ${endLon}` : 'N/A'
          });
          updated++;
        }
        
        processed++;
        
      } catch (error) {
        console.error(`❌ Error processing mission ${mission.id}:`, error.message);
        errors++;
        processed++;
      }
    }
    
    // 3. Summary
    console.log('\n📈 Backfill Summary:');
    console.log(`   Total missions processed: ${processed}`);
    console.log(`   Successfully updated: ${updated}`);
    console.log(`   Errors: ${errors}`);
    
    if (errors === 0) {
      console.log('✅ GPS coordinates backfill completed successfully!');
    } else {
      console.log('⚠️  Backfill completed with some errors. Check the logs above.');
    }
    
  } catch (error) {
    console.error('❌ Fatal error during backfill:', error);
    process.exit(1);
  }
}

// Run the backfill
if (require.main === module) {
  backfillMissionGPS()
    .then(() => {
      console.log('🎉 Backfill script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Backfill script failed:', error);
      process.exit(1);
    });
}

module.exports = { backfillMissionGPS };
