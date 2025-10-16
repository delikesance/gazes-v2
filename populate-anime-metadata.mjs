import { createClient } from '@supabase/supabase-js'
import axios from 'axios';
import https from 'https';
import { parseCataloguePage, parseAnimePage } from './populate-parsers.js';

const axiosInstance = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false
  })
});

const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15"

async function populateAnimeMetadata() {
  // Get Supabase credentials from environment
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ SUPABASE_URL or SUPABASE_KEY environment variables not found');
    console.log('Please set SUPABASE_URL and SUPABASE_KEY in your .env file');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('🚀 Connecting to Supabase...');

    // Check if anime_metadata table exists by trying to query it
    const { error: tableError } = await supabase
      .from('anime_metadata')
      .select('id', { count: 'exact', head: true })
      .limit(1);

    if (tableError && tableError.code !== 'PGRST116') { // PGRST116 is "not found" which is OK for empty table
      console.error('❌ anime_metadata table does not exist. Please run migrations first.');
      console.error('Error:', tableError);
      process.exit(1);
    }

    console.log('📊 Starting anime metadata population...');

    // Get catalogue base URL from environment or default
    const catalogueApiUrl = process.env.CATALOGUE_API_URL || 'https://179.43.149.218';

    let page = 1;
    let totalProcessed = 0;
    let hasMorePages = true;

    while (hasMorePages && page <= 100) { // Safety limit of 100 pages
      console.log(`📄 Fetching catalogue page ${page}...`);

      try {
        // Build URL for this page
        const url = new URL(`${catalogueApiUrl}/catalogue/`);
        url.searchParams.set('page', page.toString());

        const response = await axiosInstance.get(url.toString(), {
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
            'User-Agent': USER_AGENT,
            'Referer': `${catalogueApiUrl}/catalogue/`,
            'Upgrade-Insecure-Requests': '1'
          },
          timeout: 30000
        });

        const html = response.data;
        const items = parseCataloguePage(html);

        console.log(`📄 Page ${page}: Found ${items.length} anime`);

        if (items.length === 0) {
          console.log(`📄 No more items on page ${page}, stopping...`);
          hasMorePages = false;
          break;
        }

        // Process each anime on this page
        for (const item of items) {
          try {
            console.log(`🎬 Processing anime: ${item.title} (${item.id})`);

            // Check if we already have this anime in the database
            const { data: existing, error: checkError } = await supabase
              .from('anime_metadata')
              .select('id')
              .eq('id', item.id)
              .single();

            if (existing) {
              console.log(`⏭️  Skipping ${item.id} - already exists`);
              continue;
            }

            // Fetch detailed anime data
            const animeData = await fetchAnimeDetails(item.id, catalogueApiUrl);

            if (!animeData) {
              console.log(`⚠️  Failed to fetch details for ${item.id}`);
              continue;
            }

            // Insert into database
            const { error: insertError } = await supabase
              .from('anime_metadata')
              .upsert({
                id: item.id,
                title: animeData.title || item.title,
                cover: animeData.cover || item.image,
                banner: animeData.banner,
                synopsis: animeData.synopsis,
                genres: animeData.genres || [],
                total_episodes: null, // We'll calculate this later
                seasons_data: animeData.seasons || [],
                language_flags: animeData.languageFlags || {},
                last_updated: new Date().toISOString(),
                created_at: new Date().toISOString()
              });

            if (insertError) {
              console.error(`❌ Error inserting ${item.id}:`, insertError);
              continue;
            }

            totalProcessed++;
            console.log(`✅ Processed ${item.id} (${totalProcessed} total)`);

            // Small delay to be respectful to the external API
            await new Promise(resolve => setTimeout(resolve, 500));

          } catch (error) {
            console.error(`❌ Error processing ${item.id}:`, error.message);
            continue;
          }
        }

        page++;

        // Small delay between pages
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`❌ Error fetching page ${page}:`, error.message);
        hasMorePages = false;
        break;
      }
    }

    console.log(`✅ Anime metadata population completed! Processed ${totalProcessed} anime.`);

  } catch (error) {
    console.error('❌ Population failed:', error.message);
    process.exit(1);
  }
}

async function fetchAnimeDetails(animeId, catalogueApiUrl) {
  try {
    // Try to fetch directly first
    let response = await axiosInstance.get(`${catalogueApiUrl}/catalogue/${animeId}/`, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': USER_AGENT,
      },
      timeout: 15000
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = response.data;
    const animeData = parseAnimePage(html);

    // Scrape language flags from the first available season
    if (animeData.seasons && animeData.seasons.length > 0) {
      const firstSeason = animeData.seasons[0];
      if (firstSeason?.url) {
        let seasonUrl = firstSeason.url;

        if (seasonUrl.startsWith('/')) {
          seasonUrl = `${catalogueApiUrl}/catalogue${seasonUrl}`;
        } else if (!seasonUrl.startsWith('http')) {
          seasonUrl = `${catalogueApiUrl}/catalogue/${animeId}/${seasonUrl}`;
        }

        try {
          const seasonResponse = await axiosInstance.get(seasonUrl, {
            headers: {
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'User-Agent': USER_AGENT,
            },
            timeout: 5000
          });

          if (seasonResponse.status >= 200 && seasonResponse.status < 300) {
            const seasonHtml = seasonResponse.data;
            const languageFlags = parseLanguageFlags(seasonHtml);
            return { ...animeData, languageFlags };
          }
        } catch (error) {
          // Silent fail for language flags
        }
      }
    }

    return animeData;

  } catch (error) {
    console.error(`Failed to fetch anime details for ${animeId}:`, error.message);
    return null;
  }
}

// Function to parse language flags from season page HTML
function parseLanguageFlags(html) {
  const flags = {};

  // Simplified flag mapping for common anime languages
  const flagToEmoji = {
    'cn': '🇨🇳',
    'jp': '🇯🇵',
    'kr': '🇰🇷',
    'fr': '🇫🇷',
    'en': '🇺🇸',
    'us': '🇺🇸',
    'qc': '🇨🇦',
    'ar': '🇸🇦',
    'x': '🇯🇵', // Original version
  };

  // Extract language buttons
  const buttonRegex = /<a\s+href="\.\.\/([^"]+)"[^>]*id="switch[^"]*"[^>]*>[\s\S]*?<img[^>]*src="[^"]*flag_([^"\.]+)\.png"[^>]*>[\s\S]*?<\/a>/gi;
  let match;

  while ((match = buttonRegex.exec(html)) !== null) {
    const langCode = match[1];
    const flagCode = match[2]?.toLowerCase();
    const emoji = flagCode ? (flagToEmoji[flagCode] || '🏳️') : '🏳️';

    if (langCode && flagCode) {
      flags[langCode] = emoji;
    }
  }

  return flags;
}

populateAnimeMetadata();