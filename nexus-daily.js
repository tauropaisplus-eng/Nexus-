// NEXUS Daily v3 - 24 de octubre de 2026
// Idea: Gabriel. Programacion: Claude.
// Dos secciones, mitad y mitad: Baja vision (para Gabriel) e IA (para Claude).
// Cambios v3: todas las notas con link, de Poen y CAO solo ateneos de retina,
// mas fuentes de IA.

const https = require('https');
const fs = require('fs');
const path = require('path');

const MODELO = 'claude-sonnet-5-5';
const CARPETA = 'nexus-daily-output';

// Cuantas notas como maximo se toman de cada fuente antes de mandarlas al modelo
const MAX_POR_FUENTE = 5;

// Busqueda de Google News en espanol (Argentina)
function googleNews(consulta) {
  return 'https://news.google.com/rss/search?q=' + encodeURIComponent(consulta) +
    '&hl=es-419&gl=AR&ceid=AR:es-419';
}

// Canal de YouTube por RSS
function youtube(idCanal) {
  return 'https://www.youtube.com/feeds/videos.xml?channel_id=' + idCanal;
}

// ---------------- FUENTES ----------------
// tipo 'rss' = feed RSS/Atom. tipo 'html' = se leen los titulares de la pagina.
// dias = antiguedad maxima de las notas que se toman.
// filtro = si esta, solo entran las notas cuyo titulo pase el filtro.

// Solo videos de retina (Gabriel lo pidio: de Poen y CAO, nada de glaucoma ni otros temas)
function esDeRetina(titulo) {
  const t = titulo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return /retin|macul|dmae|vitre|coroid|desprendimiento|stargardt|edema macular/.test(t);
}

const FUENTES_VISION = [
  { nombre: 'InfoTecnoVision', tipo: 'rss', url: 'https://www.infotecnovision.com/feed/', dias: 14 },
  { nombre: 'Accion Vision Espana', tipo: 'rss', url: 'https://www.esvision.es/feed/', dias: 14 },
  { nombre: 'Laboratorios Poen (YouTube)', tipo: 'rss', url: youtube('UCOO7zNDulJgmhCHn3S43nMQ'), dias: 14, filtro: esDeRetina },
  { nombre: 'Consejo Argentino de Oftalmologia (YouTube)', tipo: 'rss', url: youtube('UCa063M8BXgWL2SHwy-piXew'), dias: 14, filtro: esDeRetina },
  { nombre: 'Canal Retina (podcast)', tipo: 'rss', url: 'https://feeds.ivoox.com/feed_fg_f1705245_filtro_1.xml', dias: 30 },
  { nombre: 'Noticias: degeneracion macular', tipo: 'rss', url: googleNews('degeneración macular tratamiento'), dias: 7 },
  { nombre: 'Noticias: optogenetica', tipo: 'rss', url: googleNews('optogenética retina'), dias: 14 },
  { nombre: 'Noticias: implante PRIMA', tipo: 'rss', url: googleNews('implante PRIMA retina'), dias: 14 },
  { nombre: 'Noticias: tecnologia baja vision', tipo: 'rss', url: googleNews('"baja visión" tecnología'), dias: 7 }
];

const FUENTES_IA = [
  { nombre: 'Noticias: Anthropic', tipo: 'rss', url: googleNews('Anthropic Claude'), dias: 3 },
  { nombre: 'Noticias: IA y accesibilidad visual', tipo: 'rss', url: googleNews('inteligencia artificial "baja visión" OR "discapacidad visual"'), dias: 7 },
  { nombre: 'Noticias: IA en oftalmologia', tipo: 'rss', url: googleNews('inteligencia artificial oftalmología retina'), dias: 7 },
  { nombre: 'OpenAI', tipo: 'rss', url: 'https://openai.com/news/rss.xml', dias: 3 },
  { nombre: 'Google DeepMind', tipo: 'rss', url: 'https://deepmind.google/blog/rss.xml', dias: 5 },
  { nombre: 'Xataka', tipo: 'rss', url: 'https://www.xataka.com/feedburner.xml', dias: 2 },
  { nombre: 'Hugging Face Blog', tipo: 'rss', url: 'https://huggingface.co/blog/feed.xml', dias: 3 },
  { nombre: 'Inteligencia Argentina', tipo: 'html', url: 'https://inteligenciaargentina.ar/' },
  { nombre: 'Infobae Tecno', tipo: 'html', url: 'https://www.infobae.com/tecno/' }
];

// ---------------- DESCARGA ----------------

