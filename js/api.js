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
    // --- MODO 1: Google Apps Script (recomendado para empezar) ---
    // Pega aqui la URL de tu Apps Script desplegado
    APPS_SCRIPT_URL: '',

    // --- MODO 2: n8n webhooks (para flujos avanzados) ---
    N8N_BASE_URL: '',
    N8N_ENDPOINT: '/inventario',

    // --- General ---
    // 'apps-script' o 'n8n'
    MODE: 'apps-script',
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

  async function getAll() {
    if (CONFIG.MODE === 'apps-script') {
      return await appsScriptRequest('getAll');
    }
    return await n8nRequest('GET');
  }

  async function getByMaterial(material) {
    if (CONFIG.MODE === 'apps-script') {
      return await appsScriptRequest('getOne', { material });
    }
    return await n8nRequest('GET', `/${encodeURIComponent(material)}`);
  }

  async function create(data) {
    if (CONFIG.MODE === 'apps-script') {
      return await appsScriptRequest('create', { data });
    }
    return await n8nRequest('POST', '', data);
  }

  async function update(material, data) {
    if (CONFIG.MODE === 'apps-script') {
      return await appsScriptRequest('update', { material, data });
    }
    return await n8nRequest('PUT', `/${encodeURIComponent(material)}`, data);
  }

  async function remove(material) {
    if (CONFIG.MODE === 'apps-script') {
      return await appsScriptRequest('delete', { material });
    }
    return await n8nRequest('DELETE', `/${encodeURIComponent(material)}`);
  }

  // =============================================
  // CONFIGURACION EN RUNTIME
  // =============================================

  function setAppsScriptUrl(url) {
    CONFIG.APPS_SCRIPT_URL = url;
    CONFIG.MODE = 'apps-script';
  }

  function setN8nUrl(baseUrl) {
    CONFIG.N8N_BASE_URL = baseUrl.replace(/\/$/, '');
    CONFIG.MODE = 'n8n';
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
