import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, deleteDoc, updateDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBYEmTH60CSoyFn95LUu76sXrCrhqyiZkE",
  authDomain: "sipinna-sat-5bbfb.firebaseapp.com",
  projectId: "sipinna-sat-5bbfb",
  storageBucket: "sipinna-sat-5bbfb.firebasestorage.app",
  messagingSenderId: "182735121486",
  appId: "1:182735121486:web:df9b7a980ba5626ed8671f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const CREDENCIALES_SISTEMA = { usuario: "admin", password: "123" };

let paginaActualIndex = 0;
let documentosCache = [];
let documentosFiltradosCache = [];
let limiteRegistros = 10;
let moduloActual = 'casos';
let funcionEliminarPendiente = null;
let fotosActualesEdicion = [];
let listasActualesEdicion = [];

let cacheCasosEstadistica = [];
let cacheTalleresEstadistica = [];

function comprimirImagen(file, maxWidth = 400, quality = 0.4) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function(event) {
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = function(error) { reject(error); };
      img.src = event.target.result;
    };
    reader.onerror = function(error) { reject(error); };
    reader.readAsDataURL(file);
  });
}

async function convertirFilesComprimidos(files) {
  return Promise.all(Array.from(files).map(file => comprimirImagen(file)));
}

window.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('sipinna_sesion') === 'activa') {
    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('app-section').classList.remove('hidden');
    cargarDatosTabla();
    cargarDatosEstadisticas();
  }

  const fechaHoy = new Date();
  const anio = fechaHoy.getFullYear();
  const mes = String(fechaHoy.getMonth() + 1).padStart(2, '0');
  const diaHoy = `${anio}-${mes}-${String(fechaHoy.getDate()).padStart(2, '0')}`;
  
  const elCaptura1 = document.getElementById('c-fechacaptura');
  const elCaptura2 = document.getElementById('tll-fechacaptura');
  if (elCaptura1) elCaptura1.value = diaHoy;
  if (elCaptura2) elCaptura2.value = diaHoy;
  
  const filtroMes = document.getElementById('filtro-mes');
  const corteMes = document.getElementById('corte-valor-mes');
  if (filtroMes) filtroMes.value = `${anio}-${mes}`;
  if (corteMes) corteMes.value = `${anio}-${mes}`;
});

window.mostrarNotificacion = function(titulo, mensaje, tipo = 'exito') {
  const modal = document.getElementById('modal-notificacion');
  const iconContainer = document.getElementById('modal-icon-container');
  const icon = document.getElementById('modal-icon');
  
  document.getElementById('modal-titulo').textContent = titulo;
  document.getElementById('modal-mensaje').textContent = mensaje;

  if (tipo === 'exito') {
    iconContainer.className = "w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 bg-green-50 text-green-600";
    icon.className = "fa-solid fa-circle-check text-3xl";
  } else if (tipo === 'error') {
    iconContainer.className = "w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 bg-red-50 text-red-600";
    icon.className = "fa-solid fa-triangle-exclamation text-3xl";
  }

  modal.classList.remove('hidden');
};

window.cerrarNotificacion = function() {
  document.getElementById('modal-notificacion').classList.add('hidden');
};

window.pedirConfirmacion = function(mensaje, funcionOnConfirm) {
  document.getElementById('confirm-mensaje').textContent = mensaje;
  funcionEliminarPendiente = funcionOnConfirm;
  document.getElementById('modal-confirmacion').classList.remove('hidden');
};

window.cerrarModalConfirmacion = function() {
  document.getElementById('modal-confirmacion').classList.add('hidden');
  funcionEliminarPendiente = null;
};

const btnConfirmEliminar = document.getElementById('btn-confirm-eliminar');
if (btnConfirmEliminar) {
  btnConfirmEliminar.onclick = function() {
    if (funcionEliminarPendiente) funcionEliminarPendiente();
    cerrarModalConfirmacion();
  };
}

window.handleLogin = function(e) {
  e.preventDefault();
  const user = document.getElementById('login-user').value;
  const pass = document.getElementById('login-pass').value;

  if (user === CREDENCIALES_SISTEMA.usuario && pass === CREDENCIALES_SISTEMA.password) {
    localStorage.setItem('sipinna_sesion', 'activa');
    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('app-section').classList.remove('hidden');
    cargarDatosTabla();
    cargarDatosEstadisticas();
  } else {
    mostrarNotificacion('Acceso Denegado', 'Usuario o contraseña incorrectos.', 'error');
  }
};

window.cerrarSesion = function() {
  localStorage.removeItem('sipinna_sesion');
  document.getElementById('app-section').classList.add('hidden');
  document.getElementById('login-section').classList.remove('hidden');
};

window.calcularEdadNNA = function() {
  const fechaNac = document.getElementById('c-fechanac').value;
  if (!fechaNac) return;
  const nac = new Date(fechaNac);
  const hoy = new Date();
  let edad = hoy.getFullYear() - nac.getFullYear();
  const mes = hoy.getMonth() - nac.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < nac.getDate())) edad--;
  document.getElementById('c-edad').value = edad >= 0 ? `${edad} años` : 'Fecha inválida';
};

