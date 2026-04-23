export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://soul-fire-elements-2.myshopify.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Get access token using client credentials
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
      return res.status(500).json({ success: false, error: 'Failed to get access token' });
    }

    const { customerId, metafields } = req.body;

    if (!customerId || !metafields) {
      return res.status(400).json({ success: false, error: 'Missing customerId or metafields' });
    }

    const customerGid = `gid://shopify/Customer/${customerId}`;

    const metafieldsInput = metafields.map(({ key, value }) => ({
      ownerId: customerGid,
      namespace: 'custom',
      key,
      value: JSON.stringify(value),
      type: 'list.single_line_text_field'
    }));

    const query = `
      mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields { key value }
          userErrors { field message }
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
        body: JSON.stringify({ query, variables: { metafields: metafieldsInput } })
      }
    );

    const data = await response.json();
    const errors = data?.data?.metafieldsSet?.userErrors;

    if (errors?.length > 0) {
      return res.status(500).json({ success: false, error: errors[0].message });
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
