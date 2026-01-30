/**
 * Farmacia HUNSC - Capa de integración con n8n
 * Gestiona todas las operaciones CRUD contra Google Sheets via n8n webhooks
 */

const API = (() => {
  // =============================================
  // CONFIGURACION - Cambiar estas URLs por las reales de n8n
  // =============================================
  const CONFIG = {
    // URL base del webhook de n8n (sin barra final)
    BASE_URL: 'https://TU_INSTANCIA_N8N.com/webhook',
    // Endpoint del inventario
    ENDPOINT: '/inventario',
    // Timeout en ms
    TIMEOUT: 15000,
  };

  /**
   * Obtiene la URL completa del endpoint
   */
  function getUrl(path = '') {
    return `${CONFIG.BASE_URL}${CONFIG.ENDPOINT}${path}`;
  }

  /**
   * Realiza una peticion HTTP con manejo de errores y timeout
   */
  async function request(method, path = '', body = null) {
    const url = getUrl(path);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT);
    options.signal = controller.signal;

    try {
      const response = await fetch(url, options);
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new Error('La peticion ha superado el tiempo de espera');
      }
      throw error;
    }
  }

  // =============================================
  // OPERACIONES CRUD
  // =============================================

  /**
   * Obtener todos los registros del inventario
   * GET /webhook/inventario
   * @returns {Array} Lista de medicamentos
   */
  async function getAll() {
    const result = await request('GET');
    return result.data;
  }

  /**
   * Obtener un medicamento por su codigo de material
   * GET /webhook/inventario/:material
   * @param {string} material - Codigo del medicamento
   * @returns {Object} Datos del medicamento
   */
  async function getByMaterial(material) {
    const result = await request('GET', `/${encodeURIComponent(material)}`);
    return result.data;
  }

  /**
   * Crear un nuevo registro de medicamento
   * POST /webhook/inventario
   * @param {Object} data - Datos del medicamento
   * @returns {Object} Registro creado
   */
  async function create(data) {
    const result = await request('POST', '', data);
    return result.data;
  }

  /**
   * Actualizar un registro existente
   * PUT /webhook/inventario/:material
   * @param {string} material - Codigo del medicamento
   * @param {Object} data - Datos actualizados
   * @returns {Object} Registro actualizado
   */
  async function update(material, data) {
    const result = await request('PUT', `/${encodeURIComponent(material)}`, data);
    return result.data;
  }

  /**
   * Eliminar un registro
   * DELETE /webhook/inventario/:material
   * @param {string} material - Codigo del medicamento
   * @returns {Object} Confirmacion de eliminacion
   */
  async function remove(material) {
    const result = await request('DELETE', `/${encodeURIComponent(material)}`);
    return result.data;
  }

  // =============================================
  // CONFIGURACION EN RUNTIME
  // =============================================

  /**
   * Actualiza la URL base de n8n (para configuracion dinamica)
   * @param {string} baseUrl - Nueva URL base
   */
  function setBaseUrl(baseUrl) {
    CONFIG.BASE_URL = baseUrl.replace(/\/$/, '');
  }

  /**
   * Verifica la conexion con n8n
   * @returns {boolean} true si la conexion es exitosa
   */
  async function testConnection() {
    try {
      await getAll();
      return true;
    } catch {
      return false;
    }
  }

  return {
    getAll,
    getByMaterial,
    create,
    update,
    remove,
    setBaseUrl,
    testConnection,
    CONFIG,
  };
})();
