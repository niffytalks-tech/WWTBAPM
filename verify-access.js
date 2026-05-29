// netlify/functions/verify-access.js
// ─────────────────────────────────────────────────────────────
// This function runs on Netlify's servers (not in the browser),
// so CORS is not an issue and the API key stays hidden in
// Netlify environment variables — never exposed in your HTML.
//
// Set these in: Netlify dashboard → Site → Environment variables
//   WHOP_API_KEY      → your Whop read-only API key
//   WHOP_PRODUCT_ID   → your Whop product ID (e.g. prod_xxxxxxxx)
// ─────────────────────────────────────────────────────────────

exports.handler = async (event) => {

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const email = event.queryStringParameters?.email?.trim().toLowerCase();

  // Validate email was provided
  if (!email || !email.includes('@')) {
    return {
      statusCode: 400,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'Valid email required' })
    };
  }

  // Check env vars are configured
  const apiKey     = process.env.WHOP_API_KEY;
  const productId  = process.env.WHOP_PRODUCT_ID;

  if (!apiKey || !productId) {
    console.error('Missing WHOP_API_KEY or WHOP_PRODUCT_ID environment variables');
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'Server not configured. Contact support.' })
    };
  }

  try {
    const url =
      `https://api.whop.com/api/v2/memberships` +
      `?email=${encodeURIComponent(email)}` +
      `&product_id=${encodeURIComponent(productId)}` +
      `&status=active`;

    const whopResponse = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (whopResponse.status === 401) {
      console.error('Whop API key rejected (401)');
      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ granted: false, error: 'api_auth' })
      };
    }

    if (!whopResponse.ok) {
      console.error(`Whop API error: ${whopResponse.status}`);
      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ granted: false, error: 'api_error', status: whopResponse.status })
      };
    }

    const data = await whopResponse.json();

    // Grant access if at least one active membership found for this email + product
    const granted = Array.isArray(data.data) && data.data.length > 0;

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ granted })
    };

  } catch (err) {
    console.error('verify-access function error:', err);
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