window.guardarCaso = async function(e) {
  e.preventDefault();
  const btnGuardar = document.getElementById('btn-guardar-caso');
  const idEditar = document.getElementById('c-id-editar').value;
  btnGuardar.disabled = true;
  btnGuardar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

  try {
    const inputFotos = document.getElementById('c-fotos').files;
    const nuevasFotosComprimidas = await convertirFilesComprimidos(inputFotos);
    const fotosFinales = [...fotosActualesEdicion, ...nuevasFotosComprimidas];

    let datos = {
      noIncremento: document.getElementById('c-incremento').value,
      fechaCaptura: document.getElementById('c-fechacaptura').value,
      nombreNna: document.getElementById('c-nombre').value,
      fechaNac: document.getElementById('c-fechanac').value,
      edadNna: document.getElementById('c-edad').value,
      generoNna: document.getElementById('c-genero').value,
      nombreTutor: document.getElementById('t-nombre').value,
      edadTutor: document.getElementById('t-edad').value,
      generoTutor: document.getElementById('t-genero').value,
      domicilio: document.getElementById('c-domicilio').value,
      telefono: document.getElementById('c-telefono').value,
      tema: document.getElementById('c-tema').value,
      referencia: document.getElementById('c-referencia').value,
      estatus: document.getElementById('c-estatus').value,
      noExpediente: document.getElementById('c-noexp').value,
      fotos: fotosFinales
    };

    if (idEditar) {
      await updateDoc(doc(db, "casos_nna", idEditar), datos);
      mostrarNotificacion('Expediente Actualizado', 'Los cambios se han guardado correctamente.');
    } else {
      datos.fechaRegistro = Timestamp.fromDate(new Date());
      await addDoc(collection(db, "casos_nna"), datos);
      mostrarNotificacion('Expediente Registrado', 'El expediente del NNA se ha guardado correctamente.');
    }
    
    cancelarEdicionCaso();
    cargarDatosTabla();
    cargarDatosEstadisticas();
  } catch (err) {
    console.error("Error al guardar caso:", err);
    mostrarNotificacion('Error de Guardado', 'Las fotos son demasiado pesadas para Firestore.', 'error');
  } finally {
    btnGuardar.disabled = false;
    btnGuardar.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar Expediente NNA';
  }
};

