// netlify/functions/verify-access.js
// ─────────────────────────────────────────────────────────────
// Proxies the Whop API call server-side — keeps API key hidden.
//
// Set these in Netlify → Site → Environment variables:
//   WHOP_API_KEY      → Company API key (needs member:basic:read
//                       and member:email:read permissions)
//   WHOP_PRODUCT_ID   → your product ID (e.g. prod_xxxxxxxx)
// ─────────────────────────────────────────────────────────────

exports.handler = async (event) => {

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const email = event.queryStringParameters?.email?.trim().toLowerCase();

  if (!email || !email.includes('@')) {
    return {
      statusCode: 400,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'Valid email required' })
    };
  }

  const apiKey    = process.env.WHOP_API_KEY;
  const productId = process.env.WHOP_PRODUCT_ID;

  if (!apiKey || !productId) {
    console.error('Missing WHOP_API_KEY or WHOP_PRODUCT_ID env vars');
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'Server not configured. Contact support.' })
    };
  }

  try {
    // Step 1 — search members by email using the current v1 API
    // 'query' searches name, username, and email (requires member:email:read)
    const searchUrl =
      `https://api.whop.com/api/v1/members` +
      `?query=${encodeURIComponent(email)}` +
      `&product_ids[]=${encodeURIComponent(productId)}` +
      `&statuses[]=joined` +
      `&first=5`;

    console.log(`Checking membership for: ${email}`);

    const whopResponse = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    // Log the raw status for debugging
    console.log(`Whop API status: ${whopResponse.status}`);

    if (whopResponse.status === 401) {
      console.error('Whop API key rejected (401) — check key type and permissions');
      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ granted: false, error: 'api_auth' })
      };
    }

    if (whopResponse.status === 403) {
      console.error('Whop API key missing permissions (403) — needs member:basic:read and member:email:read');
      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ granted: false, error: 'api_permissions' })
      };
    }

    if (!whopResponse.ok) {
      const body = await whopResponse.text();
      console.error(`Whop API error ${whopResponse.status}: ${body}`);
      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ granted: false, error: 'api_error', status: whopResponse.status })
      };
    }

    const data = await whopResponse.json();
    console.log(`Members returned: ${data.data?.length ?? 0}`);

    // Step 2 — confirm the returned member's email matches exactly
    // (query also matches on name/username so we need to verify)
    const members = Array.isArray(data.data) ? data.data : [];
    const matched = members.some(
      member => member.user?.email?.toLowerCase() === email
    );

    console.log(`Email match found: ${matched}`);

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ granted: matched })
    };

  } catch (err) {
    console.error('verify-access error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'Unexpected server error' })
    };
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
}
