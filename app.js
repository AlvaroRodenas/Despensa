document.addEventListener("DOMContentLoaded", () => {
  const isGitHub = location.hostname.includes("github.io");
  const API_BASE = isGitHub
    ? "https://cookie-responding-equipment-graphical.trycloudflare.com/webhook/api/despensa"
    : "http://192.168.1.40:5678/webhook/api/despensa";

  // Botones principales
  const btnScan = document.getElementById("btn-scan");
  const btnList = document.getElementById("btn-list");
  const inventoryBody = document.getElementById("inventory-body");

  // Filtros y búsqueda
  const btnFilterAll = document.getElementById("filter-all");
  const btnFilterStock = document.getElementById("filter-stock");
  const btnFilterExpiry = document.getElementById("filter-expiry");
  const searchInput = document.getElementById("search-input");
  const searchClear = document.getElementById("search-clear");

  // Modal
  const scanModal = document.getElementById("scan-modal");
  const scanClose = document.getElementById("scan-close");
  const scanAdd = document.getElementById("scan-add");

  // Campos del modal
  const scanImg = document.getElementById("scan-img");
  const scanName = document.getElementById("scan-name");
  const scanBrand = document.getElementById("scan-brand");
  const scanCategory = document.getElementById("scan-category");
  const scanFormato = document.getElementById("scan-formato");
  const scanCantidad = document.getElementById("scan-cantidad");
  const scanUbicacion = document.getElementById("scan-ubicacion");
  const scanCaducidad = document.getElementById("scan-caducidad");

  // Loader y toast
  const loader = document.getElementById("loader");
  const toast = document.getElementById("toast");

  // Input de código de barras
  const barcodeInput = document.getElementById("barcode-input");

  // Variables globales
  let currentFilter = "all";
  let currentSearch = "";

  // --- Utilidades ---
  function showLoader(show) {
    loader.classList.toggle("hidden", !show);
    loader.classList.toggle("flex", show);
  }
  function showToast(msg) {
    toast.querySelector("div").textContent = msg;
    toast.classList.remove("hidden");
    setTimeout(() => toast.classList.add("hidden"), 3000);
  }
  function setActiveFilter(activeBtn) {
    [btnFilterAll, btnFilterStock, btnFilterExpiry].forEach(btn => {
      btn.classList.remove("ring-2", "ring-offset-2", "ring-green-500");
    });
    activeBtn.classList.add("ring-2", "ring-offset-2", "ring-green-500");
  }

  // --- Enriquecer producto con campos calculados ---
  function enrichProducto(p) {
    const hoy = new Date();
    const cad = p.Caducidad ? new Date(p.Caducidad) : null;
    const dias = cad ? Math.ceil((cad - hoy) / (1000 * 60 * 60 * 24)) : "";

    return {
      ...p,
      StockBajo: Number(p.Cantidad) <= Number(p.minStock || 0),
      DiasHastaCaducidad: dias
    };
  }
  // --- Escanear producto ---
  async function scan() {
    try {
      showLoader(true);
      const codigo = barcodeInput?.value.trim() || "8480000109088";
      const res = await fetch(`${API_BASE}/producto/scan?codigo_barras=${codigo}`);
      if (!res.ok) throw new Error("Error en la API /scan");
      const data = await res.json();

      // Rellenar modal
      scanImg.src = data.imagen || "";
      scanName.textContent = data.nombre || "Sin nombre";
      scanBrand.textContent = data.marca || "";
      scanCategory.textContent = data.categoria || "";
      scanFormato.value = data.cantidad || "";
      scanCantidad.value = 1;
      scanUbicacion.value = "";
      scanCaducidad.value = "";

      scanModal.dataset.codigo = data.codigo_barras || codigo;

      await listAlmacenes("scan-ubicacion");

      scanModal.classList.remove("hidden");
      scanModal.classList.add("flex");
    } catch (err) {
      console.error(err);
      showToast("Error al escanear producto");
    } finally {
      showLoader(false);
    }
  }

  // --- Listar inventario ---
  async function list(filter = currentFilter) {
    try {
      showLoader(true);
      currentFilter = filter;
      const res = await fetch(`${API_BASE}/producto/list?filter=${filter}`);
      if (!res.ok) throw new Error("Error en la API /list");
      const data = await res.json();

      inventoryBody.innerHTML = "";
      const items = (data.items || []).map(enrichProducto);

      if (items.length === 0) {
        inventoryBody.innerHTML = `
          <tr>
            <td colspan="6" class="px-4 py-3 text-center text-gray-400">
              No hay productos en el inventario
            </td>
          </tr>`;
        return;
      }

      items.forEach(prod => {
        const tr = document.createElement("tr");
        tr.dataset.productoId = prod.ProductoID; // clave estable

        if (prod.StockBajo === true) {
          tr.className = "bg-yellow-50 hover:bg-yellow-100";
        } else if (prod.DiasHastaCaducidad !== "" && Number(prod.DiasHastaCaducidad) <= 3) {
          tr.className = "bg-red-50 hover:bg-red-100";
        } else {
          tr.className = "hover:bg-gray-50";
        }

        tr.innerHTML = `
          <td class="px-4 py-3 flex items-center gap-2">
            ${prod.Imagen ? `<img src="${prod.Imagen}" class="w-10 h-10 object-cover rounded" />` : ""}
            ${prod.Nombre || "-"}
          </td>
          <td class="px-4 py-3">${prod.Formato || "-"}</td>
          <td class="px-4 py-3">${prod.Cantidad || "-"}</td>
          <td class="px-4 py-3">${prod.Caducidad || "-"}</td>
          <td class="px-4 py-3">${prod.AlmacenNombre || "-"}</td>
          <td class="px-4 py-3">${prod.StockBajo === true ? "⚠️ Sí" : "No"}</td>
        `;
        inventoryBody.appendChild(tr);
      });

      applySearch();
    } catch (err) {
      console.error(err);
      showToast("Error al listar inventario");
    } finally {
      showLoader(false);
    }
  }

  // --- Búsqueda ---
  function applySearch() {
    currentSearch = searchInput.value.trim().toLowerCase();
    const rows = inventoryBody.querySelectorAll("tr");
    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(currentSearch) ? "" : "none";
    });
  }
  // --- Guardar producto desde modal ---
  async function addProduct() {
    try {
      if (!scanCantidad.value || scanCantidad.value <= 0) {
        showToast("La cantidad debe ser mayor que 0");
        return;
      }
      if (!scanCaducidad.value) {
        showToast("Debes indicar una fecha de caducidad");
        return;
      }

      showLoader(true);

      const body = {
        Nombre: scanName.textContent || "",
        Formato: scanFormato.value || "",
        Cantidad: Number(scanCantidad.value) || 1,
        Caducidad: scanCaducidad.value || "",
        AlmacenID: scanUbicacion.value || "",   // usamos AlmacenID
        minStock: 1,
        Marca: scanBrand.textContent || "",
        barCode: scanModal.dataset.codigo || "",
        Imagen: scanImg.src || ""
      };

      const res = await fetch(`${API_BASE}/producto/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (!res.ok) throw new Error("Error en la API /producto/add");

      showToast("Producto añadido correctamente");

      // Cerrar modal
      scanModal.classList.add("hidden");
      scanModal.classList.remove("flex");

      // Refrescar listado
      await list(currentFilter);

    } catch (err) {
      console.error(err);
      showToast("Error al añadir producto");
    } finally {
      showLoader(false);
    }
  }

  // --- Listar almacenes en <select> ---
  async function listAlmacenes(selectId)
