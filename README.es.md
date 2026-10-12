# Billing Memo

[English](README.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [Español](README.es.md)

**Cada herramienta. Un solo registro.** Un cuaderno local en el navegador para organizar gastos de nube, alojamiento, bases de datos, correo, API y suscripciones.

[Abrir Billing Memo](https://jeffrog-256k1.github.io/billing-memo/) · [MIT](LICENSE) · [Cambios](CHANGELOG.md)

![Circuito animado de gastos con importes ficticios](assets/cost-circuit.gif)

## Funciones

- Reúne nombres, enlaces de facturación, proyectos, categorías y notas. Los accesos rápidos rellenan nombres y enlaces, nunca precios supuestos.
- Registra gastos mensuales, anuales, únicos y por uso. El uso es un **total mensual introducido manualmente**, no una medición automática de API.
- Consulta previsión del mes, pagos registrados, estimaciones pendientes y equivalente mensual recurrente. Registra el importe definitivo al pagar.
- Filtra por proyecto, categoría, búsqueda o día del calendario. Abre directamente el panel de facturación del servicio.
- Presupuesto mensual, distribución por categoría y previsión de seis meses. Admite USD, KRW, EUR, JPY, CNY y GBP, con conversión manual opcional.
- Exporta una copia JSON, un CSV mensual o un calendario de pendientes con aviso tres días antes. Restaura JSON validado tras confirmar el reemplazo.
- Interfaz completa en inglés, coreano, chino simplificado, japonés y español; adaptación móvil, pausa de animación y movimiento reducido.

![Interfaz de escritorio de Billing Memo](assets/overview.png)

## Tu propio registro

1. Explora la demo ficticia y pulsa **Abrir mi espacio**. Los cambios de la demo son temporales y no sobrescriben tu registro.
2. Añade un servicio, importe, moneda y **primera fecha de pago**, que fija la repetición. Puedes definir una última fecha o pausar estimaciones pendientes.
3. Selecciona un mes y pulsa **Registrar pago**. El importe real, incluso cero, sustituye la estimación de ese servicio para ese mes de facturación.
4. Exporta copias regularmente. Restaurar reemplaza el espacio actual; guarda antes una copia si quieres conservarlo.

## Reglas de cálculo

Los importes se almacenan como enteros en unidades mínimas (KRW/JPY sin decimales; el resto, dos). Un vencimiento del 31 de enero pasa al último día de febrero y vuelve al 31 de marzo. Un plan anual del 29 de febrero pasa al 28 en años normales. La cuota anual se contabiliza **completa en su mes de vencimiento**; solo el indicador mensual equivalente la divide entre 12. Los gastos únicos no forman parte del equivalente recurrente.

Previsión = importes reales registrados + estimaciones pendientes. Los pagos pertenecen al mes de facturación previsto; la fecha real de pago se guarda aparte. No es contabilidad de caja. Las instantáneas pagadas se conservan al editar, pausar o eliminar servicios. Editar un servicio cambia sus estimaciones pendientes, incluso las de meses anteriores. Cada servicio tiene una factura mensual; crea entradas únicas separadas para transacciones adicionales.

Las monedas distintas mantienen totales separados. Si falta un tipo de cambio, se muestra **total parcial**, nunca una conversión implícita 1:1. Introduce `1 unidad original = N unidades de visualización`; cada partida se redondea a la unidad mínima de destino. Cambiar la moneda de visualización reinicia tipos y presupuesto. No hay tipos en tiempo real ni predicción de consumo, impuestos o cambios de precios: introduce el importe completo que quieras controlar.

## Almacenamiento y límites

Sin inicio de sesión, conexión a facturación, seguimiento ni backend. La aplicación no envía solicitudes automáticas a terceros. Tu espacio se guarda en localStorage, sin cifrar y compartido con los scripts del mismo origen. Borrar los datos del sitio elimina el registro; el modo privado es temporal. Aloja la app en un origen dedicado si necesitas separación. No guardes contraseñas, claves API ni números de tarjeta. Los archivos exportados contienen tus entradas: revísalos antes de compartir.

Límites: 500 servicios, 5.000 pagos, 2 MiB para el registro serializado o JSON importado, nombres de 80 caracteres, notas de 2.000 y fechas de 2000 a 2199. Importes no negativos, con un máximo de 100.000 millones de unidades mínimas por partida. Enlaces HTTPS sin credenciales. Detecta conflictos entre pestañas y ofrece exportación o recuperación ante errores de guardado o datos dañados.

No cobra tarjetas, sincroniza dispositivos, concilia facturas ni envía avisos en segundo plano. Tu aplicación de calendario gestiona el aviso de tres días. Usa un calendario separado para administrar cambios y eliminaciones. Eliminar un servicio conserva pagos y permite deshacer inmediatamente. Los importes del ejemplo son ficticios, no precios actuales de proveedores.

## Ejecución local

Node.js 22.12+ y npm:

```sh
git clone https://github.com/jeffrog-256k1/billing-memo.git
cd billing-memo
npm ci
npm run dev
```

Abre la URL local mostrada. `dev` compila y sirve la app estática con la CSP de producción; vuelve a ejecutarlo tras modificar el código. No requiere secretos ni archivo de entorno.

```sh
npm test
npm run build
npx playwright install chromium
npm run test:browser
npm run format:check
```

Después de compilar y probar el navegador, `npm run render:assets` regenera las imágenes del README. Las pruebas usan datos ficticios aislados. La app no tiene dependencias de paquetes en ejecución; Vite, TypeScript, Playwright y gifenc son herramientas de desarrollo.

[Contribuir](CONTRIBUTING.md) · [Seguridad](SECURITY.md) · [Dependencias](THIRD_PARTY_NOTICES.md)

Creado por [jeffrog-256k1](https://github.com/jeffrog-256k1) · [leejungjae.app](https://leejungjae.app)
