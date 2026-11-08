// NEXUS Daily v6 - 8 de noviembre de 2026 (empezo como v3 el 24 de octubre)
// Idea: Gabriel. Programacion: Claude.
// Dos secciones, mitad y mitad: Baja vision (para Gabriel) e IA (para Claude).
// Cambios v3: todas las notas con link, de Poen y CAO solo ateneos de retina,
// mas fuentes de IA.
// Cambios v4 (2 nov 2026): no repite notas de dias anteriores (historial),
// sin frases de relleno, links al pie para que el texto quede limpio.
// 3 nov 2026: ventanas de tiempo mas largas en baja vision (30-45 dias); el historial evita repetir.
// Cambios v5 (7 nov 2026, aprobados por Gabriel):
//  - Se saca el "mitad y mitad": cada seccion lleva lo que haya, sin recortar la otra.
//  - Resumenes de verdad: el script entra a cada nota y le pasa al modelo el texto,
//    no solo el titulo. Los links de Google News se traducen al link real del medio.
//  - Filtro firme: afuera todo lo que sea de ceguera o para personas ciegas.
// Cambios v6 (8 nov 2026, aprobados por Gabriel):
//  - Google cambio la forma de traducir sus links (error 400) y nunca se llegaba al texto.
//    Las busquedas de noticias pasan a Bing News, que trae el link real del medio.
//    Si Bing no responde, se usa Google News de respaldo.
//  - Historial de titulos: el modelo recibe lo ya publicado y no repite la misma noticia
//    aunque venga de otro medio. Mas busquedas de baja vision.

const https = require('https');
const fs = require('fs');
const path = require('path');

const MODELO = 'claude-sonnet-5-5';
const CARPETA = 'nexus-daily-output';

// Cuantas notas como maximo se toman de cada fuente antes de mandarlas al modelo
const MAX_POR_FUENTE = 5;

// Historial de links ya publicados, para no repetir notas de dias anteriores
const HISTORIAL = path.join(CARPETA, 'historial-links.txt');
const DIAS_HISTORIAL = 45;
// v6: tambien se guardan los titulos publicados, para que el modelo no repita
// la misma noticia aunque llegue desde otro medio o con otro link
const HISTORIAL_TITULOS = path.join(CARPETA, 'historial-titulos.txt');

