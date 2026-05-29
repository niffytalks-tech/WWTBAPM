// netlify/functions/verify-access.js
// ─────────────────────────────────────────────────────────────
// Netlify env vars required:
//   WHOP_API_KEY     → Company API key (member:basic:read + member:email:read)
//   WHOP_PRODUCT_ID  → Your product ID (prod_xxxxxxxx)
//   WHOP_COMPANY_ID  → Your company ID (biz_xxxxxxxx) — found in Whop Settings
// ─────────────────────────────────────────────────────────────

exports.handler = async (event) => {

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const email     = event.queryStringParameters?.email?.trim().toLowerCase();
  const apiKey    = process.env.WHOP_API_KEY;
  const productId = process.env.WHOP_PRODUCT_ID;
  const companyId = process.env.WHOP_COMPANY_ID;

  if (!email || !email.includes('@')) {
    return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: 'Valid email required' }) };
  }

  if (!apiKey || !productId || !companyId) {
    console.error('Missing env vars — need WHOP_API_KEY, WHOP_PRODUCT_ID, WHOP_COMPANY_ID');
    return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: 'Server not configured.' }) };
  }

  const reqHeaders = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  };

  try {
    console.log(`Checking membership for: ${email}`);
    console.log(`Product ID: ${productId} | Company ID: ${companyId}`);

    const url =
      `https://api.whop.com/api/v1/members` +
      `?company_id=${encodeURIComponent(companyId)}` +
      `&query=${encodeURIComponent(email)}` +
      `&product_ids[]=${encodeURIComponent(productId)}` +
      `&statuses[]=joined` +
      `&first=5`;

    const response = await fetch(url, { headers: reqHeaders });
    const data = await response.json();

    console.log(`Whop API status: ${response.status}`);
    console.log(`Raw response: ${JSON.stringify(data)}`);

    if (response.status === 401) {
      console.error('API key rejected — must be a Company API key');
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

    const members = Array.isArray(data.data) ? data.data : [];
    console.log(`Members returned: ${members.length}`);

    // Exact email match guards against name/username false positives
    const granted = members.some(m => m.user?.email?.toLowerCase() === email);
    console.log(`Access granted: ${granted}`);

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
