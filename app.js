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
  const dias = cad ? Math.ceil((cad - hoy) / (1000 * 60 * 60 * 24)) : null;

  const minStock = Number(p.minStock ?? 1);

  return {
    ...p,
    StockBajo: Number(p.Cantidad) < minStock,
    DiasHastaCaducidad: dias
  };
}

// --- Aplicar filtros en frontend ---
function applyFilter(items, filter) {
  switch (filter) {
    case "stock":
      // Solo productos con stock actual por debajo del mínimo
      return items.filter(p => p.StockBajo === true);

    case "expiry":
      // Solo productos con fecha válida y que caducan en ≤ 7 días
      return items.filter(p =>
        p.DiasHastaCaducidad !== null &&
        !isNaN(p.DiasHastaCaducidad) &&
        p.DiasHastaCaducidad <= 7
      );

    case "all":
    default:
      return items;
  }
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

    // Enriquecer productos
    let items = (data.items || []).map(enrichProducto);

    // Aplicar filtro en frontend
    items = applyFilter(items, filter);

    // Limpiar tabla
    inventoryBody.innerHTML = "";

    // Si no hay resultados
    if (items.length === 0) {
      inventoryBody.innerHTML = `
        <tr>
          <td colspan="6" class="px-4 py-3 text-center text-gray-400">
            No hay productos en el inventario
          </td>
        </tr>`;
      return;
    }
    
    //formato visible fecha dd/mm/aaaa
function formatFecha(fechaISO) {
  if (!fechaISO) return "-";
  const d = new Date(fechaISO);
  if (isNaN(d)) return "-";
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const año = d.getFullYear();
  return `${dia}/${mes}/${año}`;
}

    // Pintar filas
    items.forEach(prod => {
      const tr = document.createElement("tr");
      tr.dataset.productoId = prod.ProductoID; // clave estable
      tr.dataset.minstock = prod.minStock ?? 1;
      
      if (prod.StockBajo === true) {
        tr.className = "bg-yellow-50 hover:bg-yellow-100";
      } else if (
        prod.DiasHastaCaducidad !== null &&
        !isNaN(prod.DiasHastaCaducidad) &&
        prod.DiasHastaCaducidad <= 3
      ) {
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
        <td class="px-4 py-3">${formatFecha(prod.Caducidad)}</td>
        <td class="px-4 py-3">${prod.AlmacenNombre || "-"}</td>
        <td class="px-4 py-3">${prod.StockBajo === true ? "⚠️ Sí" : "No"}</td>
      `;
      inventoryBody.appendChild(tr);
    });

    // Aplicar búsqueda
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
    const nombre = document.getElementById("scan-nombre").value.trim();
    const formato = document.getElementById("scan-formato").value.trim();
    const cantidad = Number(document.getElementById("scan-cantidad").value);
    const caducidad = document.getElementById("scan-caducidad").value;
    const ubicacion = document.getElementById("scan-ubicacion").value;
    const minStock = Number(document.getElementById("scan-minstock")?.value) || 1;
    const marca = document.getElementById("scan-brand").value.trim();
    const barCode = document.getElementById("scan-barcode").value.trim();
    const imagen = document.getElementById("scan-img").src || "";

    // 🔎 Validaciones
    if (!nombre) {
      showToast("El nombre no puede estar vacío");
      return;
    }
    if (isNaN(cantidad) || cantidad <= 0) {
      showToast("La cantidad debe ser mayor que 0");
      return;
    }
    if (isNaN(minStock) || minStock < 0) {
      showToast("El stock mínimo no puede ser negativo");
      return;
    }
    if (!caducidad) {
      showToast("Debes indicar una fecha de caducidad");
      return;
    }
    if (caducidad && isNaN(new Date(caducidad))) {
      showToast("La fecha de caducidad no es válida");
      return;
    }

    showLoader(true);

    // Normalizar fecha a ISO (yyyy-mm-dd)
    const caducidadISO = caducidad
      ? new Date(caducidad).toISOString().split("T")[0]
      : "";

    const body = {
      Nombre: nombre,
      Formato: formato || "-",
      Cantidad: cantidad,
      Caducidad: caducidadISO,
      AlmacenID: ubicacion || "-",
      minStock,
      Marca: marca || "-",
      barCode: barCode || "", // puede venir de escaneo, tecleo o vacío
      Imagen: imagen
    };

    const res = await fetch(`${API_BASE}/producto/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error("Error en la API /producto/add");

    showToast("Producto añadido correctamente");

    // Cerrar modal
    document.getElementById("scan-modal").classList.add("hidden");
    document.getElementById("scan-modal").classList.remove("flex");

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
  async function listAlmacenes(selectId = "scan-ubicacion") {
    try {
      showLoader(true);
      const res = await fetch(`${API_BASE}/almacen/list`);
      if (!res.ok) throw new Error("Error en la API /almacen/list");
      const data = await res.json();

      const select = document.getElementById(selectId);
      if (select) {
        select.innerHTML = "";
        (data.items || []).forEach(al => {
          const opt = document.createElement("option");
          opt.value = al.AlmacenID;   // usamos AlmacenID
          opt.textContent = al.Nombre;
          select.appendChild(opt);
        });
      }
    } catch (err) {
      console.error(err);
      showToast("Error al listar almacenes");
    } finally {
      showLoader(false);
    }
  }

  // --- Modificar producto ---
  async function modProduct(datos) {
    try {
      showLoader(true);
      const body = {
        ProductoID: datos.ProductoID,
        Nombre: datos.Nombre,
        Formato: datos.Formato,
        Cantidad: datos.Cantidad,
        Caducidad: datos.Caducidad,
        AlmacenID: datos.AlmacenID,
        minStock: datos.minStock ?? 1,
        Marca: datos.Marca || "",
        barCode: datos.barCode || "",
        Imagen: datos.Imagen || ""
      };

      const res = await fetch(`${API_BASE}/producto/mod`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error("Error en la API /producto/mod");

      showToast("Producto modificado correctamente");
      await list(currentFilter);

      // Cerrar modal de edición
      const editModal = document.getElementById("edit-modal");
      editModal.classList.add("hidden");
      editModal.classList.remove("flex");
    } catch (err) {
      console.error(err);
      showToast("Error al modificar producto");
    } finally {
      showLoader(false);
    }
  }

  // --- Eliminar producto ---
  async function delProduct(productoId) {
    try {
      showLoader(true);
      const body = { ProductoID: productoId };
      const res = await fetch(`${API_BASE}/producto/del`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error("Error en la API /producto/del");

      showToast("Producto eliminado correctamente");
      await list(currentFilter);
    } catch (err) {
      console.error(err);
      showToast("Error al eliminar producto");
    } finally {
      showLoader(false);
    }
  }

  // --- Eventos de edición ---
  inventoryBody.addEventListener("click", async (e) => {
    const tr = e.target.closest("tr");
    if (!tr) return;
    const productoId = tr.dataset.productoId;
    if (!productoId) return;

    // Rellenar campos con los datos de la fila
    document.getElementById("edit-nombre").value = tr.querySelector("td:nth-child(1)").innerText.trim();
    document.getElementById("edit-formato").value = tr.querySelector("td:nth-child(2)").innerText.trim();
    document.getElementById("edit-cantidad").value = tr.querySelector("td:nth-child(3)").innerText.trim();
    document.getElementById("edit-minstock").value = tr.dataset.minstock || 1;
    const caducidadTexto = tr.querySelector("td:nth-child(4)").innerText.trim();
    let caducidadISO = "";
    if (caducidadTexto) {
      const partes = caducidadTexto.split(/[\/\-]/); // admite / o -
      if (partes.length === 3) {
        // suponiendo formato dd/mm/yyyy
        caducidadISO = `${partes[2]}-${partes[1].padStart(2,"0")}-${partes[0].padStart(2,"0")}`;
      }
    }
    document.getElementById("edit-caducidad").value = caducidadISO;


    // Guardar ProductoID en dataset del modal
    const editModal = document.getElementById("edit-modal");
    editModal.dataset.productoId = productoId;

    // Rellenar select de almacenes
    await listAlmacenes("edit-ubicacion");

    // Seleccionar el almacén actual
    const ubicacion = tr.querySelector("td:nth-child(5)").innerText.trim();
    const select = document.getElementById("edit-ubicacion");
    const option = [...select.options].find(opt => opt.textContent === ubicacion);
    if (option) select.value = option.value;

    // Mostrar modal
    editModal.classList.remove("hidden");
    editModal.classList.add("flex");
  });

  document.getElementById("edit-close").addEventListener("click", () => {
    const editModal = document.getElementById("edit-modal");
    editModal.classList.add("hidden");
    editModal.classList.remove("flex");
  });

  document.getElementById("edit-save").addEventListener("click", async () => {
    const editModal = document.getElementById("edit-modal");
    const productoId = editModal.dataset.productoId;
    const caducidadInput = document.getElementById("edit-caducidad").value;
    
    const datos = {
      ProductoID: productoId,
      Nombre: document.getElementById("edit-nombre").value,
      Formato: document.getElementById("edit-formato").value,
      Cantidad: document.getElementById("edit-cantidad").value || 1,
      Caducidad: caducidadInput
      ? new Date(caducidadInput).toISOString().split("T")[0]
      : "",
      AlmacenID: document.getElementById("edit-ubicacion").value,
      minStock: Number(document.getElementById("edit-minstock").value) || 1
    };
    
    await modProduct(datos);
  
  });

  document.getElementById("edit-delete").addEventListener("click", async () => {
    const editModal = document.getElementById("edit-modal");
    const productoId = editModal.dataset.productoId;
    if (confirm("¿Seguro que quieres eliminar este producto?")) {
      await delProduct(productoId);
      editModal.classList.add("hidden");
      editModal.classList.remove("flex");
    }
  });

  // --- Almacenes: añadir, modificar, eliminar ---
  async function addAlmacen(nombre) {
    try {
      showLoader(true);
      const body = { Nombre: nombre };
      const res = await fetch(`${API_BASE}/almacen/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error("Error en la API /almacen/add");
      showToast("Almacén añadido correctamente");
      await listAlmacenes();
    } catch (err) {
      console.error(err);
      showToast("Error al añadir almacén");
    } finally {
      showLoader(false);
    }
  }

  async function modAlmacen(almacenId, nuevoNombre) {
    try {
      showLoader(true);
      const body = { AlmacenID: almacenId, Nombre: nuevoNombre };
      const res = await fetch(`${API_BASE}/almacen/mod`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error("Error en la API /almacen/mod");
      showToast("Almacén modificado correctamente");
      await listAlmacenes();
    } catch (err) {
      console.error(err);
      showToast("Error al modificar almacén");
    } finally {
      showLoader(false);
    }
  }

  async function delAlmacen(almacenId) {
    try {
      showLoader(true);
      const body = { AlmacenID: almacenId };
      const res = await fetch(`${API_BASE}/almacen/del`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error("Error en la API /almacen/del");
      showToast("Almacén eliminado correctamente");
      await listAlmacenes();
    } catch (err) {
      console.error(err);
      showToast("Error al eliminar almacén");
    } finally {
      showLoader(false);
    }
  }
  /*modal almacenes*/
  async function renderAlmacenes() {
  try {
    showLoader(true);
    const res = await fetch(`${API_BASE}/almacen/list`);
    if (!res.ok) throw new Error("Error en la API /almacen/list");
    const data = await res.json();

    const ul = document.getElementById("almacen-list");
    ul.innerHTML = "";

    (data.items || []).forEach(al => {
      const li = document.createElement("li");
      li.className = "flex justify-between items-center border px-2 py-1 rounded";
      li.innerHTML = `
        <span>${al.Nombre}</span>
        <div class="flex gap-2">
          <button class="text-blue-600" data-id="${al.AlmacenID}" data-action="edit">✏️</button>
          <button class="text-red-600" data-id="${al.AlmacenID}" data-action="delete">🗑️</button>
        </div>
      `;
      ul.appendChild(li);
    });
  } catch (err) {
    console.error(err);
    showToast("Error al listar almacenes");
  } finally {
    showLoader(false);
  }
}


  // --- Eventos principales ---
  btnScan.addEventListener("click", scan);
  btnList.addEventListener("click", () => { list("all"); setActiveFilter(btnFilterAll); });
  btnFilterAll.addEventListener("click", () => { list("all"); setActiveFilter(btnFilterAll); });
  btnFilterStock.addEventListener("click", () => { list("stock"); setActiveFilter(btnFilterStock); });
  btnFilterExpiry.addEventListener("click", () => { list("expiry"); setActiveFilter(btnFilterExpiry); });
  searchInput.addEventListener("input", applySearch);
  searchClear.addEventListener("click", () => { searchInput.value = ""; applySearch(); });
  scanClose.addEventListener("click", () => { scanModal.classList.add("hidden"); scanModal.classList.remove("flex"); });
  scanAdd.addEventListener("click", addProduct);
  // --- Eventos de gestión de almacenes ---
document.getElementById("btn-almacenes").addEventListener("click", async () => {
  await renderAlmacenes();
  document.getElementById("almacen-modal").classList.remove("hidden");
  document.getElementById("almacen-modal").classList.add("flex");
});

document.getElementById("almacen-close").addEventListener("click", () => {
  document.getElementById("almacen-modal").classList.add("hidden");
  document.getElementById("almacen-modal").classList.remove("flex");
});

document.getElementById("almacen-add").addEventListener("click", async () => {
  const nombre = document.getElementById("almacen-nombre").value.trim();
  if (!nombre) return;
  await addAlmacen(nombre);
  document.getElementById("almacen-nombre").value = "";
  await renderAlmacenes();
});

document.getElementById("almacen-list").addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;

  if (action === "edit") {
    const nuevoNombre = prompt("Nuevo nombre del almacén:");
    if (nuevoNombre) {
      await modAlmacen(id, nuevoNombre);
      await renderAlmacenes();
    }
  } else if (action === "delete") {
    if (confirm("¿Eliminar este almacén?")) {
      await delAlmacen(id);
      await renderAlmacenes();
    }
  }
});


  // --- Inicialización ---
  list("all");
});