function leerTitulos() {
  if (!fs.existsSync(HISTORIAL_TITULOS)) return [];
  const limite = new Date(Date.now() - DIAS_HISTORIAL * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return fs.readFileSync(HISTORIAL_TITULOS, 'utf8').split('\n')
    .map((l) => l.split('\t'))
    .filter(([fecha, titulo]) => fecha && titulo && fecha >= limite);
}

// Busqueda de Google News en espanol (Argentina)
function googleNews(consulta) {
  return 'https://news.google.com/rss/search?q=' + encodeURIComponent(consulta) +
    '&hl=es-419&gl=AR&ceid=AR:es-419';
}

// v6 (8 nov 2026): busqueda de noticias por Bing News. A diferencia de Google News,
// cada noticia trae adentro el link real del medio, asi el script puede entrar y leer el texto.
// Si Bing no responde, se usa Google News como respaldo (url2).
function noticias(consulta) {
  return {
    url: 'https://www.bing.com/news/search?q=' + encodeURIComponent(consulta) +
      '&format=rss&setlang=es&mkt=es-AR&count=30',
    url2: googleNews(consulta)
  };
}

// Los links de Bing pasan por apiclick.aspx?...&url=<link real>: se saca el link real
function linkRealBing(link) {
  try {
    const u = new URL(link);
    if (!/bing\.com$/.test(u.hostname)) return link;
    const real = u.searchParams.get('url');
    return real && /^https?:\/\//.test(real) ? real : link;
  } catch (e) {
    return link;
  }
}

// Canal de YouTube por RSS
function youtube(idCanal) {
  return 'https://www.youtube.com/feeds/videos.xml?channel_id=' + idCanal;
}

// Gabriel pidio que no entre nada de ceguera ni de cosas para personas ciegas.
function esDeCeguera(texto) {
  const t = String(texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/\bciegos?\b|\bciegas?\b|\binvidentes?\b|ceguera total|baston|perros? (guia|de asistencia)|braille|lectores? de pantalla|audiodescrip/.test(t)) return true;
  // "ceguera" sola: afuera, salvo que sea un tratamiento de retina (eso a Gabriel le sirve)
  return /ceguera/.test(t) && !(esDeRetina(t) || /tratamiento|terapia|ensayo|implante|farmaco|cirugia|vacuna|inyeccion/.test(t));
}

// Para el texto completo de la nota: si habla de personas ciegas y no menciona baja vision, afuera
function cuerpoEsParaCiegos(cuerpo) {
  const t = String(cuerpo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const ciegos = (t.match(/\bciegos?\b|\bciegas?\b|invidente|ceguera total|braille|baston/g) || []).length;
  return ciegos >= 2 && !/baja vision|resto visual|vision reducida/.test(t);
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
  { nombre: 'InfoTecnoVision', tipo: 'rss', url: 'https://www.infotecnovision.com/feed/', dias: 30 },
  { nombre: 'Accion Vision Espana', tipo: 'rss', url: 'https://www.esvision.es/feed/', dias: 30 },
  { nombre: 'Laboratorios Poen (YouTube)', tipo: 'rss', url: youtube('UCOO7zNDulJgmhCHn3S43nMQ'), dias: 45, filtro: esDeRetina },
  { nombre: 'Consejo Argentino de Oftalmologia (YouTube)', tipo: 'rss', url: youtube('UCa063M8BXgWL2SHwy-piXew'), dias: 45, filtro: esDeRetina },
  { nombre: 'Canal Retina (podcast)', tipo: 'rss', url: 'https://feeds.ivoox.com/feed_fg_f1705245_filtro_1.xml', dias: 30 },
  { nombre: 'Noticias: degeneracion macular', tipo: 'rss', ...noticias('degeneración macular tratamiento'), dias: 30 },
  { nombre: 'Noticias: optogenetica', tipo: 'rss', ...noticias('optogenética retina'), dias: 30 },
  { nombre: 'Noticias: implante PRIMA', tipo: 'rss', ...noticias('implante PRIMA retina'), dias: 30 },
  { nombre: 'Noticias: tecnologia baja vision', tipo: 'rss', ...noticias('"baja visión" tecnología'), dias: 30 },
  // v6: mas busquedas para que haya menos dias sin novedades
  { nombre: 'Noticias: terapia genica retina', tipo: 'rss', ...noticias('terapia génica retina'), dias: 30 },
  { nombre: 'Noticias: atrofia geografica', tipo: 'rss', ...noticias('atrofia geográfica tratamiento'), dias: 30 },
  { nombre: 'Noticias: Stargardt', tipo: 'rss', ...noticias('Stargardt tratamiento'), dias: 30 },
  { nombre: 'Noticias: gafas para baja vision', tipo: 'rss', ...noticias('gafas inteligentes "baja visión"'), dias: 30 }
];

const FUENTES_IA = [
  { nombre: 'Noticias: Anthropic', tipo: 'rss', ...noticias('Anthropic Claude'), dias: 3 },
  { nombre: 'Noticias: IA y accesibilidad visual', tipo: 'rss', ...noticias('inteligencia artificial "baja visión" OR "discapacidad visual"'), dias: 21 },
  { nombre: 'Noticias: IA en oftalmologia', tipo: 'rss', ...noticias('inteligencia artificial oftalmología retina'), dias: 21 },
  { nombre: 'OpenAI', tipo: 'rss', url: 'https://openai.com/news/rss.xml', dias: 3 },
  { nombre: 'Google DeepMind', tipo: 'rss', url: 'https://deepmind.google/blog/rss.xml', dias: 5 },
  { nombre: 'Xataka', tipo: 'rss', url: 'https://www.xataka.com/feedburner.xml', dias: 2 },
  { nombre: 'Hugging Face Blog', tipo: 'rss', url: 'https://huggingface.co/blog/feed.xml', dias: 3 },
  { nombre: 'Inteligencia Argentina', tipo: 'html', url: 'https://inteligenciaargentina.ar/' },
  { nombre: 'Infobae Tecno', tipo: 'html', url: 'https://www.infobae.com/tecno/' }
];

// ---------------- DESCARGA ----------------

function fetchUrl(url, redirecciones = 0, post = null) {
  return new Promise((resolve) => {
    const opciones = {
      method: post ? 'POST' : 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/rss+xml,application/atom+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-AR,es;q=0.9'
      },
      timeout: 15000
    };
    if (post) {
      opciones.headers['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8';
      opciones.headers['Content-Length'] = Buffer.byteLength(post);
    }
    const req = https.request(url, opciones, (res) => {
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
    if (post) req.write(post);
    req.end();
  });
}

// ---------------- TEXTO DE CADA NOTA (v5) ----------------

// Los links de Google News no llevan directo a la nota: hay que pedirle a Google el link real.
// Si algo falla, se devuelve '' y la nota sigue con el link de Google y sin texto.
async function linkRealGoogleNews(link) {
  try {
    const m = link.match(/news\.google\.com\/(?:rss\/)?articles\/([^?\/]+)/);
    if (!m) return '';
    const id = m[1];
    const pagina = await fetchUrl('https://news.google.com/rss/articles/' + id);
    const firma = (pagina.match(/data-n-a-sg="([^"]+)"/) || [])[1];
    const hora = (pagina.match(/data-n-a-ts="([^"]+)"/) || [])[1];
    if (!firma || !hora) return '';
    const pedido = JSON.stringify(['garturlreq', [['X', 'X', ['X', 'X'], null, null, 1, 1, 'US:en', null, 1, null, null, null, null, null, 0, 1], 'X', 'X', 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0], id, Number(hora), firma]);
    const cuerpo = 'f.req=' + encodeURIComponent(JSON.stringify([[['Fpe8Ab', pedido, null, 'generic']]]));
    const resp = await fetchUrl('https://news.google.com/_/DotsSplashUi/data/batchexecute', 0, cuerpo);
    const parte = resp.split('\n\n')[1];
    if (!parte) return '';
    const real = JSON.parse(JSON.parse(parte)[0][2])[1];
    return /^https?:\/\//.test(real) ? real : '';
  } catch (e) {
    return '';
  }
}

// Saca el texto principal de una pagina: la descripcion y los primeros parrafos
function textoDeLaPagina(html) {
  if (!html) return '';
  const meta = (html.match(/<meta[^>]+(?:property="og:description"|name="description")[^>]+content="([^"]*)"/i) || [])[1] || '';
  let zona = (html.match(/<article[\s\S]*?<\/article>/i) || [html])[0];
  zona = zona.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<nav[\s\S]*?<\/nav>|<footer[\s\S]*?<\/footer>/gi, ' ');
  const parrafos = [...zona.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((p) => limpiar(p[1]))
    .filter((p) => p.length > 60 && !/cookie|suscrib|newsletter|todos los derechos/i.test(p));
  let texto = limpiar(meta);
  for (const p of parrafos) {
    if (texto.length > 1500) break;
    if (!texto.includes(p.slice(0, 50))) texto += (texto ? ' ' : '') + p;
  }
  return texto.slice(0, 1500);
}

// Entra a cada nota (de a 6 a la vez) y le agrega el texto; traduce los links de Google News
async function completarNotas(notas) {
  let i = 0;
  async function trabajador() {
    while (i < notas.length) {
      const n = notas[i++];
      if (!n.link || /youtube\.com|ivoox\.com/.test(n.link)) continue; // videos y podcast ya traen descripcion
      if (/news\.google\.com/.test(n.link)) {
        const real = await linkRealGoogleNews(n.link);
        if (real) { n.linkGoogle = n.link; n.link = real; }
        else continue;
      }
      n.cuerpo = textoDeLaPagina(await fetchUrl(n.link));
    }
  }
  await Promise.all(Array.from({ length: 6 }, trabajador));
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
    link = linkRealBing(link);
    // Bing trae el nombre del medio aparte: se lo agrega al titulo como hace Google News
    const medio = limpiar(etiqueta(b, 'News:Source'));
    const tituloFinal = medio && !titulo.includes(medio) ? `${titulo} - ${medio}` : titulo;

    let resumen = limpiar(etiqueta(b, 'description') || etiqueta(b, 'media:description') || etiqueta(b, 'summary'));
    resumen = resumen.replace(/La entrada .*$/, '').replace(/Continuar leyendo.*$/, '').trim();
    if (resumen.startsWith(titulo)) resumen = '';
    if (resumen.length > 600) resumen = resumen.slice(0, 600) + '...';

    notas.push({ titulo: tituloFinal, link, resumen, fecha: new Date(fecha).toISOString().slice(0, 10) });
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
// Link real -> link de Google News, para anotar los dos en el historial
const originales = {};

async function leerSeccion(fuentes, yaVistos, links, publicados) {
  let texto = '';
  let conDatos = 0;
  for (const f of fuentes) {
    let crudo = await fetchUrl(f.url);
    // Si Bing no trae nada, respaldo con Google News
    if (f.url2 && !/<item[\s>]/i.test(crudo)) {
      console.log(`${f.nombre}: Bing sin respuesta, uso Google News`);
      crudo = await fetchUrl(f.url2);
    }
    // Con filtro se leen mas entradas del feed, porque muchas se descartan
    let notas = (f.tipo === 'html' ? extraerHtml(crudo, f.url) : extraerFeed(crudo, f.dias || 7, f.filtro))
      .filter((n) => {
        if (n.link && publicados.has(n.link)) return false;
        if (esDeCeguera(n.titulo) || esDeCeguera(n.resumen)) return false;
        const clave = n.titulo.toLowerCase().slice(0, 60);
        if (yaVistos.has(clave)) return false;
        yaVistos.add(clave);
        return true;
      });
    await completarNotas(notas);
    notas = notas.filter((n) => !(n.link && publicados.has(n.link)) && !cuerpoEsParaCiegos(n.cuerpo));
    const conTexto = notas.filter((n) => n.cuerpo).length;
    console.log(`${f.nombre}: ${notas.length} notas (${conTexto} con texto completo)`);
    if (process.env.DIAGNOSTICO) {
      const todas = f.tipo === 'html' ? extraerHtml(crudo, f.url) : extraerFeed(crudo, 60);
      console.log(`   [diag] bytes=${crudo.length}, ultimos 60 dias sin filtro=${todas.length}`);
      for (const n of todas.slice(0, 5)) {
        const marca = publicados.has(n.link) ? 'YA PUBLICADA' : (f.filtro && !f.filtro(n.titulo) ? 'NO PASA FILTRO' : '');
        console.log(`   [diag] ${n.fecha} ${n.titulo.slice(0, 100)} ${marca}`);
      }
    }
    if (notas.length === 0) continue;
    conDatos++;
    texto += `Fuente: ${f.nombre}\n` + notas.map((n) => {
      let linea = `- ${n.titulo}`;
      if (n.fecha) linea += ` [${n.fecha}]`;
      if (n.resumen) linea += ` — ${n.resumen}`;
      if (n.cuerpo) linea += `\n  Texto de la nota: ${n.cuerpo}`;
      if (n.link) {
        links.push(n.link);
        if (n.linkGoogle) originales[n.link] = n.linkGoogle;
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
      // utf8 evita que se rompan emojis y acentos cuando llegan cortados entre pedazos
      res.setEncoding('utf8');
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

// Lee el historial: un link por linea, con la fecha adelante ("2026-11-02<TAB>https://...")
function leerHistorial() {
  const lineas = fs.existsSync(HISTORIAL) ? fs.readFileSync(HISTORIAL, 'utf8').split('\n') : [];
  const limite = new Date(Date.now() - DIAS_HISTORIAL * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const entradas = lineas
    .map((l) => l.split('\t'))
    .filter(([fecha, link]) => fecha && link && fecha >= limite);
  // La primera vez no hay historial: se toman los links del informe anterior
  const anterior = path.join(CARPETA, 'latest.md');
  if (entradas.length === 0 && fs.existsSync(anterior)) {
    const viejo = fs.readFileSync(anterior, 'utf8');
    const fecha = (viejo.match(/NEXUS Daily - (\d{4}-\d{2}-\d{2})/) || [])[1] || limite;
    for (const m of viejo.matchAll(/https?:\/\/[^\s)]+/g)) entradas.push([fecha, m[0]]);
  }
  return entradas;
}

function guardarHistorial(entradas) {
  fs.writeFileSync(HISTORIAL, entradas.map(([f, l]) => `${f}\t${l}`).join('\n') + '\n');
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
  const historial = leerHistorial();
  const publicados = new Set(historial.map(([, l]) => l));
  const titulosViejos = leerTitulos();
  console.log(`Historial: ${publicados.size} links ya publicados`);

  const vision = await leerSeccion(FUENTES_VISION, yaVistos, links, publicados);
  const ia = await leerSeccion(FUENTES_IA, yaVistos, links, publicados);

  if (process.env.DIAGNOSTICO) {
    console.log('Modo diagnostico: no se genera informe');
    return;
  }

  if (vision.conDatos + ia.conDatos === 0) {
    throw new Error('No se pudo leer ninguna fuente');
  }

  const prompt = `Sos NEXUS Daily. Hoy es ${hoy}. Arma un informe en espanol rioplatense, en Markdown, con DOS secciones en este orden. Cada seccion lleva lo que haya: en baja vision todas las notas buenas que encuentres (hasta 6), aunque sean pocas; en IA entre 4 y 6. No recortes una seccion para emparejarla con la otra.

## 👁️ Baja visión
Para Gabriel, que tiene baja vision (ve con un solo ojo) y le interesa: ayudas opticas y electronicas (lupas, lentes y gafas con pantalla), apps, accesibilidad, y avances de tratamiento de retina (degeneracion macular, optogenetica, implante PRIMA, cirugia de retina, terapia genica).
Reglas de esta seccion:
- EXCLUIR todo lo que sea para personas ciegas o sobre ceguera (bastones, perros guia, movilidad para ciegos, braille, lectores de pantalla, apps o aparatos que se manejan solo por audio porque el usuario no ve). Fijate en el "Texto de la nota": si esta pensada para gente que no ve, va afuera. Gabriel lo pidio expresamente y es firme.
- No uses nunca las palabras "ceguera", "ciego" o "ciega". Si un tratamiento evita perder la vista, deci "perdida de vision".
- Si hay un ateneo o video de retina de Laboratorios Poen o del Consejo Argentino de Oftalmologia, o un episodio de Canal Retina, mencionalo siempre y decile que lo puede ver en el link.

## 🤖 Inteligencia artificial
Seccion que despues lee Claude en otra conversacion: novedades de Anthropic, avances importantes de otros laboratorios y modelos, e IA aplicada a la vision y la accesibilidad.
Reglas de esta seccion:
- Si hay alguna nota de IA aplicada a la vista, la oftalmologia o la baja vision, ponela primero.
- Las notas en ingles, traducilas al espanol.
- Ignorar ofertas, ventas, gadgets y todo lo que no sea IA.

Reglas generales:
- Quien lee el informe: Gabriel la seccion de baja vision, y Claude (en otra conversacion) la de IA. En la de baja vision podes hablarle a Gabriel de vos. En la de IA escribi en tono neutro, sin dirigirte a nadie. Nunca escribas frases como "para vos y para Gabriel" ni le hables a Claude.
- Variedad: maximo 2 notas sobre el mismo tema (por ejemplo, optogenetica). Si hay varias del mismo tema, quedate con la mas concreta y deja lugar a otros temas (lentes, apps, ayudas opticas).
- Maximo 2 notas por fuente en todo el informe.
- Cada nota: **titulo en negrita**, despues un resumen de 1 a 3 lineas con lo concreto: que se hizo, quien, en cuantos pacientes o con que resultado, y en que etapa esta (por ejemplo: ensayo, aprobado, a la venta). Al final la fuente entre parentesis.
- El resumen sale del "Texto de la nota". No repitas el titulo con otras palabras: conta lo que el titulo no dice.
- Sin relleno: si de una nota solo tenes el titulo, escribi UNA linea corta y concreta sobre de que trata. Nunca escribas "segun el titulo" ni nada parecido. Prohibido completar con frases vacias o supuestas como "es un tema que te interesa", "es una de las lineas que mas te interesan", "la nota no trae mas detalles", "el titulo aclara que...", "esta ubicada en el rastreo de...". No le digas a Gabriel que le interesa algo: eso ya lo sabe.
- Los links vienen como codigos (L1, L2, L3...). Si la nota tiene codigo, pone la fuente como enlace Markdown con ese codigo tal cual, por ejemplo: ([Infobae](L7)). No inventes codigos.
- En las notas de busqueda de noticias, la fuente es el medio que aparece al final del titulo (despues del guion); sacalo del titulo y no lo repitas en el titulo en negrita.
- NO REPETIR: abajo esta la lista de noticias ya publicadas en dias anteriores. Si una nota cuenta el mismo hecho que alguna de esa lista (aunque sea de otro medio o con otro titulo), dejala afuera. Solo entra si trae un hecho nuevo (por ejemplo, un resultado o una aprobacion que antes no estaba).
- Usa solo la informacion de abajo: no inventes datos. Si una seccion no tiene material, deci "Hoy no hubo novedades".
- No pongas titulo principal: empeza directamente por "## 👁️ Baja visión".

=== YA PUBLICADAS (NO REPETIR) ===
${titulosViejos.map(([, t]) => '- ' + t).join('\n') || '(ninguna)'}

=== MATERIAL DE BAJA VISION ===
${vision.texto || '(sin notas hoy)'}
=== MATERIAL DE IA ===
${ia.texto || '(sin notas hoy)'}`;

  let resumen = await llamarClaude(prompt);
  resumen = resumen.replace(/^\s*#\s+[^\n]*\n+/, '').trim();

  // Cambiar los codigos L1, L2... por referencias numeradas [1], [2]...
  // Los links largos (Google News) van todos juntos al pie, asi el texto queda limpio.
  const usados = [];
  resumen = resumen.replace(/\[([^\]]+)\]\(\s*L(\d+)\s*\)/g, (todo, nombre, n) => {
    const link = links[Number(n) - 1];
    if (!link) return nombre; // codigo sin link valido: queda solo el nombre
    let num = usados.indexOf(link) + 1;
    if (!num) num = usados.push(link);
    return `[${nombre}][${num}]`;
  });
  if (usados.length) {
    resumen += '\n\n---\nLinks:\n\n' + usados.map((l, i) => `[${i + 1}]: ${l}`).join('\n');
  }

  if (!fs.existsSync(CARPETA)) fs.mkdirSync(CARPETA);
  borrarJsonViejos();

  fs.writeFileSync(
    path.join(CARPETA, 'latest.md'),
    `# NEXUS Daily - ${hoy}\n\n${resumen}\n`
  );

  // Anotar en el historial los links publicados hoy
  const nuevos = [];
  for (const l of usados) {
    nuevos.push([hoy, l]);
    if (originales[l]) nuevos.push([hoy, originales[l]]);
  }
  guardarHistorial([...historial, ...nuevos]);

  // Anotar los titulos publicados hoy
  const titulosHoy = [...resumen.matchAll(/^\*\*([^*]+)\*\*/gm)].map((m) => [hoy, m[1].replace(/\t/g, ' ').trim()]);
  fs.writeFileSync(HISTORIAL_TITULOS, [...titulosViejos, ...titulosHoy].map(([f, t]) => `${f}\t${t}`).join('\n') + '\n');

  console.log('Listo:', hoy, `(vision: ${vision.conDatos} fuentes, IA: ${ia.conDatos} fuentes)`);
}

principal().catch((err) => {
  console.error(err);
  process.exit(1);
});
