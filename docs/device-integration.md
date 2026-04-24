# Integración de dispositivos

La capa de dispositivos está desacoplada del frontend.

Incluye:

- simulador de báscula vehicular USB,
- simulador de báscula secundaria USB,
- simulador de impresora térmica Epson POS,
- banderas de lectura estable/inestable,
- bandera de lectura manual,
- manejo de desconexión,
- registro de impresión y reimpresión.

La implementación real puede sustituirse por adaptadores de puerto serie, drivers OEM o middleware local sin cambiar el dominio.