window.prepararEdicionCaso = function(id) {
  const item = documentosCache.find(d => d.id === id);
  if (!item) return;

  document.getElementById('c-id-editar').value = item.id;
  document.getElementById('c-incremento').value = item.noIncremento || '';
  document.getElementById('c-fechacaptura').value = item.fechaCaptura || '';
  document.getElementById('c-nombre').value = item.nombreNna || '';
  document.getElementById('c-fechanac').value = item.fechaNac || '';
  calcularEdadNNA();
  document.getElementById('c-genero').value = item.generoNna || '';
  document.getElementById('t-nombre').value = item.nombreTutor || '';
  document.getElementById('t-edad').value = item.edadTutor || '';
  document.getElementById('t-genero').value = item.generoTutor || '';
  document.getElementById('c-domicilio').value = item.domicilio || '';
  document.getElementById('c-telefono').value = item.telefono || '';
  document.getElementById('c-tema').value = item.tema || '';
  document.getElementById('c-referencia').value = item.referencia || '';
  document.getElementById('c-estatus').value = item.estatus || '';
  document.getElementById('c-noexp').value = item.noExpediente || '';

  fotosActualesEdicion = item.fotos || [];
  renderizarFotosEdicion();

  document.getElementById('titulo-form-caso').textContent = 'Editar Expediente de Atención (NNA)';
  document.getElementById('btn-guardar-caso').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Actualizar Expediente NNA';
  document.getElementById('btn-cancelar-edicion-caso').classList.remove('hidden');
  window.switchTab('tab-1');
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

function renderizarFotosEdicion() {
  const contenedor = document.getElementById('contenedor-fotos-actuales');
  const lista = document.getElementById('lista-fotos-existentes');
  lista.innerHTML = '';

  if (fotosActualesEdicion.length > 0) {
    contenedor.classList.remove('hidden');
    fotosActualesEdicion.forEach((foto, idx) => {
      lista.innerHTML += `
        <div class="relative w-20 h-20 border rounded-lg overflow-hidden shadow-sm group">
          <img src="${foto}" class="w-full h-full object-cover">
          <button type="button" onclick="eliminarFotoEdicion(${idx})" class="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] hover:bg-red-800 shadow">&times;</button>
        </div>`;
    });
  } else {
    contenedor.classList.add('hidden');
  }
}

window.eliminarFotoEdicion = function(index) {
  fotosActualesEdicion.splice(index, 1);
  renderizarFotosEdicion();
};

window.cancelarEdicionCaso = function() {
  document.getElementById('form-caso').reset();
  document.getElementById('c-id-editar').value = '';
  document.getElementById('c-edad').value = '';
  fotosActualesEdicion = [];
  document.getElementById('contenedor-fotos-actuales').classList.add('hidden');
  document.getElementById('titulo-form-caso').textContent = 'Nuevo Registro de Atención (NNA)';
  document.getElementById('btn-guardar-caso').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar Expediente NNA';
  document.getElementById('btn-cancelar-edicion-caso').classList.add('hidden');
  
  const fechaHoy = new Date();
  const anio = fechaHoy.getFullYear();
  const mes = String(fechaHoy.getMonth() + 1).padStart(2, '0');
  document.getElementById('c-fechacaptura').value = `${anio}-${mes}-${String(fechaHoy.getDate()).padStart(2, '0')}`;
};

window.calcularTotalesAsistencia = function() {
  const inputsH = document.querySelectorAll('.num-h');
  const inputsM = document.querySelectorAll('.num-m');
  const subs = document.querySelectorAll('.row-subtotal');
  let totalH = 0, totalM = 0;

  inputsH.forEach((inp, idx) => {
    const h = parseInt(inp.value) || 0;
    const m = parseInt(inputsM[idx].value) || 0;
    subs[idx].textContent = h + m;
    totalH += h;
    totalM += m;
  });

  document.getElementById('tot-hombres').textContent = totalH;
  document.getElementById('tot-mujeres').textContent = totalM;
  document.getElementById('gran-total').textContent = totalH + totalM;
};

window.guardarTaller = async function(e) {
  e.preventDefault();
  const btnTaller = document.getElementById('btn-guardar-taller');
  const idEditar = document.getElementById('tll-id-editar').value;
  btnTaller.disabled = true;
  btnTaller.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

  try {
    const inputFotos = document.getElementById('tll-fotos').files;
    const inputListas = document.getElementById('tll-listas').files;
    
    const nuevasFotos = await convertirFilesComprimidos(inputFotos);
    const nuevasListas = await convertirFilesComprimidos(inputListas);

    const fotosFinales = [...fotosActualesEdicion, ...nuevasFotos];
    const listasFinales = [...listasActualesEdicion, ...nuevasListas];

    let desglose = {};
    document.querySelectorAll('.num-h').forEach((inp) => {
      const grupo = inp.getAttribute('data-grupo');
      desglose[grupo] = parseInt(inp.value) || 0;
    });
    document.querySelectorAll('.num-m').forEach((inp) => {
      const grupo = inp.getAttribute('data-grupo');
      desglose[grupo] = parseInt(inp.value) || 0;
    });

    let datos = {
      noIncremento: document.getElementById('tll-incremento').value,
      fechaCaptura: document.getElementById('tll-fechacaptura').value,
      tema: document.getElementById('tll-tema').value,
      institucion: document.getElementById('tll-institucion').value,
      lugar: document.getElementById('tll-lugar').value,
      fechaActividad: document.getElementById('tll-fecha').value,
      poblacion: document.getElementById('tll-poblacion').value,
      referencia: document.getElementById('tll-referencia').value,
      totalHombres: document.getElementById('tot-hombres').textContent,
      totalMujeres: document.getElementById('tot-mujeres').textContent,
      granTotal: document.getElementById('gran-total').textContent,
      fotos: fotosFinales,
      listas: listasFinales,
      desglose
    };

    if (idEditar) {
      await updateDoc(doc(db, "actividades_talleres", idEditar), datos);
      mostrarNotificacion('Actividad Actualizada', 'Los cambios del taller se guardaron correctamente.');
    } else {
      datos.fechaRegistro = Timestamp.fromDate(new Date());
      await addDoc(collection(db, "actividades_talleres"), datos);
      mostrarNotificacion('Actividad Guardada', 'El taller / conferencia ha sido registrado exitosamente.');
    }

    cancelarEdicionTaller();
    cargarDatosTabla();
    cargarDatosEstadisticas();
  } catch (err) {
    console.error("Error al guardar taller:", err);
    mostrarNotificacion('Error de Guardado', 'No se pudo guardar el taller en Firestore.', 'error');
  } finally {
    btnTaller.disabled = false;
    btnTaller.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Registrar Actividad / Taller';
  }
};

window.prepararEdicionTaller = function(id) {
  const item = documentosCache.find(d => d.id === id);
  if (!item) return;

  document.getElementById('tll-id-editar').value = item.id;
  document.getElementById('tll-incremento').value = item.noIncremento || '';
  document.getElementById('tll-fechacaptura').value = item.fechaCaptura || '';
  document.getElementById('tll-tema').value = item.tema || '';
  document.getElementById('tll-institucion').value = item.institucion || '';
  document.getElementById('tll-lugar').value = item.lugar || '';
  document.getElementById('tll-fecha').value = item.fechaActividad || '';
  document.getElementById('tll-poblacion').value = item.poblacion || '';
  document.getElementById('tll-referencia').value = item.referencia || '';

  fotosActualesEdicion = item.fotos || [];
  listasActualesEdicion = item.listas || [];
  renderizarArchivosTallerEdicion();

  if (item.desglose) {
    document.querySelectorAll('.num-h, .num-m').forEach(inp => {
      const grupo = inp.getAttribute('data-grupo');
      if (item.desglose[grupo] !== undefined) {
        inp.value = item.desglose[grupo];
      }
    });
    calcularTotalesAsistencia();
  }

  document.getElementById('titulo-form-taller').textContent = 'Editar Actividad / Taller';
  document.getElementById('btn-guardar-taller').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Actualizar Actividad / Taller';
  document.getElementById('btn-cancelar-edicion-taller').classList.remove('hidden');
  window.switchTab('tab-2');
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

function renderizarArchivosTallerEdicion() {
  const contFotos = document.getElementById('contenedor-fotos-taller');
  const listaFotos = document.getElementById('lista-fotos-taller-existentes');
  listaFotos.innerHTML = '';
  if (fotosActualesEdicion.length > 0) {
    contFotos.classList.remove('hidden');
    fotosActualesEdicion.forEach((foto, idx) => {
      listaFotos.innerHTML += `
        <div class="relative w-16 h-16 border rounded-lg overflow-hidden shadow-sm">
          <img src="${foto}" class="w-full h-full object-cover">
          <button type="button" onclick="eliminarFotoTallerEdicion(${idx})" class="absolute top-1 right-1 bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px]">&times;</button>
        </div>`;
    });
  } else {
    contFotos.classList.add('hidden');
  }

  const contListas = document.getElementById('contenedor-listas-taller');
  const listaListas = document.getElementById('lista-listas-taller-existentes');
  listaListas.innerHTML = '';
  if (listasActualesEdicion.length > 0) {
    contListas.classList.remove('hidden');
    listasActualesEdicion.forEach((lista, idx) => {
      listaListas.innerHTML += `
        <div class="relative w-16 h-16 border rounded-lg overflow-hidden shadow-sm">
          <img src="${lista}" class="w-full h-full object-cover">
          <button type="button" onclick="eliminarListaTallerEdicion(${idx})" class="absolute top-1 right-1 bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px]">&times;</button>
        </div>`;
    });
  } else {
    contListas.classList.add('hidden');
  }
}

window.eliminarFotoTallerEdicion = function(index) {
  fotosActualesEdicion.splice(index, 1);
  renderizarArchivosTallerEdicion();
};

window.eliminarListaTallerEdicion = function(index) {
  listasActualesEdicion.splice(index, 1);
  renderizarArchivosTallerEdicion();
};

window.cancelarEdicionTaller = function() {
  document.getElementById('form-taller').reset();
  document.getElementById('tll-id-editar').value = '';
  fotosActualesEdicion = [];
  listasActualesEdicion = [];
  document.getElementById('contenedor-fotos-taller').classList.add('hidden');
  document.getElementById('contenedor-listas-taller').classList.add('hidden');
  document.querySelectorAll('.num-h, .num-m').forEach(inp => inp.value = '0');
  document.querySelectorAll('.row-subtotal').forEach(sub => sub.textContent = '0');
  document.getElementById('tot-hombres').textContent = '0';
  document.getElementById('tot-mujeres').textContent = '0';
  document.getElementById('gran-total').textContent = '0';
  document.getElementById('titulo-form-taller').textContent = 'Registro de Talleres, Escuelas y Conferencias';
  document.getElementById('btn-guardar-taller').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Registrar Actividad / Taller';
  document.getElementById('btn-cancelar-edicion-taller').classList.add('hidden');
  
  const fechaHoy = new Date();
  const anio = fechaHoy.getFullYear();
  const mes = String(fechaHoy.getMonth() + 1).padStart(2, '0');
  document.getElementById('tll-fechacaptura').value = `${anio}-${mes}-${String(fechaHoy.getDate()).padStart(2, '0')}`;
};

window.switchTab = function(tabId) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
  document.getElementById(tabId).classList.remove('hidden');

  ['tab-btn-1', 'tab-btn-2', 'tab-btn-3'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.className = 'py-4 px-3 text-gray-500 hover:text-vino flex items-center gap-2 text-sm whitespace-nowrap transition';
  });
  const activeBtn = document.getElementById(`tab-btn-${tabId.split('-')[1]}`);
  if (activeBtn) activeBtn.className = 'py-4 px-3 active-tab flex items-center gap-2 text-sm whitespace-nowrap transition';

  if (tabId === 'tab-3') {
    calcularCorteEstadistico();
  }
};

