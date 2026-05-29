// netlify/functions/verify-access.js
// ─────────────────────────────────────────────────────────────
// Netlify env vars required:
//   WHOP_API_KEY     → Company API key
//   WHOP_PRODUCT_ID  → prod_GNtlnh2luyD90
//   WHOP_COMPANY_ID  → biz_ZcQ2AI3jxVWbvE
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

  try {
    console.log(`Checking membership for: ${email}`);

    const url =
      `https://api.whop.com/api/v1/members` +
      `?company_id=${encodeURIComponent(companyId)}` +
      `&product_ids[]=${encodeURIComponent(productId)}` +
      `&query=${encodeURIComponent(email)}` +
      `&statuses[]=joined` +
      `&first=5`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    console.log(`Status: ${response.status} | Members returned: ${data.data?.length ?? 0}`);

    if (!response.ok) {
      console.error(`Whop API error: ${JSON.stringify(data)}`);
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ granted: false, error: 'api_error' }) };
    }

    const members = Array.isArray(data.data) ? data.data : [];
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
