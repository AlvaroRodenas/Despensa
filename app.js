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
  const barcodeInput = document.getElementById("scan-barcode");

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
// --- Utilidades para modales con animación ---
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove("hidden");
    modal.classList.add("flex");

    // Animación de entrada
    modal.classList.remove("opacity-0", "translate-y-4");
    modal.classList.add("opacity-100", "translate-y-0");
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    // Animación de salida
    modal.classList.remove("opacity-100", "translate-y-0");
    modal.classList.add("opacity-0", "translate-y-4");

    // Esperar a que termine la animación antes de ocultar
    setTimeout(() => {
      modal.classList.add("hidden");
      modal.classList.remove("flex");
    }, 200); // ajusta el tiempo a la duración de tu transición en CSS
  }
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
async function iniciarEscaneo() {
  // Aquí iría la integración con tu librería de escaneo (ej. QuaggaJS, ZXing, etc.)
  // De momento, para pruebas, puedes simular un código fijo:
  return "8480000109088";
}

  // --- Escanear producto (adaptado al nuevo modal) ---
// --- Escanear producto (adaptado al nuevo modal) ---
async function scan() {
  try {
    showLoader(true);

    // Leer código desde input principal o del modal
    const codigo = document.getElementById("scan-barcode")?.value.trim();

    if (!codigo) {
      showToast("Introduce o escanea un código de barras");
      return;
    }

    const res = await fetch(`${API_BASE}/producto/scan?codigo_barras=${codigo}`);
    if (!res.ok) throw new Error("Error en la API /scan");
    const data = await res.json();

    // Rellenar modal con datos de la API
    const scanImg = document.getElementById("scan-img");
    scanImg.src = data.imagen || "";
    scanImg.classList.toggle("hidden", !data.imagen);

    document.getElementById("scan-nombre").value = data.nombre || "";
    document.getElementById("scan-brand").value = data.marca || "";
    document.getElementById("scan-formato").value = data.cantidad || "";
    document.getElementById("scan-cantidad").value = 1;
    document.getElementById("scan-ubicacion").value = "";
    document.getElementById("scan-caducidad").value = "";

    // Guardar el código en dataset y en el input
    scanModal.dataset.codigo = data.codigo_barras || codigo;
    document.getElementById("scan-barcode").value = data.codigo_barras || codigo;

    await listAlmacenes("scan-ubicacion");

    // Mostrar modal
    openModal("scan-modal");

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

    // Validaciones
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
      barCode: barCode || "",
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
    closeModal("scan-modal");

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
    // Validaciones
    if (!datos.Nombre || !datos.Nombre.trim()) {
      showToast("El nombre no puede estar vacío");
      return;
    }
    if (isNaN(datos.Cantidad) || datos.Cantidad <= 0) {
      showToast("La cantidad debe ser mayor que 0");
      return;
    }
    if (isNaN(datos.minStock) || datos.minStock < 0) {
      showToast("El stock mínimo no puede ser negativo");
      return;
    }
    if (datos.Caducidad && isNaN(new Date(datos.Caducidad))) {
      showToast("La fecha de caducidad no es válida");
      return;
    }

    // Normalizar fecha
    const caducidadISO = datos.Caducidad
      ? new Date(datos.Caducidad).toISOString().split("T")[0]
      : "";

    const body = {
      ProductoID: datos.ProductoID,
      Nombre: datos.Nombre.trim(),
      Formato: datos.Formato?.trim() || "-",
      Cantidad: Number(datos.Cantidad),
      Caducidad: caducidadISO,
      AlmacenID: datos.AlmacenID || "-",
      minStock: Number(datos.minStock) || 1
    };

    const res = await fetch(`${API_BASE}/producto/mod`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error("Error en la API /producto/mod");

    showToast("Producto modificado correctamente");

    // Refrescar listado
    await list(currentFilter);

    // Cerrar modal de edición
    closeModal("edit-modal");


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

// Mostrar modal de edición
openModal("edit-modal");

});
// Cerrar modal
document.getElementById("edit-close").addEventListener("click", () => {
  closeModal("edit-modal");
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
      openModal("edit-modal");
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

async function modAlmacen(id) {
  try {
    const nombre = prompt("Nuevo nombre del almacén:");
    if (!nombre) return;

    const res = await fetch(`${API_BASE}/almacen/mod`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ almacenID, Nombre })
    });

    if (!res.ok) throw new Error("Error al modificar almacén");

    showToast("Almacén actualizado");

    // Refrescar UI
    await renderAlmacenes("almacen-list");
    await listAlmacenes("scan-ubicacion");
    await listAlmacenes("edit-ubicacion");

  } catch (err) {
    console.error(err);
    showToast("No se pudo modificar el almacén");
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

    // Refrescar UI en todos los sitios
    await renderAlmacenes("almacen-list");
    await listAlmacenes("scan-ubicacion");
    await listAlmacenes("edit-ubicacion");

  } catch (err) {
    console.error(err);
    showToast("Error al eliminar almacén");
  } finally {
    showLoader(false);
  }
}

 /* Modal almacenes*/
  async function renderAlmacenes(targetId) {
  const contenedor = document.getElementById(targetId);

  // Mostrar mensaje de carga inmediatamente
  contenedor.innerHTML = `<div class="p-2 text-gray-500">Cargando...</div>`;

  try {
    const res = await fetch(`${API_BASE}/almacen/list`);
    if (!res.ok) throw new Error("Error al cargar almacenes");
    const data = await res.json();

    contenedor.innerHTML = data.map(a => `
      <div class="flex items-center justify-between p-2 border-b">
        <span>${a.nombre}</span>
        <div class="flex gap-2">
          <button class="px-2 py-1 bg-yellow-400 text-white rounded edit-almacen" data-id="${a.id}">✏️</button>
          <button class="px-2 py-1 bg-red-500 text-white rounded del-almacen" data-id="${a.id}">🗑️</button>
        </div>
      </div>
    `).join("");

    // enganchar listeners aquí…

  } catch (err) {
    console.error(err);
    contenedor.innerHTML = `<div class="p-2 text-red-500">Error al cargar almacenes</div>`;
  }
}


  // --- Eventos principales ---
  btnScan.addEventListener("click", () => {
  // Limpiar campos del modal de alta
  document.getElementById("scan-barcode").value = "";
  document.getElementById("scan-nombre").value = "";
  document.getElementById("scan-brand").value = "";
  document.getElementById("scan-formato").value = "";
  document.getElementById("scan-cantidad").value = 1;
  document.getElementById("scan-ubicacion").value = "";
  document.getElementById("scan-caducidad").value = "";
  document.getElementById("scan-img").src = "";
  document.getElementById("scan-img").classList.add("hidden");

  // Abrir modal de alta
  openModal("scan-modal");
});
 document.getElementById("btn-fetch-barcode").addEventListener("click", async () => {
  try {
    const codigo = document.getElementById("scan-barcode").value.trim();
    if (!codigo) {
      showToast("Introduce o escanea un código de barras");
      return;
    }

    showLoader(true);

    const res = await fetch(`${API_BASE}/producto/scan?barCode=${codigo}`);
    if (!res.ok) throw new Error("Error en la API /scan");
    const data = await res.json();

    const scanModal = document.getElementById("scan-modal");

    // Rellenar campos del modal con la respuesta
    const scanImg = document.getElementById("scan-img");
    scanImg.src = data.Imagen || data.imagen || "";
    scanImg.classList.toggle("hidden", !(data.Imagen || data.imagen));

    document.getElementById("scan-nombre").value   = data.Nombre || "";
    document.getElementById("scan-brand").value    = data.Marca  || "";
    document.getElementById("scan-formato").value  = data.Formato || "";
    document.getElementById("scan-cantidad").value = 1;
    document.getElementById("scan-ubicacion").value= "";
    document.getElementById("scan-caducidad").value= "";

    scanModal.dataset.codigo = data.barCode || data.codigo || codigo;

    await listAlmacenes("scan-ubicacion");

    showToast("Datos cargados desde la API");

  } catch (err) {
    console.error("Error en btn-fetch-barcode:", err);
    showToast("Error al consultar la API /scan");
  } finally {
    showLoader(false);
  }
});

  btnList.addEventListener("click", () => { list("all"); setActiveFilter(btnFilterAll); });
  btnFilterAll.addEventListener("click", () => { list("all"); setActiveFilter(btnFilterAll); });
  btnFilterStock.addEventListener("click", () => { list("stock"); setActiveFilter(btnFilterStock); });
  btnFilterExpiry.addEventListener("click", () => { list("expiry"); setActiveFilter(btnFilterExpiry); });
  searchInput.addEventListener("input", applySearch);
  searchClear.addEventListener("click", () => { searchInput.value = ""; applySearch(); });
  scanClose.addEventListener("click", () => closeModal("scan-modal"));
  scanAdd.addEventListener("click", addProduct);
// Escanear desde el botón del modal
document.getElementById("btn-scan-barcode").addEventListener("click", async () => {
  try {
    const codigo = await iniciarEscaneo(); // tu función de escaneo real o simulada
    if (codigo) {
      document.getElementById("scan-barcode").value = codigo;
      showToast("Código escaneado: " + codigo);
      // Disparar el mismo evento que el botón lupa
      document.getElementById("btn-fetch-barcode").click();
    }
  } catch (err) {
    console.error(err);
    showToast("Error al escanear código");
  }
});


  // --- Eventos de gestión de almacenes ---
document.getElementById("btn-almacenes").addEventListener("click", async () => {
  try {
    // Mostrar modal inmediatamente
    openModal("almacen-modal");

    // Pintar "Cargando..." y luego la lista
    await renderAlmacenes("almacen-list");

  } catch (err) {
    console.error("Error al abrir almacenes:", err);
    showToast("No se pudieron cargar los almacenes");
  }
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
  document.getElementById("almacen-close").addEventListener("click", () => {
  closeModal("almacen-modal");
});

});


  // --- Inicialización ---
  list("all");
});




