window.cambiarModuloTabla = function() {
  moduloActual = document.getElementById('selector-modulo-tabla').value;
  paginaActualIndex = 0;
  cargarDatosTabla();
};

window.cambiarLimitePaginacion = function() {
  limiteRegistros = parseInt(document.getElementById('limite-paginacion').value);
  paginaActualIndex = 0;
  renderizarTablaPaginada();
};

window.limpiarFiltroFecha = function() {
  document.getElementById('filtro-dia').value = '';
  document.getElementById('filtro-mes').value = '';
  document.getElementById('input-buscar').value = '';
  aplicarFiltrosYBusqueda();
};

window.cargarDatosTabla = async function() {
  const tbody = document.getElementById('tabla-body');
  tbody.innerHTML = '<tr><td colspan="6" class="text-center py-6 text-gray-400 font-semibold"><i class="fa-solid fa-spinner fa-spin text-vino mr-2"></i> Cargando registros de Firebase...</td></tr>';

  try {
    const coleccionNombre = moduloActual === 'casos' ? 'casos_nna' : 'actividades_talleres';
    const snap = await getDocs(collection(db, coleccionNombre));
    
    let lista = [];
    snap.forEach(docSnap => {
      lista.push({ id: docSnap.id, ...docSnap.data() });
    });

    documentosCache = lista;
    aplicarFiltrosYBusqueda();
  } catch (e) {
    console.error(e);
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-6 text-red-500 font-semibold">Error al cargar datos. Verifica tu conexión.</td></tr>';
  }
};

window.cargarDatosEstadisticas = async function() {
  try {
    const snapCasos = await getDocs(collection(db, "casos_nna"));
    cacheCasosEstadistica = [];
    snapCasos.forEach(d => cacheCasosEstadistica.push(d.data()));

    const snapTalleres = await getDocs(collection(db, "actividades_talleres"));
    cacheTalleresEstadistica = [];
    snapTalleres.forEach(d => cacheTalleresEstadistica.push(d.data()));

    calcularCorteEstadistico();
  } catch (e) {
    console.error("Error al cargar datos para estadísticas:", e);
  }
};

window.cambiarTipoCorte = function() {
  const tipo = document.getElementById('corte-tipo').value;
  const contenedor = document.getElementById('contenedor-input-corte');
  const label = document.getElementById('label-selector-corte');
  const fechaHoy = new Date();
  const anio = fechaHoy.getFullYear();
  const mes = String(fechaHoy.getMonth() + 1).padStart(2, '0');
  const dia = String(fechaHoy.getDate()).padStart(2, '0');

  if (tipo === 'diario') {
    label.textContent = "Seleccionar Día";
    contenedor.innerHTML = `<input type="date" id="corte-valor-fecha" onchange="calcularCorteEstadistico()" value="${anio}-${mes}-${dia}" class="w-full border rounded-lg px-3 py-2 text-xs bg-white outline-none">`;
  } else if (tipo === 'semanal') {
    label.textContent = "Seleccionar Semana (Cualquier día de la semana)";
    contenedor.innerHTML = `<input type="date" id="corte-valor-semana" onchange="calcularCorteEstadistico()" value="${anio}-${mes}-${dia}" class="w-full border rounded-lg px-3 py-2 text-xs bg-white outline-none">`;
  } else if (tipo === 'mensual') {
    label.textContent = "Seleccionar Mes";
    contenedor.innerHTML = `<input type="month" id="corte-valor-mes" onchange="calcularCorteEstadistico()" value="${anio}-${mes}" class="w-full border rounded-lg px-3 py-2 text-xs bg-white outline-none">`;
  } else if (tipo === 'anual') {
    label.textContent = "Seleccionar Año";
    contenedor.innerHTML = `<input type="number" id="corte-valor-anio" onchange="calcularCorteEstadistico()" value="${anio}" min="2024" max="2035" class="w-full border rounded-lg px-3 py-2 text-xs bg-white outline-none">`;
  }
  calcularCorteEstadistico();
};

