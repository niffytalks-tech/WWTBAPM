// netlify/functions/verify-access.js — DEBUG VERSION
// Replace with production version once membership lookup is confirmed working

exports.handler = async (event) => {

  const apiKey    = process.env.WHOP_API_KEY;
  const productId = process.env.WHOP_PRODUCT_ID;
  const companyId = process.env.WHOP_COMPANY_ID;

  const reqHeaders = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  };

  const results = {};

  // TEST A — bare call, no filters, just "can we get any members at all?"
  const rA = await fetch(
    `https://api.whop.com/api/v1/members?company_id=${encodeURIComponent(companyId)}&first=3`,
    { headers: reqHeaders }
  );
  const dA = await rA.json();
  results.testA_no_filters = {
    status: rA.status,
    member_count: dA.data?.length ?? 'no data key',
    members: dA.data?.map(m => ({ id: m.id, status: m.status, email: m.user?.email })) ?? dA
  };

  // TEST B — with product_id filter only (no email query)
  const rB = await fetch(
    `https://api.whop.com/api/v1/members?company_id=${encodeURIComponent(companyId)}&product_ids[]=${encodeURIComponent(productId)}&first=3`,
    { headers: reqHeaders }
  );
  const dB = await rB.json();
  results.testB_product_filter = {
    status: rB.status,
    member_count: dB.data?.length ?? 'no data key',
    members: dB.data?.map(m => ({ id: m.id, status: m.status, email: m.user?.email })) ?? dB
  };

  // TEST C — with email query only (no product filter)
  const email = event.queryStringParameters?.email?.trim().toLowerCase() || '';
  const rC = await fetch(
    `https://api.whop.com/api/v1/members?company_id=${encodeURIComponent(companyId)}&query=${encodeURIComponent(email)}&first=3`,
    { headers: reqHeaders }
  );
  const dC = await rC.json();
  results.testC_email_query = {
    status: rC.status,
    email_searched: email,
    member_count: dC.data?.length ?? 'no data key',
    members: dC.data?.map(m => ({ id: m.id, status: m.status, email: m.user?.email })) ?? dC
  };

  console.log('DEBUG RESULTS:', JSON.stringify(results, null, 2));

  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(results, null, 2)
  };
};
