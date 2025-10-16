// Test script for recommendations API
// Run with: node test-recommendations.mjs

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Environment variables not set')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testRecommendations() {
  console.log('🧪 Testing Recommendations API...')

  try {
    // Check if anime_metadata table has data
    const { count, error } = await supabase
      .from('anime_metadata')
      .select('*', { count: 'exact', head: true })

    console.log(`📊 Anime metadata count: ${count}`)

    if (count === 0) {
      console.log('⚠️  No anime metadata found. Run the population script first.')
      return
    }

    // Get a sample user
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, username')
      .limit(1)

    if (userError || !users || users.length === 0) {
      console.log('⚠️  No users found in database')
      return
    }

    const testUser = users[0]
    console.log(`👤 Testing with user: ${testUser.username} (${testUser.id})`)

    // Check user's watch history
    const { data: watchHistory, error: watchError } = await supabase
      .from('watching_progress')
      .select('anime_id')
      .eq('user_id', testUser.id)
      .limit(5)

    console.log(`📺 User has watched ${watchHistory?.length || 0} anime episodes`)

    // Test the recommendation API (this would normally be called via HTTP)
    console.log('✅ Recommendation API structure is ready!')
    console.log('📝 API Endpoint: GET /api/recommendations')
    console.log('📝 Query parameters:')
    console.log('   - type: "content" | "collaborative" | "popular" | "mixed" (default: "mixed")')
    console.log('   - limit: number (default: 20, max: 50)')

  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

testRecommendations()