window.calcularCorteEstadistico = function() {
  const tipo = document.getElementById('corte-tipo').value;
  let filtroVal = '';

  if (tipo === 'diario') {
    const el = document.getElementById('corte-valor-fecha');
    if (el) filtroVal = el.value;
  } else if (tipo === 'semanal') {
    const el = document.getElementById('corte-valor-semana');
    if (el) filtroVal = el.value;
  } else if (tipo === 'mensual') {
    const el = document.getElementById('corte-valor-mes');
    if (el) filtroVal = el.value;
  } else if (tipo === 'anual') {
    const el = document.getElementById('corte-valor-anio');
    if (el) filtroVal = el.value;
  }

  let casosFiltrados = cacheCasosEstadistica.filter(item => {
    const fCap = item.fechaCaptura || '';
    if (!fCap) return false;
    if (tipo === 'diario') return fCap === filtroVal;
    if (tipo === 'mensual') return fCap.startsWith(filtroVal);
    if (tipo === 'anual') return fCap.startsWith(filtroVal);
    if (tipo === 'semanal' && filtroVal) {
      const dRef = new Date(filtroVal);
      const dItem = new Date(fCap);
      const diffTime = Math.abs(dItem - dRef);
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      return diffDays <= 3;
    }
    return false;
  });

  let talleresFiltrados = cacheTalleresEstadistica.filter(item => {
    const fCap = item.fechaCaptura || '';
    if (!fCap) return false;
    if (tipo === 'diario') return fCap === filtroVal;
    if (tipo === 'mensual') return fCap.startsWith(filtroVal);
    if (tipo === 'anual') return fCap.startsWith(filtroVal);
    if (tipo === 'semanal' && filtroVal) {
      const dRef = new Date(filtroVal);
      const dItem = new Date(fCap);
      const diffTime = Math.abs(dItem - dRef);
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      return diffDays <= 3;
    }
    return false;
  });

  let totalNna = casosFiltrados.length;
  let totalTalleres = talleresFiltrados.length;
  let totalH = 0;
  let totalM = 0;

  talleresFiltrados.forEach(t => {
    totalH += parseInt(t.totalHombres) || 0;
    totalM += parseInt(t.totalMujeres) || 0;
  });

  document.getElementById('kpi-total-nna').textContent = totalNna;
  document.getElementById('kpi-total-talleres').textContent = totalTalleres;
  document.getElementById('kpi-total-h').textContent = totalH;
  document.getElementById('kpi-total-m').textContent = totalM;

  const dependencias = [
    "Psicologia", "Procuraduria", "Instituto de la Mujer", 
    "Instituto de la Juventud", "Fiscalia", "Policia Municipal", 
    "Identidad y Convivencia", "CECOSAMA", "Otro"
  ];

  const tbodyCorte = document.getElementById('tabla-corte-body');
  tbodyCorte.innerHTML = '';

  dependencias.forEach(dep => {
    const nnaDep = casosFiltrados.filter(c => c.referencia === dep).length;
    const tallDep = talleresFiltrados.filter(t => t.referencia === dep).length;
    
    let asistentesDep = 0;
    talleresFiltrados.filter(t => t.referencia === dep).forEach(t => {
      asistentesDep += parseInt(t.granTotal) || 0;
    });

    const totalAtendidosDep = nnaDep + asistentesDep;

    if (nnaDep > 0 || tallDep > 0) {
      tbodyCorte.innerHTML += `
        <tr class="hover:bg-slate-50">
          <td class="px-4 py-2.5 font-bold text-slate-800">${dep}</td>
          <td class="px-4 py-2.5 text-center">${nnaDep}</td>
          <td class="px-4 py-2.5 text-center">${tallDep}</td>
          <td class="px-4 py-2.5 text-center font-black text-vino">${totalAtendidosDep}</td>
        </tr>`;
    }
  });

  if (tbodyCorte.innerHTML === '') {
    tbodyCorte.innerHTML = '<tr><td colspan="4" class="text-center py-6 text-gray-400">No hay registros para este periodo de captura.</td></tr>';
  }
};

window.exportarCorteEstadisticoExcel = function() {
  const tipo = document.getElementById('corte-tipo').value;
  const wsData = [
    ["REPORTE OFICIAL DE CORTE SIPINNA"],
    [`Tipo de Corte: ${tipo.toUpperCase()}`],
    [`Fecha Emisión: ${new Date().toLocaleDateString('es-MX')}`],
    [],
    ["Dependencia / Canalización", "Expedientes NNA", "Talleres Impartidos", "Total Atendidos"]
  ];

  const filas = document.querySelectorAll('#tabla-corte-body tr');
  filas.forEach(tr => {
    const cols = tr.querySelectorAll('td');
    if (cols.length === 4) {
      wsData.push([cols[0].textContent, cols[1].textContent, cols[2].textContent, cols[3].textContent]);
    }
  });

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Corte_Estadistico");
  XLSX.writeFile(wb, `SIPINNA_Corte_${tipo}_${new Date().toISOString().slice(0,10)}.xlsx`);
};

