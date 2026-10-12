# Billing Memo

[English](README.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [Español](README.es.md)

**Todas tus herramientas. Un registro claro.** Gestiona los gastos de nube, alojamiento, bases de datos, correo, APIs y suscripciones de forma local.

[Descargar Windows v0.3.0](https://github.com/jeffrog-256k1/billing-memo/releases/latest) · [Abrir app web](https://jeffrog-256k1.github.io/billing-memo/) · [Ver ejemplos](https://jeffrog-256k1.github.io/billing-memo/?demo=1)

![Registro vacío al iniciar](assets/empty.png)

## Empieza vacío. Gestiona todo en una pantalla.

1. El primer inicio abre un **registro vacío**. El escritorio no incluye modo demo ni suscripciones de ejemplo.
2. Añade nombre, importe, moneda, ciclo y primera fecha de facturación. El enlace de facturación es opcional; proyecto, categoría y notas están en campos desplegables.
3. **Mi registro** reúne edición de servicios, facturas mensuales, pagos y estimaciones pendientes. Cambia de mes sin salir de tus servicios.
4. Registra el importe real al pagar. Usa **Herramientas del registro** para guardar o restaurar copias JSON.

![Datos ficticios seleccionados explícitamente](assets/overview.png)

La web también empieza vacía. Los ejemplos solo aparecen al seleccionarlos en el menú o abrir el enlace de demostración. Los cambios de la demo son temporales y no sobrescriben tu registro; “Abrir mi registro” vuelve a tus datos. Los importes ficticios no son precios reales de proveedores.

## Una app Windows más pequeña

La versión 0.3 reemplaza Electron por **Tauri y el WebView2 del sistema**. La interfaz sigue siendo web y local, pero ya no incluye otra copia de Chromium/Node. Funciona sin conexión una vez instalado WebView2. Si falta o es demasiado antiguo, el instalador lo descarga por separado; esa descarga no forma parte del tamaño reducido del instalador.

Windows 10/11 x64: utiliza el instalador o extrae el ZIP y ejecuta **Billing Memo.exe**. El ZIP también requiere WebView2. Ambos guardan en **%APPDATA%/app.leejungjae.billingmemo/ledger.json**; el almacenamiento no queda dentro del USB. La versión no está firmada y Windows puede mostrar un aviso de editor/SmartScreen. Incluye SHA256SUMS.txt y no tiene actualizador automático.

Para actualizar desde 0.2, cierra la app anterior y exporta una copia JSON. El primer inicio intenta copiar el registro guardado del perfil predeterminado anterior, sin modificar el original ni importar la demo. Si falla, muestra un aviso y permite restaurar JSON. Las copias 0.1/0.2 siguen siendo compatibles. [Guía de escritorio](docs/DESKTOP.md)

## Tres páginas

- **Mi registro:** servicios, enlaces, totales del mes, estado de pagos, búsqueda y filtros por proyecto/categoría/estado, presupuesto y previsión desplegable de seis meses. Los totales superiores siempre incluyen todos los servicios, aunque filtres la lista.
- **Calendario:** vencimientos, filtro por día, CSV mensual e ICS de facturas pendientes.
- **Informes:** fechas inicial/final inclusivas, total, importes mensuales, promedio, filtros y CSV de detalles o meses. Usa fecha real de pago o vencimiento previsto. Hasta 120 meses naturales; el promedio incluye meses vacíos y parciales.

## Cálculos y almacenamiento

Admite pagos mensuales, anuales, únicos y por uso. El uso es un **total mensual introducido manualmente**, no medición de APIs. El día 31 pasa al último día de los meses cortos y vuelve al 31 después. La cuota anual se cuenta completa en el mes de cobro; solo su equivalente mensual recurrente se divide entre 12.

Factura mensual = pagos registrados + estimaciones pendientes. Una factura de enero pagada en febrero cuenta en enero en el registro y en febrero en informes por pago real. Los pagos sobreviven a edición, pausa y eliminación de servicios; las ediciones afectan estimaciones pendientes, incluidas las pasadas. Cada servicio tiene una factura por mes; registra cargos extra como servicios únicos separados.

USD, KRW, EUR, JPY, CNY y GBP se guardan en unidades monetarias menores enteras; KRW/JPY no tienen decimales. Las tasas son manuales. Si faltan, se muestran totales por moneda y una conversión parcial. Cambiar moneda de visualización reinicia tasas y presupuesto. No hay tasas automáticas ni históricas.

El escritorio guarda JSON local; la web usa localStorage del navegador. No hay cuenta, backend ni sincronización: transfiere por JSON. Restaurar reemplaza el registro de destino tras confirmación. Borrar los datos del navegador elimina el registro web. Los errores de guardado y datos dañados se muestran sin reiniciar silenciosamente.

Límites: 500 servicios, 5.000 pagos, 2 MiB por registro/importación, fechas 2000–2199, nombres de 80 caracteres y notas de 2.000. Importes no negativos de hasta 100.000 millones de unidades menores por entrada. Solo enlaces HTTPS sin credenciales. Los datos no están cifrados: no guardes contraseñas, claves API ni tarjetas. No cobra, concilia facturas ni envía avisos en segundo plano; los recordatorios ICS dependen de tu calendario.

## Development

Node.js 22.12+ and npm:

```sh
git clone https://github.com/jeffrog-256k1/billing-memo.git
cd billing-memo
npm ci
npm run dev
```

```sh
npm test
npm run build
npx playwright install chromium
npm run test:browser
npm run test:reports
npm run format:check
```

The local dev command builds and previews the production CSP; rerun after source changes. Windows builds also require stable Rust, MSVC C++ Build Tools and WebView2. See [desktop build instructions](docs/DESKTOP.md). No provider keys are needed.

[Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [Dependencies](THIRD_PARTY_NOTICES.md)

Built by [jeffrog-256k1](https://github.com/jeffrog-256k1) · [leejungjae.app](https://leejungjae.app)
