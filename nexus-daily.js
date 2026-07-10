const https = require('https');
const fs = require('fs');

const FUENTES = [
  'https://www.infobae.com/tecno/',
  'https://www.lanacion.com.ar/tecnologia/',
  'https://inteligenciaargentina.ar/',
  'https://www.redusers.com/noticias/',
  'https://keepcoding.io/blog/',
  'https://es.investing.com/news/technology-news'
];

function fetchUrl(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
    }).on('error', () => resolve(''));
  });
}

function llamarClaude(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const texto = (json.content || []).map((b) => b.text || '').join('');
          resolve(texto);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const hoy = new Date().toISOString().slice(0, 10);

  let crudo = '';
  for (const url of FUENTES) {
    const html = await fetchUrl(url);
    crudo +=  `Fuente: ${url}\n${html.slice(0, 500)}\n\n`;
  }

  const prompt = Sos NEXUS Daily. A partir de este contenido crudo de sitios de tecnología en español, extraé los titulares o temas principales y armá un resumen ejecutivo breve (máximo 10 líneas), en español rioplatense, sin relleno:\n\n${crudo};

  const resumen = await llamarClaude(prompt);

  if (!fs.existsSync('nexus-daily-output')) {
    fs.mkdirSync('nexus-daily-output');
  }

  fs.writeFileSync(
    nexus-daily-output/${hoy}.json,
    JSON.stringify({ fecha: hoy, resumen }, null, 2)
  );

  fs.writeFileSync(
    'nexus-daily-output/latest.md',
    # NEXUS Daily — ${hoy}\n\n${resumen}\n
  );

  console.log('Listo:', hoy);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