window.imprimirCorteEstadistico = function() {
  const tipo = document.getElementById('corte-tipo').value;
  const viejoContenedor = document.getElementById('seccion-impresion-activa');
  if (viejoContenedor) viejoContenedor.remove();

  const totalNna = document.getElementById('kpi-total-nna').textContent;
  const totalTalleres = document.getElementById('kpi-total-talleres').textContent;
  const totalH = document.getElementById('kpi-total-h').textContent;
  const totalM = document.getElementById('kpi-total-m').textContent;

  const divPrint = document.createElement('div');
  divPrint.id = 'seccion-impresion-activa';
  
  let htmlRows = '';
  const filas = document.querySelectorAll('#tabla-corte-body tr');
  filas.forEach(tr => {
    htmlRows += `<tr>${tr.innerHTML}</tr>`;
  });

  divPrint.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #7c1c30; padding-bottom: 8px; margin-bottom: 12px;">
      <div>
        <h3 style="font-size: 13px; font-weight: bold; margin: 0; text-transform: uppercase; color: #7c1c30;">H. Ayuntamiento de San Andrés Tuxtla, Ver.</h3>
        <h4 style="font-size: 11px; font-weight: bold; margin: 2px 0; color: #333;">SIPINNA - Reporte de Corte Estadístico (${tipo.toUpperCase()})</h4>
      </div>
      <div style="text-align: right; font-size: 10px;">
        <p style="font-weight: bold; margin: 0;">Director: Lic. Samuel Pucheta</p>
        <p style="margin: 2px 0; color: #555;">Emisión: ${new Date().toLocaleDateString('es-MX')}</p>
      </div>
    </div>

    <div style="display: flex; justify-content: space-around; margin-bottom: 15px; font-size: 11px; background: #f8fafc; padding: 8px; border: 1px solid #cbd5e1;">
      <div><strong>NNA:</strong> ${totalNna}</div>
      <div><strong>Talleres:</strong> ${totalTalleres}</div>
      <div><strong>Hombres:</strong> ${totalH}</div>
      <div><strong>Mujeres:</strong> ${totalM}</div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Dependencia / Canalización</th>
          <th style="text-align: center;">Expedientes NNA</th>
          <th style="text-align: center;">Talleres</th>
          <th style="text-align: center;">Total General</th>
        </tr>
      </thead>
      <tbody>${htmlRows}</tbody>
    </table>

    <div style="margin-top: 40px; display: flex; justify-content: space-around; text-align: center; font-size: 10px;">
      <div>
        <div style="width: 180px; border-top: 1px solid black; margin: 0 auto 4px auto;"></div>
        <strong>Lic. Samuel Pucheta</strong><br>Director de SIPINNA Municipal
      </div>
      <div>
        <div style="width: 180px; border-top: 1px solid black; margin: 0 auto 4px auto;"></div>
        <strong>Sello Oficial / Firma</strong><br>San Andrés Tuxtla, Ver.
      </div>
    </div>
  `;

  document.body.appendChild(divPrint);
  window.print();
  divPrint.remove();
};

window.aplicarFiltrosYBusqueda = function() {
  const filtroDia = document.getElementById('filtro-dia').value;
  const filtroMes = document.getElementById('filtro-mes').value;
  const textoBusqueda = document.getElementById('input-buscar').value.toLowerCase().trim();

  let lista = [...documentosCache];

  if (filtroDia) {
    lista = lista.filter(item => {
      if (item.fechaCaptura) {
        return item.fechaCaptura === filtroDia;
      }
      if (moduloActual === 'talleres') {
        return item.fechaActividad === filtroDia;
      } else {
        if (!item.fechaRegistro) return false;
        const fechaObj = item.fechaRegistro.toDate();
        const anioDia = `${fechaObj.getFullYear()}-${String(fechaObj.getMonth() + 1).padStart(2, '0')}-${String(fechaObj.getDate()).padStart(2, '0')}`;
        return anioDia === filtroDia;
      }
    });
  } else if (filtroMes) {
    lista = lista.filter(item => {
      if (item.fechaCaptura) {
        return item.fechaCaptura.startsWith(filtroMes);
      }
      if (moduloActual === 'talleres') {
        if (!item.fechaActividad) return false;
        return item.fechaActividad.startsWith(filtroMes);
      } else {
        if (!item.fechaRegistro) return false;
        const fechaObj = item.fechaRegistro.toDate();
        const anioMes = `${fechaObj.getFullYear()}-${String(fechaObj.getMonth() + 1).padStart(2, '0')}`;
        return anioMes === filtroMes;
      }
    });
  }

  if (textoBusqueda) {
    lista = lista.filter(item => {
      const valores = Object.values(item).join(' ').toLowerCase();
      return valores.includes(textoBusqueda);
    });
  }

  documentosFiltradosCache = lista;
  paginaActualIndex = 0;
  renderizarTablaPaginada();
};

function renderizarTablaPaginada() {
  const thead = document.getElementById('tabla-head');
  const tbody = document.getElementById('tabla-body');
  tbody.innerHTML = '';

  const inicio = paginaActualIndex * limiteRegistros;
  const fin = inicio + limiteRegistros;
  const registrosPagina = documentosFiltradosCache.slice(inicio, fin);

  if (registrosPagina.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-6 text-gray-400">No se encontraron registros coincidentes.</td></tr>';
    document.getElementById('paginacion-info').textContent = `Mostrando 0 registros`;
    document.getElementById('pagina-actual').textContent = '1';
    return;
  }

  if (moduloActual === 'casos') {
    thead.innerHTML = `
      <tr>
        <th class="px-4 py-3">No. Inc.</th>
        <th class="px-4 py-3">Expediente / F. Captura</th>
        <th class="px-4 py-3">NNA / Tutor</th>
        <th class="px-4 py-3">Canalización</th>
        <th class="px-4 py-3 text-center">Evidencias</th>
        <th class="px-4 py-3 text-center">Acciones</th>
      </tr>`;

    registrosPagina.forEach((item) => {
      const fotosJson = encodeURIComponent(JSON.stringify(item.fotos || []));
      tbody.innerHTML += `
        <tr class="hover:bg-slate-50 transition">
          <td class="px-4 py-3 font-bold text-gray-700">${item.noIncremento || 'S/N'}</td>
          <td class="px-4 py-3 font-mono font-bold text-slate-800">${item.noExpediente || ''}<br><span class="text-xs text-gray-500 font-sans font-normal">Cap: ${item.fechaCaptura || ''}</span></td>
          <td class="px-4 py-3 font-medium text-gray-900">${item.nombreNna || ''}<br><span class="text-xs text-gray-500">Tutor: ${item.nombreTutor || ''}</span></td>
          <td class="px-4 py-3"><span class="bg-amber-100 text-amber-900 text-xs px-2.5 py-1 rounded-full font-bold">${item.referencia || ''}</span></td>
          <td class="px-4 py-3 text-center">
            <button onclick="abrirGaleria('${fotosJson}', 'Fotos del Expediente NNA')" class="text-vino text-xs font-bold underline hover:text-red-900"><i class="fa-solid fa-images mr-1"></i> ${(item.fotos || []).length} Fotos</button>
          </td>
          <td class="px-4 py-3 text-center space-x-3">
            <button onclick="prepararEdicionCaso('${item.id}')" class="text-amber-600 hover:text-amber-800 transition" title="Editar"><i class="fa-solid fa-pen-to-square text-base"></i></button>
            <button onclick="eliminarRegistro('${item.id}', 'casos_nna')" class="text-red-600 hover:text-red-800 transition" title="Eliminar"><i class="fa-solid fa-trash-can text-base"></i></button>
          </td>
        </tr>`;
    });
  } else {
    thead.innerHTML = `
      <tr>
        <th class="px-4 py-3">No. Inc.</th>
        <th class="px-4 py-3">Tema / Institución</th>
        <th class="px-4 py-3">Canalización / F. Captura</th>
        <th class="px-4 py-3 text-center">Asistentes</th>
        <th class="px-4 py-3 text-center">Evidencias Y Listas</th>
        <th class="px-4 py-3 text-center">Acciones</th>
      </tr>`;

    registrosPagina.forEach((item) => {
      const fotosJson = encodeURIComponent(JSON.stringify(item.fotos || []));
      const listasJson = encodeURIComponent(JSON.stringify(item.listas || []));

      tbody.innerHTML += `
        <tr class="hover:bg-slate-50 transition">
          <td class="px-4 py-3 font-bold text-gray-700">${item.noIncremento || 'S/N'}</td>
          <td class="px-4 py-3 font-bold text-gray-900">${item.tema || ''}<br><span class="text-xs text-gray-500 font-normal">${item.institucion || ''}</span></td>
          <td class="px-4 py-3 text-gray-700">${item.referencia || 'General'}<br><span class="text-xs text-gray-400">Cap: ${item.fechaCaptura || ''}</span></td>
          <td class="px-4 py-3 text-center font-black text-vino">${item.granTotal || 0} <span class="text-xs font-normal text-gray-500">(${item.totalHombres || 0}H / ${item.totalMujeres || 0}M)</span></td>
          <td class="px-4 py-3 text-center space-y-1">
            <button onclick="abrirGaleria('${fotosJson}', 'Fotografías del Taller')" class="block w-full text-vino text-xs font-bold underline hover:text-red-900">
              <i class="fa-solid fa-camera mr-1"></i> ${(item.fotos || []).length} Fotos
            </button>
            <button onclick="abrirGaleria('${listasJson}', 'Listas de Asistencia')" class="block w-full text-emerald-700 text-xs font-bold underline hover:text-emerald-900">
              <i class="fa-solid fa-file-signature mr-1"></i> ${(item.listas || []).length} Listas
            </button>
          </td>
          <td class="px-4 py-3 text-center space-x-3">
            <button onclick="prepararEdicionTaller('${item.id}')" class="text-amber-600 hover:text-amber-800 transition" title="Editar"><i class="fa-solid fa-pen-to-square text-base"></i></button>
            <button onclick="eliminarRegistro('${item.id}', 'actividades_talleres')" class="text-red-600 hover:text-red-800 transition" title="Eliminar"><i class="fa-solid fa-trash-can text-base"></i></button>
          </td>
        </tr>`;
    });
  }

  document.getElementById('paginacion-info').textContent = `Mostrando ${inicio + 1} a ${Math.min(fin, documentosFiltradosCache.length)} de ${documentosFiltradosCache.length} registros`;
  document.getElementById('pagina-actual').textContent = paginaActualIndex + 1;
}

window.cambiarPagina = function(direccion) {
  const maxPaginas = Math.ceil(documentosFiltradosCache.length / limiteRegistros);
  if (paginaActualIndex + direccion >= 0 && paginaActualIndex + direccion < maxPaginas) {
    paginaActualIndex += direccion;
    renderizarTablaPaginada();
  }
};

window.eliminarRegistro = function(id, coleccion) {
  pedirConfirmacion("¿Deseas eliminar este registro permanentemente?", async () => {
    try {
      await deleteDoc(doc(db, coleccion, id));
      mostrarNotificacion('Registro Eliminado', 'El expediente fue removido correctamente.');
      cargarDatosTabla();
      cargarDatosEstadisticas();
    } catch (e) {
      mostrarNotificacion('Error', 'No se pudo eliminar el registro.', 'error');
    }
  });
};

window.exportarExcel = function() {
  if (documentosFiltradosCache.length === 0) {
    mostrarNotificacion('Sin Datos', 'No hay registros visibles para exportar.', 'error');
    return;
  }

  let datosExportar = [];
  const filtroDia = document.getElementById('filtro-dia').value;
  const filtroMes = document.getElementById('filtro-mes').value;
  const etiquetaFiltro = filtroDia || filtroMes || 'General';

  if (moduloActual === 'casos') {
    datosExportar = documentosFiltradosCache.map((item) => ({
      'No. Incremento': item.noIncremento || '',
      'Fecha Captura': item.fechaCaptura || '',
      'No. Expediente': item.noExpediente || '',
      'Nombre NNA': item.nombreNna || '',
      'Fecha Nacimiento': item.fechaNac || '',
      'Edad': item.edadNna || '',
      'Género NNA': item.generoNna || '',
      'Tutor': item.nombreTutor || '',
      'Edad Tutor': item.edadTutor || '',
      'Género Tutor': item.generoTutor || '',
      'Domicilio': item.domicilio || '',
      'Teléfono': item.telefono || '',
      'Tema': item.tema || '',
      'Canalización / Referencia': item.referencia || '',
      'Estatus': item.estatus || ''
    }));
  } else {
    datosExportar = documentosFiltradosCache.map((item) => ({
      'No. Incremento': item.noIncremento || '',
      'Fecha Captura': item.fechaCaptura || '',
      'Tema / Actividad': item.tema || '',
      'Institución': item.institucion || '',
      'Lugar': item.lugar || '',
      'Fecha Actividad': item.fechaActividad || '',
      'Población Objetivo': item.poblacion || '',
      'Canalización': item.referencia || '',
      'Total Hombres': item.totalHombres || 0,
      'Total Mujeres': item.totalMujeres || 0,
      'Total Asistentes': item.granTotal || 0
    }));
  }

  const ws = XLSX.utils.json_to_sheet(datosExportar);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "SIPINNA_Corte");
  
  XLSX.writeFile(wb, `SIPINNA_Corte_${moduloActual}_${etiquetaFiltro}.xlsx`);
};

window.imprimirCorte = function() {
  if (documentosFiltradosCache.length === 0) {
    mostrarNotificacion('Sin Datos', 'No hay registros para generar la hoja de impresión.', 'error');
    return;
  }

  const viejoContenedor = document.getElementById('seccion-impresion-activa');
  if (viejoContenedor) viejoContenedor.remove();

  const filtroDia = document.getElementById('filtro-dia').value;
  const filtroMes = document.getElementById('filtro-mes').value;
  const textoBusqueda = document.getElementById('input-buscar').value.trim();

  let descCorte = filtroDia ? `Día: ${filtroDia}` : (filtroMes ? `Mes: ${filtroMes}` : 'General (Todos los registros)');
  if (textoBusqueda) descCorte += ` | Búsqueda: "${textoBusqueda}"`;

  const divPrint = document.createElement('div');
  divPrint.id = 'seccion-impresion-activa';
  
  let htmlRows = '';
  if (moduloActual === 'casos') {
    htmlRows = `
      <thead>
        <tr>
          <th style="width: 40px; text-align: center;">No. Inc.</th>
          <th>Expediente / F. Captura</th>
          <th>NNA / Tutor</th>
          <th>Canalización</th>
          <th style="text-align: center;">Estatus</th>
        </tr>
      </thead>
      <tbody>`;
    documentosFiltradosCache.forEach((item) => {
      htmlRows += `
        <tr>
          <td style="text-align: center; font-weight: bold;">${item.noIncremento || 'S/N'}</td>
          <td>
            <div style="font-family: monospace; font-weight: bold;">${item.noExpediente || ''}</div>
            <div style="font-size: 10px; color: #475569;">Cap: ${item.fechaCaptura || ''}</div>
          </td>
          <td>
            <div style="font-weight: bold;">${item.nombreNna || ''}</div>
            <div style="font-size: 10px; color: #475569;">Tutor: ${item.nombreTutor || ''}</div>
          </td>
          <td>${item.referencia || ''}</td>
          <td style="text-align: center;">
            <span style="background-color: #fef3c7; color: #78350f; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: bold;">${item.estatus || ''}</span>
          </td>
        </tr>`;
    });
    htmlRows += `</tbody>`;
  } else {
    htmlRows = `
      <thead>
        <tr>
          <th style="width: 40px; text-align: center;">No. Inc.</th>
          <th>Tema / Institución</th>
          <th>Canalización</th>
          <th style="text-align: center;">Asistentes</th>
        </tr>
      </thead>
      <tbody>`;
    documentosFiltradosCache.forEach((item) => {
      htmlRows += `
        <tr>
          <td style="text-align: center; font-weight: bold;">${item.noIncremento || 'S/N'}</td>
          <td>
            <div style="font-weight: bold;">${item.tema || ''}</div>
            <div style="font-size: 10px; color: #475569;">${item.institucion || ''} (${item.lugar || ''})</div>
          </td>
          <td>${item.referencia || 'General'}</td>
          <td style="text-align: center; font-weight: bold;">
            ${item.granTotal || 0} <span style="font-size: 10px; font-weight: normal; color: #475569;">(${item.totalHombres || 0}H / ${item.totalMujeres || 0}M)</span>
          </td>
        </tr>`;
    });
    htmlRows += `</tbody>`;
  }

  divPrint.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #7c1c30; padding-bottom: 8px; margin-bottom: 12px;">
      <div>
        <h3 style="font-size: 13px; font-weight: bold; margin: 0; text-transform: uppercase; color: #7c1c30;">H. Ayuntamiento de San Andrés Tuxtla, Ver.</h3>
        <h4 style="font-size: 11px; font-weight: bold; margin: 2px 0; color: #333;">SIPINNA - Reporte Oficial de Gestión</h4>
        <p style="font-size: 10px; margin: 0; color: #555;">Filtro / Corte: ${descCorte} | Total Registros: ${documentosFiltradosCache.length}</p>
      </div>
      <div style="text-align: right; font-size: 10px;">
        <p style="font-weight: bold; margin: 0;">Director: Lic. Samuel Pucheta</p>
        <p style="margin: 2px 0; color: #555;">Emisión: ${new Date().toLocaleDateString('es-MX')}</p>
      </div>
    </div>

    <table>${htmlRows}</table>

    <div style="margin-top: 40px; display: flex; justify-content: space-around; text-align: center; font-size: 10px;">
      <div>
        <div style="width: 180px; border-top: 1px solid black; margin: 0 auto 4px auto;"></div>
        <strong>Lic. Samuel Pucheta</strong><br>Director de SIPINNA Municipal
      </div>
      <div>
        <div style="width: 180px; border-top: 1px solid black; margin: 0 auto 4px auto;"></div>
        <strong>Sello Oficial / Firma</strong><br>San Andrés Tuxtla, Ver.
      </div>
    </div>
  `;

  document.body.appendChild(divPrint);
  window.print();
  divPrint.remove();
};

