export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { customerId } = req.query;
  if (!customerId) return res.status(400).json({ error: 'Missing customerId' });

  try {
    const tokenResponse = await fetch(
      `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/oauth/access_token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: process.env.SHOPIFY_CLIENT_ID,
          client_secret: process.env.SHOPIFY_CLIENT_SECRET,
          grant_type: 'client_credentials'
        })
      }
    );

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return res.status(500).json({ error: 'Failed to get access token' });
    }

    const gid = `gid://shopify/Customer/${customerId}`;
    const query = `
      query GetCustomerData($id: ID!) {
        customer(id: $id) {
          tags
          metafields(first: 20, namespace: "custom") {
            edges { node { key value } }
          }
        }
      }
    `;

    const response = await fetch(
      `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2025-01/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken
        },
        body: JSON.stringify({ query, variables: { id: gid } })
      }
    );

    const data = await response.json();
    const customer = data?.data?.customer;
    const isSubscriber = customer?.tags?.includes('candle-box-subscriber') ?? false;
    const metafields = customer?.metafields?.edges?.map(e => e.node) || [];

    return res.status(200).json({ isSubscriber, metafields });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
