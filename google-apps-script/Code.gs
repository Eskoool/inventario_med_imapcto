/**
 * =====================================================
 * Farmacia HUNSC - Google Apps Script API Bridge
 * =====================================================
 *
 * Este script se despliega como Web App desde Google Sheets
 * y sirve como API REST para la webapp de inventario.
 *
 * INSTRUCCIONES DE INSTALACION:
 *
 * 1. Abre tu Google Sheet:
 *    https://docs.google.com/spreadsheets/d/18HvkVV0s_NFKKUcATYd7eThEQ5Ee_JIYHDXXv84uFgc/edit
 *
 * 2. Ve a Extensiones → Apps Script
 *
 * 3. Borra todo el contenido del editor y pega ESTE ARCHIVO COMPLETO
 *
 * 4. Guarda (Ctrl+S)
 *
 * 5. Clic en "Implementar" → "Nueva implementacion"
 *    - Tipo: "Aplicacion web"
 *    - Ejecutar como: "Yo mismo"
 *    - Quien tiene acceso: "Cualquier persona"
 *    - Clic en "Implementar"
 *
 * 6. Autoriza el acceso cuando te lo pida Google
 *
 * 7. Copia la URL generada (sera algo como:
 *    https://script.google.com/macros/s/AKfycb.../exec)
 *
 * 8. Pega esa URL en js/api.js en la variable APPS_SCRIPT_URL
 *
 * =====================================================
 */

// Nombre de la hoja (pestana) dentro del Google Sheet
const SHEET_NAME = 'inventario_medicamentos';

/**
 * Maneja peticiones GET (leer datos)
 */
function doGet(e) {
  try {
    const params = e.parameter;
    const action = params.action || 'getAll';

    let result;

    switch (action) {
      case 'getAll':
        result = getAllRows();
        break;
      case 'getOne':
        result = getRowByMaterial(params.material);
        break;
      default:
        result = { error: 'Accion no reconocida: ' + action };
    }

    return jsonResponse(result);
  } catch (error) {
    return jsonResponse({ error: error.message });
  }
}

/**
 * Maneja peticiones POST (crear, actualizar, eliminar)
 */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action || 'create';

    let result;

    switch (action) {
      case 'create':
        result = createRow(body.data);
        break;
      case 'update':
        result = updateRow(body.material, body.data);
        break;
      case 'delete':
        result = deleteRow(body.material);
        break;
      default:
        result = { error: 'Accion no reconocida: ' + action };
    }

    return jsonResponse(result);
  } catch (error) {
    return jsonResponse({ error: error.message });
  }
}

// =====================================================
// OPERACIONES CRUD
// =====================================================

/**
 * Obtener todas las filas
 */
function getAllRows() {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) {
    return []; // Solo tiene encabezados o esta vacia
  }

  const headers = data[0];
  const rows = [];

  for (let i = 1; i < data.length; i++) {
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = data[i][j];
    }
    rows.push(row);
  }

  return rows;
}

/**
 * Obtener una fila por codigo de material
 */
function getRowByMaterial(material) {
  const rows = getAllRows();
  const found = rows.find(r => String(r.material) === String(material));
  return found || { error: 'Medicamento no encontrado: ' + material };
}

/**
 * Crear una nueva fila
 */
function createRow(data) {
  if (!data || !data.material) {
    return { error: 'El campo material es obligatorio' };
  }

  // Verificar que no exista ya
  const existing = getAllRows().find(r => String(r.material) === String(data.material));
  if (existing) {
    return { error: 'Ya existe un medicamento con codigo: ' + data.material };
  }

  const sheet = getSheet();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  // Construir fila en el orden de los encabezados
  const newRow = headers.map(h => {
    if (data[h] !== undefined && data[h] !== null) {
      return data[h];
    }
    return '';
  });

  sheet.appendRow(newRow);

  return { success: true, message: 'Medicamento creado', data: data };
}

/**
 * Actualizar una fila existente
 */
function updateRow(material, data) {
  if (!material) {
    return { error: 'El campo material es obligatorio para actualizar' };
  }

  const sheet = getSheet();
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const materialCol = headers.indexOf('material');

  if (materialCol === -1) {
    return { error: 'No se encontro la columna "material" en los encabezados' };
  }

  // Buscar la fila (empezando desde 1 para saltar encabezados)
  let rowIndex = -1;
  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][materialCol]) === String(material)) {
      rowIndex = i + 1; // +1 porque Sheets es 1-indexed
      break;
    }
  }

  if (rowIndex === -1) {
    return { error: 'Medicamento no encontrado: ' + material };
  }

  // Actualizar cada campo
  const updatedRow = headers.map((h, idx) => {
    if (data[h] !== undefined && data[h] !== null) {
      return data[h];
    }
    return allData[rowIndex - 1][idx]; // Mantener valor anterior
  });

  sheet.getRange(rowIndex, 1, 1, headers.length).setValues([updatedRow]);

  return { success: true, message: 'Medicamento actualizado', data: data };
}

/**
 * Eliminar una fila
 */
function deleteRow(material) {
  if (!material) {
    return { error: 'El campo material es obligatorio para eliminar' };
  }

  const sheet = getSheet();
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const materialCol = headers.indexOf('material');

  if (materialCol === -1) {
    return { error: 'No se encontro la columna "material"' };
  }

  // Buscar la fila
  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][materialCol]) === String(material)) {
      sheet.deleteRow(i + 1); // +1 porque Sheets es 1-indexed
      return { success: true, message: 'Medicamento eliminado: ' + material };
    }
  }

  return { error: 'Medicamento no encontrado: ' + material };
}

// =====================================================
// UTILIDADES
// =====================================================

/**
 * Obtiene la hoja activa por nombre
 */
function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  // Si no existe la hoja, crearla con encabezados
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    const headers = [
      'material',
      'texto_largo_material',
      'persona_asignada',
      'stock_maestro',
      'stock_real',
      'stock_cta_polivalente',
      'descuadre_dragofarma',
      'observaciones',
      'seflogico',
      'descuadre_seflogic'
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    // Formato de encabezados
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#6B2D8B');
    headerRange.setFontColor('#FFFFFF');
    headerRange.setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  return sheet;
}

/**
 * Devuelve una respuesta JSON con CORS habilitado
 */
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Funcion de prueba - ejecutar desde el editor para verificar
 */
function testGetAll() {
  const result = getAllRows();
  Logger.log(JSON.stringify(result, null, 2));
}

/**
 * Inicializa la hoja con encabezados si esta vacia.
 * Ejecutar manualmente la primera vez.
 */
function setupSheet() {
  const sheet = getSheet(); // Esto crea la hoja si no existe
  Logger.log('Hoja "' + SHEET_NAME + '" lista con encabezados.');
}