window.abrirGaleria = function(archivosEncoded, titulo = "Galería de Evidencias") {
  const archivos = JSON.parse(decodeURIComponent(archivosEncoded));
  const imgPrincipal = document.getElementById('galeria-imagen-principal');
  const contenedorMiniaturas = document.getElementById('galeria-miniaturas');
  const textoVacio = document.getElementById('galeria-vacio');
  
  document.getElementById('galeria-titulo-modal').innerHTML = `<i class="fa-solid fa-images text-vino"></i> ${titulo}`;
  contenedorMiniaturas.innerHTML = '';

  if (!archivos || archivos.length === 0) {
    imgPrincipal.src = '';
    imgPrincipal.classList.add('hidden');
    textoVacio.classList.remove('hidden');
  } else {
    textoVacio.classList.add('hidden');
    imgPrincipal.classList.remove('hidden');
    imgPrincipal.src = archivos[0];

    archivos.forEach((base64, index) => {
      const activeClass = index === 0 ? 'border-amber-400 ring-2 ring-amber-400 opacity-100' : 'border-transparent opacity-70 hover:opacity-100';
      contenedorMiniaturas.innerHTML += `
        <div onclick="cambiarFotoPrincipal('${base64}', this)" class="min-w-[70px] w-16 h-16 rounded-xl overflow-hidden border-2 cursor-pointer transition transform hover:scale-105 bg-black ${activeClass}">
          <img src="${base64}" class="w-full h-full object-cover">
        </div>`;
    });
  }

  document.getElementById('modal-galeria').classList.remove('hidden');
};

window.cambiarFotoPrincipal = function(base64, elementoMiniatura) {
  document.getElementById('galeria-imagen-principal').src = base64;
  const miniaturas = document.querySelectorAll('#galeria-miniaturas > div');
  miniaturas.forEach(min => {
    min.className = "min-w-[70px] w-16 h-16 rounded-xl overflow-hidden border-2 cursor-pointer transition transform hover:scale-105 bg-black border-transparent opacity-70 hover:opacity-100";
  });
  elementoMiniatura.className = "min-w-[70px] w-16 h-16 rounded-xl overflow-hidden border-2 cursor-pointer transition transform hover:scale-105 bg-black border-amber-400 ring-2 ring-amber-400 opacity-100";
};

window.cerrarGaleria = function() {
  document.getElementById('modal-galeria').classList.add('hidden');
};
