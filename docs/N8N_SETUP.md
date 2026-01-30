# Configuracion n8n - Farmacia HUNSC

## Requisitos previos
1. Instancia de n8n activa (cloud o self-hosted)
2. Google Sheet creada con las columnas del modelo de datos
3. Credenciales de Google Sheets configuradas en n8n

## Google Sheet - Estructura

Crear una hoja llamada `inventario_medicamentos` con estas columnas (fila 1):

| A | B | C | D | E | F | G | H | I | J |
|---|---|---|---|---|---|---|---|---|---|
| material | texto_largo_material | persona_asignada | stock_maestro | stock_real | stock_cta_polivalente | descuadre_dragofarma | observaciones | seflogico | descuadre_seflogic |

## Workflows n8n

### 1. GET - Listar todos los medicamentos

```
Trigger: Webhook (GET /inventario)
  -> Google Sheets: Read (leer todas las filas)
  -> Respond to Webhook (devolver JSON)
```

Configuracion del nodo Google Sheets:
- Operation: Read Rows
- Document: [ID de tu Google Sheet]
- Sheet: inventario_medicamentos
- Range: A:J

### 2. POST - Crear medicamento

```
Trigger: Webhook (POST /inventario)
  -> Google Sheets: Append (agregar fila)
  -> Respond to Webhook (confirmar creacion)
```

Configuracion del nodo Google Sheets:
- Operation: Append
- Document: [ID de tu Google Sheet]
- Sheet: inventario_medicamentos
- Mapping: body del webhook a columnas

### 3. PUT - Actualizar medicamento

```
Trigger: Webhook (PUT /inventario/:material)
  -> Google Sheets: Read (buscar fila por material)
  -> IF: existe?
    -> Si: Google Sheets: Update (actualizar fila)
    -> No: Respond con error 404
  -> Respond to Webhook
```

Configuracion del nodo Google Sheets:
- Operation: Update
- Document: [ID de tu Google Sheet]
- Sheet: inventario_medicamentos
- Key Column: material (columna A)

### 4. DELETE - Eliminar medicamento

```
Trigger: Webhook (DELETE /inventario/:material)
  -> Google Sheets: Read (buscar fila por material)
  -> IF: existe?
    -> Si: Google Sheets: Delete (eliminar fila)
    -> No: Respond con error 404
  -> Respond to Webhook
```

## Configuracion de la WebApp

Una vez creados los webhooks en n8n, actualizar la URL base en `js/api.js`:

```javascript
const CONFIG = {
  BASE_URL: 'https://tu-instancia-n8n.com/webhook',
  ENDPOINT: '/inventario',
  TIMEOUT: 15000,
};
```

## CORS

Si la webapp se sirve desde un dominio diferente, configurar CORS en n8n:
- En las opciones del Webhook, habilitar "Allow Cross-Origin Requests"
- O configurar en el entorno de n8n: `N8N_CORS_ORIGIN=*`

## Prueba de conexion

Abrir la webapp y verificar que los datos se cargan. Si falla la conexion,
la app mostrara datos de demo automaticamente.