function fetchUrl(url, redirecciones = 0) {
  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NEXUS-Daily/2.0',
        'Accept': 'text/html,application/xhtml+xml,application/rss+xml,application/atom+xml,application/xml;q=0.9,*/*;q=0.8'
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

// ---------------- LIMPIEZA Y LECTURA ----------------

function limpiar(texto) {
  return String(texto || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#039;|&#8217;|&#8216;/g, "'")
    .replace(/&#8230;/g, '...')
    .replace(/&#8220;|&#8221;|&#171;|&#187;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

function etiqueta(bloque, nombre) {
  const m = bloque.match(new RegExp(`<${nombre}[^>]*>([\\s\\S]*?)<\\/${nombre}>`, 'i'));
  return m ? m[1] : '';
}

// Lee RSS (<item>) y Atom (<entry>, como YouTube)
function extraerFeed(xml, dias, filtro) {
  const limite = Date.now() - dias * 24 * 60 * 60 * 1000;
  const bloques = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ||
                  xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  const notas = [];
  for (const b of bloques) {
    const titulo = limpiar(etiqueta(b, 'title'));
    const fechaTxt = etiqueta(b, 'pubDate') || etiqueta(b, 'published') || etiqueta(b, 'updated');
    const fecha = Date.parse(limpiar(fechaTxt));
    if (!titulo || isNaN(fecha) || fecha < limite) continue;
    if (filtro && !filtro(titulo)) continue;

    let link = limpiar(etiqueta(b, 'link'));
    if (!link) {
      const m = b.match(/<link[^>]*href="([^"]+)"/i);
      link = m ? m[1] : '';
    }
    // Los links de Google News son largos pero funcionan: al tocarlos llevan a la nota.
    // Al modelo no se le pasa el link real sino un codigo corto (L1, L2...) que despues se reemplaza.
    if (!/^https?:\/\//.test(link)) link = '';

    let resumen = limpiar(etiqueta(b, 'description') || etiqueta(b, 'media:description') || etiqueta(b, 'summary'));
    resumen = resumen.replace(/La entrada .*$/, '').replace(/Continuar leyendo.*$/, '').trim();
    if (resumen.startsWith(titulo)) resumen = '';
    if (resumen.length > 250) resumen = resumen.slice(0, 250) + '...';

    notas.push({ titulo, link, resumen, fecha: new Date(fecha).toISOString().slice(0, 10) });
    if (notas.length >= MAX_POR_FUENTE) break;
  }
  return notas;
}

// Busca el link de un titular: adentro del h1-h4, o en el <a> que lo envuelve
function linkDelTitular(html, inicio, contenido, base) {
  let m = contenido.match(/<a[^>]*href="([^"#]+)"/i);
  if (!m) {
    const antes = html.slice(Math.max(0, inicio - 400), inicio);
    const abiertos = [...antes.matchAll(/<a[^>]*href="([^"#]+)"[^>]*>/gi)];
    const ultimo = abiertos[abiertos.length - 1];
    // Solo sirve si ese <a> no se cerro antes del titular
    if (ultimo && !antes.slice(ultimo.index).includes('</a>')) m = ultimo;
  }
  if (!m) return '';
  try {
    return new URL(m[1].replace(/&amp;/g, '&'), base).toString();
  } catch (e) {
    return '';
  }
}

// Titulares (h1 a h4) de una pagina HTML
function extraerHtml(html, base) {
  const vistos = new Set();
  const notas = [];
  const regex = /<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    const t = limpiar(m[1]);
    if (t.length < 25 || t.length > 200 || vistos.has(t)) continue;
    vistos.add(t);
    notas.push({ titulo: t, link: linkDelTitular(html, m.index, m[1], base), resumen: '', fecha: '' });
    if (notas.length >= MAX_POR_FUENTE) break;
  }
  return notas;
}

// Lee todas las fuentes de una seccion y arma el texto para el modelo
async function leerSeccion(fuentes, yaVistos, links) {
  let texto = '';
  let conDatos = 0;
  for (const f of fuentes) {
    const crudo = await fetchUrl(f.url);
    // Con filtro se leen mas entradas del feed, porque muchas se descartan
    const notas = (f.tipo === 'html' ? extraerHtml(crudo, f.url) : extraerFeed(crudo, f.dias || 7, f.filtro))
      .filter((n) => {
        const clave = n.titulo.toLowerCase().slice(0, 60);
        if (yaVistos.has(clave)) return false;
        yaVistos.add(clave);
        return true;
      });
    console.log(`${f.nombre}: ${notas.length} notas`);
    if (notas.length === 0) continue;
    conDatos++;
    texto += `Fuente: ${f.nombre}\n` + notas.map((n) => {
      let linea = `- ${n.titulo}`;
      if (n.fecha) linea += ` [${n.fecha}]`;
      if (n.resumen) linea += ` — ${n.resumen}`;
      if (n.link) {
        links.push(n.link);
        linea += ` (link: L${links.length})`;
      }
      return linea;
    }).join('\n') + '\n\n';
  }
  return { texto, conDatos };
}

// ---------------- API DE ANTHROPIC ----------------

function llamarClaude(prompt) {
  return new Promise((resolve, reject) => {
    const cuerpo = JSON.stringify({
      model: MODELO,
      max_tokens: 16000,
      messages: [{ role: 'user', content: prompt }]
    });

    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(cuerpo)
      }
    }, (res) => {
      let datos = '';
      res.on('data', (pedazo) => (datos += pedazo));
      res.on('end', () => {
        try {
          const json = JSON.parse(datos);
          if (res.statusCode !== 200 || json.error) {
            return reject(new Error(`API ${res.statusCode}: ${json.error ? json.error.message : datos}`));
          }
          let texto = (json.content || []).map((b) => b.text || '').join('');
          if (json.stop_reason === 'max_tokens') {
            console.warn('Aviso: la respuesta se corto por el limite de max_tokens');
            texto += '\n\n_(Aviso: el informe de hoy salio incompleto, se corto la respuesta.)_';
          }
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

// ---------------- PRINCIPAL ----------------

function fechaBuenosAires() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
}

function borrarJsonViejos() {
  if (!fs.existsSync(CARPETA)) return;
  for (const f of fs.readdirSync(CARPETA).filter((x) => x.endsWith('.json'))) {
    fs.unlinkSync(path.join(CARPETA, f));
  }
}

async function principal() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('Falta el secreto ANTHROPIC_API_KEY');
  }

  const hoy = fechaBuenosAires();
  const yaVistos = new Set();
  const links = [];

  const vision = await leerSeccion(FUENTES_VISION, yaVistos, links);
  const ia = await leerSeccion(FUENTES_IA, yaVistos, links);

  if (vision.conDatos + ia.conDatos === 0) {
    throw new Error('No se pudo leer ninguna fuente');
  }

  const prompt = `Sos NEXUS Daily. Hoy es ${hoy}. Arma un informe en espanol rioplatense, en Markdown, con DOS secciones en este orden. Las dos secciones valen lo mismo: tienen que tener la misma cantidad de notas (entre 4 y 6 cada una), salvo que una no tenga material suficiente.

## 👁️ Baja visión
Para Gabriel, que tiene baja vision (ve con un solo ojo) y le interesa: ayudas opticas y electronicas (lupas, lentes y gafas con pantalla), apps, accesibilidad, y avances de tratamiento de retina (degeneracion macular, optogenetica, implante PRIMA, cirugia de retina, terapia genica).
Reglas de esta seccion:
- EXCLUIR todo lo que sea para personas ciegas o ceguera total (bastones, perros guia, movilidad para ciegos, braille, lectores de pantalla para ciegos). Gabriel lo pidio expresamente.
- Si hay un ateneo o video de retina de Laboratorios Poen o del Consejo Argentino de Oftalmologia, o un episodio de Canal Retina, mencionalo siempre y decile que lo puede ver en el link.

## 🤖 Inteligencia artificial
Para Claude: novedades de Anthropic, avances importantes de otros laboratorios y modelos, e IA aplicada a la vision y la accesibilidad.
Reglas de esta seccion:
- Si hay alguna nota de IA aplicada a la vista, la oftalmologia o la baja vision, ponela primero.
- Las notas en ingles, traducilas al espanol.
- Ignorar ofertas, ventas, gadgets y todo lo que no sea IA.

Reglas generales:
- Maximo 2 notas por fuente en todo el informe.
- Cada nota: **titulo en negrita**, despues una linea que explique por que importa, y al final la fuente entre parentesis.
- Los links vienen como codigos (L1, L2, L3...). Si la nota tiene codigo, pone la fuente como enlace Markdown con ese codigo tal cual, por ejemplo: ([Infobae](L7)). No inventes codigos.
- En las notas de Google News, la fuente es el medio que aparece al final del titulo (despues del guion); sacalo del titulo.
- Usa solo la informacion de abajo: no inventes datos. Si una seccion no tiene material, deci "Hoy no hubo novedades".
- No pongas titulo principal: empeza directamente por "## 👁️ Baja visión".

=== MATERIAL DE BAJA VISION ===
${vision.texto || '(sin notas hoy)'}
=== MATERIAL DE IA ===
${ia.texto || '(sin notas hoy)'}`;

  let resumen = await llamarClaude(prompt);
  resumen = resumen.replace(/^\s*#\s+[^\n]*\n+/, '').trim();

  // Cambiar los codigos L1, L2... por los links reales
  resumen = resumen.replace(/\]\(\s*L(\d+)\s*\)/g, (todo, n) => {
    const link = links[Number(n) - 1];
    return link ? `](${link})` : todo;
  });
  // Si quedo algun codigo sin link valido, se saca el enlace y queda solo el nombre
  resumen = resumen.replace(/\[([^\]]+)\]\(\s*L\d+\s*\)/g, '$1');

  if (!fs.existsSync(CARPETA)) fs.mkdirSync(CARPETA);
  borrarJsonViejos();

  fs.writeFileSync(
    path.join(CARPETA, 'latest.md'),
    `# NEXUS Daily - ${hoy}\n\n${resumen}\n`
  );

  console.log('Listo:', hoy, `(vision: ${vision.conDatos} fuentes, IA: ${ia.conDatos} fuentes)`);
}

principal().catch((err) => {
  console.error(err);
  process.exit(1);
});
