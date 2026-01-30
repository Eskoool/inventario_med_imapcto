/**
 * Farmacia HUNSC - Aplicacion principal
 * Control de inventario de medicamentos
 */

const App = (() => {
  // Estado de la aplicacion
  let state = {
    medicamentos: [],
    filteredMedicamentos: [],
    searchTerm: '',
    editingMaterial: null,  // null = modo crear, string = modo editar
    isLoading: false,
    autoRefreshInterval: null,
    AUTO_REFRESH_MS: 30000, // Refresco cada 30 segundos
  };

  // Referencias DOM (se inicializan en init)
  let dom = {};

  // =============================================
  // INICIALIZACION
  // =============================================

  function init() {
    cacheDom();
    bindEvents();
    loadData();
    startAutoRefresh();
  }

  function cacheDom() {
    dom = {
      // Stats
      statTotal: document.getElementById('stat-total'),
      statSinDescuadre: document.getElementById('stat-sin-descuadre'),
      statConDescuadre: document.getElementById('stat-con-descuadre'),
      statPendientes: document.getElementById('stat-pendientes'),

      // Toolbar
      searchInput: document.getElementById('search-input'),
      btnNew: document.getElementById('btn-new'),
      btnRefresh: document.getElementById('btn-refresh'),

      // Table
      tableBody: document.getElementById('table-body'),
      tableContainer: document.getElementById('table-container'),

      // Card list (mobile)
      cardList: document.getElementById('card-list'),

      // Empty state
      emptyState: document.getElementById('empty-state'),

      // Modal
      modalOverlay: document.getElementById('modal-overlay'),
      modalTitle: document.getElementById('modal-title'),
      modalClose: document.getElementById('modal-close'),
      form: document.getElementById('med-form'),
      btnSave: document.getElementById('btn-save'),
      btnCancel: document.getElementById('btn-cancel'),

      // Form fields
      fMaterial: document.getElementById('f-material'),
      fTextoLargo: document.getElementById('f-texto-largo'),
      fPersona: document.getElementById('f-persona'),
      fStockMaestro: document.getElementById('f-stock-maestro'),
      fStockReal: document.getElementById('f-stock-real'),
      fStockCta: document.getElementById('f-stock-cta'),
      fDescuadreDrago: document.getElementById('f-descuadre-drago'),
      fObservaciones: document.getElementById('f-observaciones'),
      fSeflogico: document.getElementById('f-seflogico'),
      fDescuadreSef: document.getElementById('f-descuadre-sef'),

      // Confirm dialog
      confirmOverlay: document.getElementById('confirm-overlay'),
      confirmText: document.getElementById('confirm-text'),
      confirmYes: document.getElementById('confirm-yes'),
      confirmNo: document.getElementById('confirm-no'),

      // Loading
      loadingOverlay: document.getElementById('loading-overlay'),

      // Toast
      toastContainer: document.getElementById('toast-container'),
    };
  }

  function bindEvents() {
    // Toolbar
    dom.searchInput.addEventListener('input', handleSearch);
    dom.btnNew.addEventListener('click', openCreateModal);
    dom.btnRefresh.addEventListener('click', () => loadData(false));

    // Modal
    dom.modalClose.addEventListener('click', closeModal);
    dom.btnCancel.addEventListener('click', closeModal);
    dom.btnSave.addEventListener('click', handleSave);
    dom.modalOverlay.addEventListener('click', (e) => {
      if (e.target === dom.modalOverlay) closeModal();
    });

    // Campos calculados: recalcular al cambiar
    dom.fStockMaestro.addEventListener('input', recalcDescuadres);
    dom.fStockReal.addEventListener('input', recalcDescuadres);
    dom.fSeflogico.addEventListener('input', recalcDescuadres);

    // Confirm dialog
    dom.confirmNo.addEventListener('click', closeConfirm);
    dom.confirmOverlay.addEventListener('click', (e) => {
      if (e.target === dom.confirmOverlay) closeConfirm();
    });

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal();
        closeConfirm();
      }
    });
  }

  // =============================================
  // CARGA DE DATOS
  // =============================================

  async function loadData(silent = false) {
    if (!silent) showLoading(true);
    try {
      const data = await API.getAll();
      if (!Array.isArray(data)) {
        state.medicamentos = [];
      } else {
        state.medicamentos = data;
      }
      applyFilter();
      updateStats();
      if (!silent) toast('Datos cargados correctamente', 'success');
    } catch (error) {
      console.error('Error cargando datos:', error);
      if (!silent) {
        toast('Error al cargar datos: ' + error.message, 'error');
        // Usar datos de demo solo en la primera carga si falla
        if (state.medicamentos.length === 0) {
          state.medicamentos = getDemoData();
          applyFilter();
          updateStats();
        }
      }
    } finally {
      if (!silent) showLoading(false);
    }
  }

  // =============================================
  // AUTO-REFRESH (datos en tiempo real)
  // =============================================

  function startAutoRefresh() {
    stopAutoRefresh();
    state.autoRefreshInterval = setInterval(() => {
      // No refrescar si hay modal abierto o esta cargando
      if (!dom.modalOverlay.classList.contains('active') && !state.isLoading) {
        loadData(true); // silent = true, sin spinner ni toast
      }
    }, state.AUTO_REFRESH_MS);

    // Tambien refrescar cuando la ventana vuelve a tener foco
    document.addEventListener('visibilitychange', handleVisibility);
  }

  function stopAutoRefresh() {
    if (state.autoRefreshInterval) {
      clearInterval(state.autoRefreshInterval);
      state.autoRefreshInterval = null;
    }
    document.removeEventListener('visibilitychange', handleVisibility);
  }

  function handleVisibility() {
    if (!document.hidden && !state.isLoading) {
      loadData(true);
    }
  }

  // =============================================
  // BUSQUEDA Y FILTRADO
  // =============================================

  function handleSearch() {
    state.searchTerm = dom.searchInput.value.trim().toLowerCase();
    applyFilter();
  }

  function applyFilter() {
    if (!state.searchTerm) {
      state.filteredMedicamentos = [...state.medicamentos];
    } else {
      state.filteredMedicamentos = state.medicamentos.filter((m) => {
        return (
          (m.material || '').toLowerCase().includes(state.searchTerm) ||
          (m.texto_largo_material || '').toLowerCase().includes(state.searchTerm) ||
          (m.persona_asignada || '').toLowerCase().includes(state.searchTerm)
        );
      });
    }
    renderTable();
    renderCards();
    toggleEmptyState();
  }

  // =============================================
  // RENDERIZADO
  // =============================================

  function renderTable() {
    dom.tableBody.innerHTML = state.filteredMedicamentos
      .map((m) => {
        const descDrago = calcDescuadreDrago(m);
        const descSef = calcDescuadreSef(m);
        return `
        <tr>
          <td><strong>${esc(m.material)}</strong></td>
          <td>${esc(m.texto_largo_material)}</td>
          <td>${esc(m.persona_asignada)}</td>
          <td>${formatNum(m.stock_maestro)}</td>
          <td>${formatNum(m.stock_real)}</td>
          <td>${formatNum(m.stock_cta_polivalente)}</td>
          <td>${renderDescuadreBadge(descDrago)}</td>
          <td>${esc(m.observaciones || '-')}</td>
          <td>${formatNum(m.seflogico)}</td>
          <td>${renderDescuadreBadge(descSef)}</td>
          <td>
            <div style="display:flex;gap:0.25rem;">
              <button class="btn btn-sm btn-outline" onclick="App.editMed('${esc(m.material)}')" title="Editar">&#9998;</button>
              <button class="btn btn-sm btn-danger" onclick="App.confirmDelete('${esc(m.material)}')" title="Eliminar">&#10005;</button>
            </div>
          </td>
        </tr>`;
      })
      .join('');
  }

  function renderCards() {
    dom.cardList.innerHTML = state.filteredMedicamentos
      .map((m) => {
        const descDrago = calcDescuadreDrago(m);
        const descSef = calcDescuadreSef(m);
        return `
        <div class="med-card">
          <div class="med-card-header">
            <div>
              <div class="med-card-code">${esc(m.material)}</div>
              <div class="med-card-name">${esc(m.texto_largo_material)}</div>
            </div>
          </div>
          <div class="med-card-body">
            <div class="med-card-field">
              <span class="med-card-label">Responsable</span>
              <span class="med-card-value">${esc(m.persona_asignada)}</span>
            </div>
            <div class="med-card-field">
              <span class="med-card-label">Stock Maestro</span>
              <span class="med-card-value">${formatNum(m.stock_maestro)}</span>
            </div>
            <div class="med-card-field">
              <span class="med-card-label">Stock Real</span>
              <span class="med-card-value">${formatNum(m.stock_real)}</span>
            </div>
            <div class="med-card-field">
              <span class="med-card-label">Stock Cta Poliv.</span>
              <span class="med-card-value">${formatNum(m.stock_cta_polivalente)}</span>
            </div>
            <div class="med-card-field">
              <span class="med-card-label">Desc. Dragofarma</span>
              <span class="med-card-value">${renderDescuadreBadge(descDrago)}</span>
            </div>
            <div class="med-card-field">
              <span class="med-card-label">Seflogico</span>
              <span class="med-card-value">${formatNum(m.seflogico)}</span>
            </div>
            <div class="med-card-field">
              <span class="med-card-label">Desc. Seflogic</span>
              <span class="med-card-value">${renderDescuadreBadge(descSef)}</span>
            </div>
            ${m.observaciones ? `
            <div class="med-card-field full-width">
              <span class="med-card-label">Observaciones</span>
              <span class="med-card-value">${esc(m.observaciones)}</span>
            </div>` : ''}
          </div>
          <div class="med-card-actions">
            <button class="btn btn-sm btn-outline" onclick="App.editMed('${esc(m.material)}')">&#9998; Editar</button>
            <button class="btn btn-sm btn-danger" onclick="App.confirmDelete('${esc(m.material)}')">&#10005; Eliminar</button>
          </div>
        </div>`;
      })
      .join('');
  }

  function toggleEmptyState() {
    if (state.filteredMedicamentos.length === 0) {
      dom.emptyState.style.display = 'block';
      dom.tableContainer.style.display = 'none';
      dom.cardList.style.display = 'none';
    } else {
      dom.emptyState.style.display = 'none';
      dom.tableContainer.style.display = '';
      dom.cardList.style.display = '';
    }
  }

  // =============================================
  // ESTADISTICAS
  // =============================================

  function updateStats() {
    const total = state.medicamentos.length;
    let sinDesc = 0;
    let conDesc = 0;
    let pendientes = 0;

    state.medicamentos.forEach((m) => {
      const desc = calcDescuadreDrago(m);
      if (desc === 0) sinDesc++;
      else conDesc++;

      if (m.stock_real === null || m.stock_real === undefined || m.stock_real === '') {
        pendientes++;
      }
    });

    dom.statTotal.textContent = total;
    dom.statSinDescuadre.textContent = sinDesc;
    dom.statConDescuadre.textContent = conDesc;
    dom.statPendientes.textContent = pendientes;
  }

  // =============================================
  // CALCULOS DE DESCUADRE
  // =============================================

  function calcDescuadreDrago(med) {
    const maestro = parseFloat(med.stock_maestro) || 0;
    const real = parseFloat(med.stock_real) || 0;
    return round(real - maestro);
  }

  function calcDescuadreSef(med) {
    const descDrago = calcDescuadreDrago(med);
    const sef = parseFloat(med.seflogico) || 0;
    return round(descDrago - sef);
  }

  function recalcDescuadres() {
    const maestro = parseFloat(dom.fStockMaestro.value) || 0;
    const real = parseFloat(dom.fStockReal.value) || 0;
    const sef = parseFloat(dom.fSeflogico.value) || 0;

    const descDrago = round(real - maestro);
    const descSef = round(descDrago - sef);

    dom.fDescuadreDrago.value = descDrago;
    dom.fDescuadreSef.value = descSef;

    applyFieldColor(dom.fDescuadreDrago, descDrago);
    applyFieldColor(dom.fDescuadreSef, descSef);
  }

  function applyFieldColor(input, value) {
    input.classList.remove('is-negative', 'is-positive', 'is-zero');
    if (value < 0) input.classList.add('is-negative');
    else if (value > 0) input.classList.add('is-positive');
    else input.classList.add('is-zero');
  }

  // =============================================
  // MODAL: CREAR / EDITAR
  // =============================================

  function openCreateModal() {
    state.editingMaterial = null;
    dom.modalTitle.textContent = 'Nuevo Medicamento';
    dom.form.reset();
    dom.fMaterial.removeAttribute('readonly');
    dom.fDescuadreDrago.value = '0';
    dom.fDescuadreSef.value = '0';
    applyFieldColor(dom.fDescuadreDrago, 0);
    applyFieldColor(dom.fDescuadreSef, 0);
    dom.modalOverlay.classList.add('active');
    dom.fMaterial.focus();
  }

  function editMed(material) {
    const med = state.medicamentos.find((m) => m.material === material);
    if (!med) {
      toast('Medicamento no encontrado', 'error');
      return;
    }

    state.editingMaterial = material;
    dom.modalTitle.textContent = 'Editar Medicamento';
    dom.fMaterial.value = med.material;
    dom.fMaterial.setAttribute('readonly', true);
    dom.fTextoLargo.value = med.texto_largo_material || '';
    dom.fPersona.value = med.persona_asignada || '';
    dom.fStockMaestro.value = med.stock_maestro ?? '';
    dom.fStockReal.value = med.stock_real ?? '';
    dom.fStockCta.value = med.stock_cta_polivalente ?? '';
    dom.fObservaciones.value = med.observaciones || '';
    dom.fSeflogico.value = med.seflogico ?? '';

    recalcDescuadres();
    dom.modalOverlay.classList.add('active');
    dom.fTextoLargo.focus();
  }

  function closeModal() {
    dom.modalOverlay.classList.remove('active');
    state.editingMaterial = null;
  }

  // =============================================
  // GUARDAR (CREATE / UPDATE)
  // =============================================

  async function handleSave() {
    const material = dom.fMaterial.value.trim();
    if (!material) {
      toast('El codigo de material es obligatorio', 'error');
      dom.fMaterial.focus();
      return;
    }

    const data = {
      material: material,
      texto_largo_material: dom.fTextoLargo.value.trim(),
      persona_asignada: dom.fPersona.value.trim(),
      stock_maestro: parseFloat(dom.fStockMaestro.value) || 0,
      stock_real: parseFloat(dom.fStockReal.value) || 0,
      stock_cta_polivalente: parseFloat(dom.fStockCta.value) || 0,
      descuadre_dragofarma: parseFloat(dom.fDescuadreDrago.value) || 0,
      observaciones: dom.fObservaciones.value.trim(),
      seflogico: parseFloat(dom.fSeflogico.value) || 0,
      descuadre_seflogic: parseFloat(dom.fDescuadreSef.value) || 0,
    };

    showLoading(true);
    try {
      if (state.editingMaterial) {
        await API.update(state.editingMaterial, data);
        toast('Medicamento actualizado correctamente', 'success');
      } else {
        await API.create(data);
        toast('Medicamento creado correctamente', 'success');
      }
      closeModal();
      await loadData();
    } catch (error) {
      console.error('Error guardando:', error);
      toast('Error al guardar: ' + error.message, 'error');

      // Simulacion local si falla n8n
      if (state.editingMaterial) {
        const idx = state.medicamentos.findIndex((m) => m.material === state.editingMaterial);
        if (idx !== -1) state.medicamentos[idx] = data;
      } else {
        state.medicamentos.push(data);
      }
      applyFilter();
      updateStats();
      closeModal();
    } finally {
      showLoading(false);
    }
  }

  // =============================================
  // ELIMINAR
  // =============================================

  let pendingDeleteMaterial = null;

  function confirmDelete(material) {
    pendingDeleteMaterial = material;
    const med = state.medicamentos.find((m) => m.material === material);
    dom.confirmText.textContent = `¿Eliminar "${med ? med.texto_largo_material || material : material}"?`;
    dom.confirmOverlay.classList.add('active');
    dom.confirmYes.onclick = doDelete;
  }

  async function doDelete() {
    closeConfirm();
    if (!pendingDeleteMaterial) return;

    showLoading(true);
    try {
      await API.remove(pendingDeleteMaterial);
      toast('Medicamento eliminado', 'success');
      await loadData();
    } catch (error) {
      console.error('Error eliminando:', error);
      toast('Error al eliminar: ' + error.message, 'error');

      // Simulacion local
      state.medicamentos = state.medicamentos.filter(
        (m) => m.material !== pendingDeleteMaterial
      );
      applyFilter();
      updateStats();
    } finally {
      showLoading(false);
      pendingDeleteMaterial = null;
    }
  }

  function closeConfirm() {
    dom.confirmOverlay.classList.remove('active');
  }

  // =============================================
  // UI HELPERS
  // =============================================

  function showLoading(show) {
    state.isLoading = show;
    if (show) dom.loadingOverlay.classList.add('active');
    else dom.loadingOverlay.classList.remove('active');
  }

  function toast(message, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    dom.toastContainer.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity 0.3s';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 300);
    }, 3500);
  }

  function renderDescuadreBadge(value) {
    if (value === 0) {
      return '<span class="badge-descuadre badge-ok">0 (OK)</span>';
    } else if (value < 0) {
      return `<span class="badge-descuadre badge-negative">${formatNum(value)}</span>`;
    } else {
      return `<span class="badge-descuadre badge-positive">+${formatNum(value)}</span>`;
    }
  }

  function formatNum(val) {
    const n = parseFloat(val);
    if (isNaN(n)) return '-';
    return n % 1 === 0 ? n.toString() : n.toFixed(2);
  }

  function round(val) {
    return Math.round(val * 100) / 100;
  }

  function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // =============================================
  // DATOS DE DEMO (para pruebas sin n8n)
  // =============================================

  function getDemoData() {
    return [
      {
        material: 'MED001',
        texto_largo_material: 'Paracetamol 500mg comprimidos',
        persona_asignada: 'Dr. Garcia',
        stock_maestro: 150,
        stock_real: 148,
        stock_cta_polivalente: 20,
        observaciones: 'Revisar caducidad lote B',
        seflogico: -1,
      },
      {
        material: 'MED002',
        texto_largo_material: 'Ibuprofeno 600mg comprimidos',
        persona_asignada: 'Dra. Martinez',
        stock_maestro: 200,
        stock_real: 200,
        stock_cta_polivalente: 30,
        observaciones: '',
        seflogico: 0,
      },
      {
        material: 'MED003',
        texto_largo_material: 'Amoxicilina 500mg capsulas',
        persona_asignada: 'Dr. Lopez',
        stock_maestro: 80,
        stock_real: 85,
        stock_cta_polivalente: 10,
        observaciones: 'Excedente del pedido anterior',
        seflogico: 3,
      },
      {
        material: 'MED004',
        texto_largo_material: 'Omeprazol 20mg capsulas',
        persona_asignada: 'Dr. Garcia',
        stock_maestro: 300,
        stock_real: 280,
        stock_cta_polivalente: 0,
        observaciones: 'Posible error en dispensacion',
        seflogico: -15,
      },
    ];
  }

  // =============================================
  // API PUBLICA
  // =============================================

  return {
    init,
    editMed,
    confirmDelete,
  };
})();

// Inicializar cuando el DOM este listo
document.addEventListener('DOMContentLoaded', App.init);
