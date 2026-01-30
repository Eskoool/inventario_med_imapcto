/**
 * Farmacia HUNSC - Capa de integracion con Google Sheets
 * Soporta dos modos de conexion:
 *   1. Google Apps Script (directo, sin servidor adicional)
 *   2. n8n webhooks (para flujos avanzados)
 */

const API = (() => {
  // =============================================
  // CONFIGURACION
  // =============================================
  const CONFIG = {
    // --- Google Apps Script (lectura directa del Sheet) ---
    // Despliega google-apps-script/Code.gs y pega la URL aqui
    APPS_SCRIPT_URL: '',

    // --- n8n webhooks (escritura: crear, actualizar, eliminar) ---
    N8N_BASE_URL: 'https://n8n.srv872841.hstgr.cloud/webhook',
    N8N_ENDPOINT: '/inventario',

    // --- General ---
    TIMEOUT: 15000,
  };

  // =============================================
  // TRANSPORTE: Google Apps Script
  // =============================================

  async function appsScriptRequest(action, params = {}) {
    if (!CONFIG.APPS_SCRIPT_URL) {
      throw new Error('URL de Apps Script no configurada. Edita js/api.js');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT);

    try {
      let response;

      if (action === 'getAll' || action === 'getOne') {
        // GET requests
        const url = new URL(CONFIG.APPS_SCRIPT_URL);
        url.searchParams.set('action', action);
        if (params.material) {
          url.searchParams.set('material', params.material);
        }
        response = await fetch(url.toString(), {
          method: 'GET',
          signal: controller.signal,
        });
      } else {
        // POST requests (create, update, delete)
        response = await fetch(CONFIG.APPS_SCRIPT_URL, {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({
            action: action,
            material: params.material || null,
            data: params.data || null,
          }),
        });
      }

      clearTimeout(timeoutId);

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('La peticion ha superado el tiempo de espera');
      }
      throw error;
    }
  }

  // =============================================
  // TRANSPORTE: n8n webhooks
  // =============================================

  async function n8nRequest(method, path = '', body = null) {
    if (!CONFIG.N8N_BASE_URL) {
      throw new Error('URL de n8n no configurada. Edita js/api.js');
    }

    const url = `${CONFIG.N8N_BASE_URL}${CONFIG.N8N_ENDPOINT}${path}`;
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
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

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('La peticion ha superado el tiempo de espera');
      }
      throw error;
    }
  }

  // =============================================
  // OPERACIONES CRUD (agnósticas al transporte)
  // =============================================

  // LECTURA: usa Apps Script (directo del Sheet, sin n8n)
  // ESCRITURA: usa n8n webhooks (crear, actualizar, eliminar)

  async function getAll() {
    if (CONFIG.APPS_SCRIPT_URL) {
      return await appsScriptRequest('getAll');
    }
    return await n8nRequest('GET');
  }

  async function getByMaterial(material) {
    if (CONFIG.APPS_SCRIPT_URL) {
      return await appsScriptRequest('getOne', { material });
    }
    return await n8nRequest('GET', `/${encodeURIComponent(material)}`);
  }

  async function create(data) {
    if (CONFIG.N8N_BASE_URL) {
      return await n8nRequest('POST', '', data);
    }
    return await appsScriptRequest('create', { data });
  }

  async function update(material, data) {
    if (CONFIG.N8N_BASE_URL) {
      return await n8nRequest('PUT', `/${encodeURIComponent(material)}`, data);
    }
    return await appsScriptRequest('update', { material, data });
  }

  async function remove(material) {
    if (CONFIG.N8N_BASE_URL) {
      return await n8nRequest('DELETE', `/${encodeURIComponent(material)}`);
    }
    return await appsScriptRequest('delete', { material });
  }

  // =============================================
  // CONFIGURACION EN RUNTIME
  // =============================================

  function setAppsScriptUrl(url) {
    CONFIG.APPS_SCRIPT_URL = url;
  }

  function setN8nUrl(baseUrl) {
    CONFIG.N8N_BASE_URL = baseUrl.replace(/\/$/, '');
  }

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
    setAppsScriptUrl,
    setN8nUrl,
    testConnection,
    CONFIG,
  };
})();
