// netlify/functions/verify-access.js
// ─────────────────────────────────────────────────────────────
// Verifies a Whop purchase by checking the company's member list.
// Uses the /v1/company/members endpoint — works with a Product ID.
//
// Netlify env vars required:
//   WHOP_API_KEY     → Company API key (member:basic:read + member:email:read)
//   WHOP_PRODUCT_ID  → Your product ID (prod_xxxxxxxx)
// ─────────────────────────────────────────────────────────────

exports.handler = async (event) => {

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const email     = event.queryStringParameters?.email?.trim().toLowerCase();
  const apiKey    = process.env.WHOP_API_KEY;
  const productId = process.env.WHOP_PRODUCT_ID;

  if (!email || !email.includes('@')) {
    return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: 'Valid email required' }) };
  }

  if (!apiKey || !productId) {
    console.error('Missing env vars');
    return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: 'Server not configured.' }) };
  }

  const reqHeaders = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  };

  try {
    console.log(`Checking membership for: ${email} on product: ${productId}`);

    // Company-scoped endpoint — works with a Product ID (not an App ID)
    const url =
      `https://api.whop.com/api/v1/company/members` +
      `?query=${encodeURIComponent(email)}` +
      `&product_ids[]=${encodeURIComponent(productId)}` +
      `&statuses[]=joined` +
      `&first=5`;

    const response = await fetch(url, { headers: reqHeaders });
    const data = await response.json();

    console.log(`Status: ${response.status}`);
    console.log(`Members returned: ${data.data?.length ?? 'no data key'}`);
    console.log(`Raw response: ${JSON.stringify(data)}`);

    if (response.status === 401) {
      console.error('API key rejected — check key is a Company API key');
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ granted: false, error: 'api_auth' }) };
    }

    if (response.status === 403) {
      console.error('Missing permissions — needs member:basic:read and member:email:read');
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ granted: false, error: 'api_permissions' }) };
    }

    if (!response.ok) {
      console.error(`API error ${response.status}: ${JSON.stringify(data)}`);
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ granted: false, error: 'api_error' }) };
    }

    // Exact email match to prevent false positives on name/username matches
    const members = Array.isArray(data.data) ? data.data : [];
    const granted = members.some(m => m.user?.email?.toLowerCase() === email);

    console.log(`Email match found: ${granted}`);

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ granted })
    };

  } catch (err) {
    console.error('verify-access error:', err);
    return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: 'Unexpected server error' }) };
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
}
