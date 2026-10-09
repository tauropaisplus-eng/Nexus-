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

const MODELO = 'claude-sonnet-5-5';

// Descarga una pagina, siguiendo redirecciones y con User-Agent de navegador
function fetchUrl(url, redirecciones = 0) {
  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NEXUS-Daily/1.0',
        'Accept': 'text/html,application/xhtml+xml'
      },
      timeout: 15000
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirecciones < 5) {
        res.resume();
        const siguiente = new URL(res.headers.location, url).toString();
        return resolve(fetchUrl(siguiente, redirecciones + 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        console.warn(`Aviso: ${url} respondio ${res.statusCode}`);
        return resolve('');
      }
      res.setEncoding('utf8');
      let datos = '';
      res.on('data', (pedazo) => (datos += pedazo));
      res.on('end', () => resolve(datos));
    });
    req.on('timeout', () => req.destroy(new Error('tiempo agotado')));
    req.on('error', (e) => {
      console.warn(`Aviso: no se pudo leer ${url}: ${e.message}`);
      resolve('');
    });
  });
}

function limpiar(texto) {
  return texto
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

// Saca los titulares reales (h1 a h4) en vez de los primeros 500 caracteres del HTML
function extraerTitulares(html) {
  const titulares = new Set();
  const regex = /<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    const t = limpiar(m[1]);
    if (t.length >= 25 && t.length <= 200) titulares.add(t);
    if (titulares.size >= 15) break;
  }
  return [...titulares];
}

function llamarClaude(prompt) {
  return new Promise((resolve, reject) => {
    const cuerpo = JSON.stringify({
      model: MODELO,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });

    const opciones = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(cuerpo)
      }
    };

    const req = https.request(opciones, (res) => {
      let datos = '';
      res.on('data', (pedazo) => (datos += pedazo));
      res.on('end', () => {
        try {
          const json = JSON.parse(datos);
          if (res.statusCode !== 200 || json.error) {
            return reject(new Error(`API ${res.statusCode}: ${json.error ? json.error.message : datos}`));
          }
          const texto = (json.content || []).map((b) => b.text || '').join('');
          if (!texto.trim()) return reject(new Error('La API devolvio una respuesta vacia'));
          resolve(texto);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(cuerpo);
    req.end();
  });
}

async function principal() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('Falta el secreto ANTHROPIC_API_KEY');
  }

  const hoy = new Date().toISOString().slice(0, 10);

  let crudo = '';
  let fuentesConDatos = 0;
  for (const url of FUENTES) {
    const html = await fetchUrl(url);
    const titulares = extraerTitulares(html);
    console.log(`${url}: ${titulares.length} titulares`);
    if (titulares.length > 0) {
      fuentesConDatos++;
      crudo += `Fuente: ${url}\n` + titulares.map((t) => `- ${t}`).join('\n') + '\n\n';
    }
  }

  if (fuentesConDatos === 0) {
    throw new Error('No se pudo extraer ningun titular de ninguna fuente');
  }

  const prompt = `Sos NEXUS Daily. Estos son los titulares de hoy (${hoy}) de sitios de tecnologia en espanol.
Arma un resumen en espanol rioplatense, agrupado por temas (IA, programacion, dispositivos, negocios, etc.).
Maximo 10 puntos, cada uno con una linea de contexto y entre parentesis la fuente.
Usa solo la informacion de los titulares: no inventes datos ni detalles. Formato Markdown.

${crudo}`;

  const resumen = await llamarClaude(prompt);

  if (!fs.existsSync('nexus-daily-output')) {
    fs.mkdirSync('nexus-daily-output');
  }

  fs.writeFileSync(
    `nexus-daily-output/${hoy}.json`,
    JSON.stringify({ fecha: hoy, fuentes: fuentesConDatos, resumen }, null, 2)
  );

  fs.writeFileSync(
    'nexus-daily-output/latest.md',
    `# NEXUS Daily - ${hoy}\n\n${resumen}\n`
  );

  console.log('Listo:', hoy, `(${fuentesConDatos} fuentes con datos)`);
}

principal().catch((err) => {
  console.error(err);
  process.exit(1);
});
