export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { query, count, regionCode, apiKey } = req.query;

  if (!apiKey || !query) {
    return res.status(400).json({ error: 'Missing apiKey or query' });
  }

  try {
    // Search for channels
    const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
    searchUrl.searchParams.append('q', query);
    searchUrl.searchParams.append('type', 'channel');
    searchUrl.searchParams.append('part', 'snippet');
    searchUrl.searchParams.append('maxResults', Math.min(count || 50, 50));
    searchUrl.searchParams.append('order', 'relevance');
    searchUrl.searchParams.append('key', apiKey);

    if (regionCode && regionCode !== 'Global') {
      searchUrl.searchParams.append('regionCode', regionCode);
    }

    const searchResponse = await fetch(searchUrl.toString());
    const searchData = await searchResponse.json();

    if (!searchResponse.ok || !searchData.items) {
      return res.status(400).json({ 
        error: searchData.error?.message || 'No channels found' 
      });
    }

    const channelIds = searchData.items.map(item => item.id.channelId).join(',');

    // Get channel details
    const channelsUrl = new URL('https://www.googleapis.com/youtube/v3/channels');
    channelsUrl.searchParams.append('id', channelIds);
    channelsUrl.searchParams.append('part', 'snippet,statistics');
    channelsUrl.searchParams.append('key', apiKey);

    const channelsResponse = await fetch(channelsUrl.toString());
    const channelsData = await channelsResponse.json();

    if (!channelsResponse.ok || !channelsData.items) {
      return res.status(400).json({ error: 'Failed to fetch channel details' });
    }

    // Format results
    const channels = channelsData.items.map((item, index) => ({
      rank: index + 1,
      name: item.snippet.title,
      subscribers: formatCount(item.statistics.subscriberCount),
      handle: item.snippet.customUrl || `@${item.snippet.title.replace(/\s+/g, '')}`,
      link: `https://www.youtube.com/${item.snippet.customUrl || `channel/${item.id}`}`,
      viewCount: formatCount(item.statistics.viewCount),
      videoCount: item.statistics.videoCount
    }));

    res.status(200).json({ channels, total: channels.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

function formatCount(count) {
  if (!count || count === 'hidden') return 'Hidden';
  const num = parseInt(count);
  if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}
