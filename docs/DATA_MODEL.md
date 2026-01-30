# Modelo de Datos - Inventario Farmacia HUNSC

## Base de Datos: Google Sheets

### Hoja: `inventario_medicamentos`

| Columna | Campo | Tipo | Descripcion |
|---------|-------|------|-------------|
| A | material | string | Codigo del medicamento |
| B | texto_largo_material | string | Nombre del medicamento |
| C | persona_asignada | string | Farmaceutico responsable de verificar el control de stock |
| D | stock_maestro | number (decimales, +/-) | Cantidad que indica el software |
| E | stock_real | number (decimales, +/-) | Cantidad contada/verificada por el farmaceutico asignado |
| F | stock_cta_polivalente | number (decimales, +/-) | Almacen externo, cantidad hallada |
| G | descuadre_dragofarma | number (decimales, +/-) | **CALCULADO**: stock_real - stock_maestro |
| H | observaciones | string | Texto libre del farmaceutico |
| I | seflogico | number (decimales, +/-) | Cantidad del programa de gestion de compras |
| J | descuadre_seflogic | number (decimales, +/-) | **CALCULADO**: descuadre_dragofarma - seflogico |

### Campos Calculados

#### Descuadre Dragofarma
```
descuadre_dragofarma = stock_real - stock_maestro
```
- `0` = Sin descuadre (stock coincide)
- `< 0` = Descuadre negativo (faltan existencias respecto al sistema)
- `> 0` = Descuadre positivo (mas existencias de las que indica el sistema)

#### Descuadre Seflogic
```
descuadre_seflogic = descuadre_dragofarma - seflogico
```
- `0` = Sin descuadre
- `< 0` = Descuadre negativo
- `> 0` = Descuadre positivo (mas existencias de las que indica el sistema)

## Arquitectura

```
+-------------------+       +--------+       +--------------+
|   WebApp (PWA)    | <---> |  n8n   | <---> | Google Sheet  |
|   HTML/CSS/JS     |       | (API)  |       | (Base datos)  |
+-------------------+       +--------+       +--------------+
        |
        v
  Responsive UI
  (mobile-first)
```

### Flujo de datos
1. **INSERT**: WebApp -> n8n webhook -> Google Sheets (append row)
2. **UPDATE**: WebApp -> n8n webhook -> Google Sheets (update row by material code)
3. **DELETE**: WebApp -> n8n webhook -> Google Sheets (delete row by material code)
4. **READ**: WebApp -> n8n webhook -> Google Sheets (get all/filtered rows)

### Endpoints n8n (webhooks)

| Operacion | Metodo | Endpoint |
|-----------|--------|----------|
| Listar todos | GET | `/webhook/inventario` |
| Obtener uno | GET | `/webhook/inventario/:material` |
| Crear | POST | `/webhook/inventario` |
| Actualizar | PUT | `/webhook/inventario/:material` |
| Eliminar | DELETE | `/webhook/inventario/:material` |
