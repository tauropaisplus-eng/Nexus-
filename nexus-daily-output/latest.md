# NEXUS Daily - 2026-11-25

## 👁️ Baja visión

**Cómo plantear las expectativas del tratamiento anti-VEGF en la DMAE húmeda**
La duda de los pacientes ante la inyección intravítrea puede demorar el tratamiento de la degeneración macular neovascular (wAMD). Involucrar a la familia, naturalizar el procedimiento e inyectar el mismo día del diagnóstico ayudaría a reducir el riesgo de una pérdida de visión evitable. ([Ophthalmology Times][1])

**Estudio SOL-1: Axpaxli superó a aflibercept y mostró durabilidad en DMAE húmeda**
En un video del congreso de la Academia Americana de Oftalmología, en Nueva Orleans, Jennifer I. Lim (Universidad de Illinois en Chicago) repasa los resultados del ensayo de fase 3. Se comparó Axpaxli (implante intravítreo de axitinib 0,45 mg, de Ocular Therapeutix) con Eylea (aflibercept 2 mg). Axpaxli cumplió el objetivo primario, con menor porcentaje de ojos que perdieron 15 letras o más, y a los 6 y 9 meses pocos ojos necesitaron terapia de rescate. ([Healio][2])

## 🤖 Inteligencia artificial

**Claude permite convertir herramientas creadas en una conversación en aplicaciones de escritorio**
Las herramientas armadas durante un chat con Claude pueden instalarse como aplicaciones en Windows y Mac, sin necesidad de saber programar. Las aplicaciones seguirán necesitando conexión a Internet para funcionar. ([La Razón][3])

**Los modelos GPT-6 muestran capacidad intrínseca para diseñar proteínas**
La familia GPT-6 diseña estructuras y secuencias de proteínas solo con razonamiento y código, sin recurrir a modelos de biología especializados. En pruebas de laboratorio con Onava, proteínas basadas en diseños de GPT-6.2 mostraron evidencia de unión en cinco blancos, y los anticuerpos rediseñados conservaron la unión. Los resultados figuran en un preprint, y los modelos especializados solo ayudaron a aportar secuencias y seleccionar candidatos. ([OpenAI][4])

**Del espectro a la estructura: identificar moléculas con Mass Spec Skills para Google Antigravity**
Mass Spec Skills permite a científicos que usan Google Antigravity interpretar espectros de masas en tándem para identificar moléculas. ([Google DeepMind][5])

**Un agente de voz para idiomas indios con CUGA**
Entrada del blog de IBM Research en Hugging Face sobre un agente de voz para idiomas indios construido con CUGA (Configurable Generalist Agent), que lidera el benchmark AppWorld. ([Hugging Face Blog][6])

**Optimizar la inferencia de Inkling 2 Mini en una sola RTX PRO 6000**
Inkling 2 Mini tiene unos 26B de parámetros totales (3B activos por token), entradas multimodales y 1M de tokens de contexto. Es un modelo Mixture-of-Experts con bucle: 24 capas físicas, con las 12 del medio ejecutadas tres veces, y su checkpoint viene en NVFP4 y MXFP8 con un drafter DSpark. vLLM y SGLang lo soportan en versiones nightly, pero las recetas publicadas apuntan a GPU B200 y GB300 y dejan afuera tarjetas sm120 como la RTX PRO 6000. El artículo detalla cómo hacerlo correr en esa placa. ([Hugging Face Blog][7])

**Clay usa Codex y ChatGPT para ayudar a los equipos de ventas**
Clay emplea GPT-6 Astra, GPT-6 Sol y otros modelos para armar listas de empresas y personas, enriquecer esos registros con agentes y usarlos en jugadas de venta. También ofrece plugins para Codex y ChatGPT, con los que se pueden investigar cuentas y negociaciones desde esas herramientas. ([OpenAI][8])

---
Links:

[1]: https://www.ophthalmologytimes.com/view/setting-expectations-for-anti-vegf-treatment-in-wamd
[2]: https://www.healio.com/news/ophthalmology/20261124/sol1-trial-axpaxli-superior-to-aflibercept-shows-durability-in-wet-amd
[3]: https://www.larazon.es/tecnologia-consumo/inteligencia-artificial/claude-crear-instalar-aplicaciones-ia-windows-mac_202611256b06aeff50b7057c6d15c6f2.html
[4]: https://openai.com/index/gpt-6-models-demonstrate-intrinsic-protein-design-capabilities
[5]: https://deepmind.google/blog/interpreting-mass-spectra-with-google-antigravity/
[6]: https://huggingface.co/blog/ibm-research/an-indic-voice-agent-with-cuga
[7]: https://huggingface.co/blog/inkling-2-mini-inference-hillclimb
[8]: https://openai.com/business/customer-stories/clay-plugins-openai
