export default async function handler(req, res) {
    if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed' });
    }

  const { base64, mediaType } = req.body;

  if (!base64 || !mediaType) {
        return res.status(400).json({ error: 'Missing base64 or mediaType' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
          return res.status(500).json({ error: 'ANTHROPIC_API_KEY ikke sat i environment variables' });
    }

  const isImage = mediaType.startsWith('image/');
    const contentBlock = isImage
      ? { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } }
          : { type: 'document', source: { type: 'base64', media_type: mediaType, data: base64 } };

  const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
                model: 'claude-opus-4-5',
                max_tokens: 1000,
                messages: [{
                          role: 'user',
                          content: [
                                      contentBlock,
                            {
                                          type: 'text',
                                          text: `Du er en billetlaeder. Analyser denne togbillet omhyggeligt og returner KUN gyldig JSON uden markdown eller forklaring:
                                          {
                                            "fra": "afgangsstation fulde navn",
                                              "til": "destinationsstation fulde navn",
                                                "dato": "DD.MM.YYYY",
                                                  "tidspunkt": "HH:MM",
                                                    "operatoer": "jernbaneselskabets navn (f.eks. DSB, DB, SNCF, Eurostar, NS, OBB, Trenitalia, Renfe)",
                                                      "billetpris": 549,
                                                        "valuta": "DKK",
                                                          "bekraeftet": true
                                                          }
                                                          Hvis du ikke kan finde et felt, saet det til null. Returner altid bekraeftet: true hvis du kan laese billetten.`
                            }
                                    ]
                }]
        })
  });

  if (!response.ok) {
        const err = await response.text();
        return res.status(500).json({ error: 'Anthropic API fejl: ' + err });
  }

  const data = await response.json();
    return res.status(200).json(data);
}
