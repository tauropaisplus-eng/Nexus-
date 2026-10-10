const https = require('https');
const fs = require('fs');

// Sitios de tecnologia: se leen los titulares del HTML
const FUENTES = [
  'https://www.infobae.com/tecno/',
  'https://www.lanacion.com.ar/tecnologia/',
  'https://inteligenciaargentina.ar/',
  'https://www.redusers.com/noticias/',
  'https://keepcoding.io/blog/',
  'https://es.investing.com/news/technology-news'
];

// Fuentes de baja vision: se leen por RSS (titulo + fecha)
const FUENTES_RSS = [
  'https://www.infotecnovision.com/feed/',
  'https://www.esvision.es/category/ultimas-noticias/feed/'
];

// Solo se toman notas RSS publicadas en los ultimos N dias
const DIAS_RSS = 14;

const MODELO = 'claude-sonnet-5-5';

// Descarga una pagina, siguiendo redirecciones y con User-Agent de navegador
function fetchUrl(url, redirecciones = 0) {
  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NEXUS-Daily/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/rss+xml,application/xml;q=0.9,*/*;q=0.8'
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
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#039;|&#8217;/g, "'")
    .replace(/&#8230;/g, '...')
    .replace(/&#8220;|&#8221;|&#171;|&#187;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

// Saca los titulares reales (h1 a h4) del HTML
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

// Lee un feed RSS y devuelve los titulos recientes (con una linea de contexto)
function extraerRss(xml) {
  const limite = Date.now() - DIAS_RSS * 24 * 60 * 60 * 1000;
  const notas = [];
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const item of items) {
    const titulo = limpiar((item.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '');
    const fechaTxt = (item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) || [])[1] || '';
    const fecha = Date.parse(fechaTxt.trim());
    if (!titulo || isNaN(fecha) || fecha < limite) continue;
    let resumen = limpiar((item.match(/<description>([\s\S]*?)<\/description>/i) || [])[1] || '');
    resumen = resumen.replace(/La entrada .*$/, '').replace(/Continuar leyendo.*$/, '').trim();
    if (resumen.length > 250) resumen = resumen.slice(0, 250) + '...';
    notas.push(resumen ? `${titulo} — ${resumen}` : titulo);
    if (notas.length >= 8) break;
  }
  return notas;
}

function llamarClaude(prompt) {
  return new Promise((resolve, reject) => {
    const cuerpo = JSON.stringify({
      model: MODELO,
      max_tokens: 3000,
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
          if (json.stop_reason === 'max_tokens') {
            console.warn('Aviso: la respuesta se corto por el limite de max_tokens');
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

  let crudoVision = '';
  for (const url of FUENTES_RSS) {
    const xml = await fetchUrl(url);
    const notas = extraerRss(xml);
    console.log(`${url}: ${notas.length} notas recientes (RSS)`);
    if (notas.length > 0) {
      fuentesConDatos++;
      crudoVision += `Fuente: ${url}\n` + notas.map((t) => `- ${t}`).join('\n') + '\n\n';
    }
  }

  if (fuentesConDatos === 0) {
    throw new Error('No se pudo extraer ningun titular de ninguna fuente');
  }

  const bloqueVision = crudoVision
    ? `\nAdemas, estas son notas recientes de sitios sobre baja vision y discapacidad visual.
Agregalas en una seccion propia al final, titulada "## 👁️ Baja visión", con hasta 3 puntos.\n\n${crudoVision}`
    : '';

  const prompt = `Sos NEXUS Daily. Estos son los titulares de hoy (${hoy}) de sitios de tecnologia en espanol.
Arma un resumen en espanol rioplatense, agrupado por temas (IA, programacion, dispositivos, negocios, etc.).
Maximo 10 puntos de tecnologia, cada uno con una linea de contexto y entre parentesis la fuente.
Usa solo la informacion de los titulares: no inventes datos ni detalles. Formato Markdown.
No pongas un titulo principal: empeza directamente por la primera seccion (##).

${crudo}${bloqueVision}`;

  let resumen = await llamarClaude(prompt);

  // Si el modelo igual puso un titulo principal (# ...), se saca para no duplicarlo
  resumen = resumen.replace(/^\s*#\s+[^\n]*\n+/, '').trim();

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
