import { autoResizeTextarea, toggleExportElements, calculateRowTotal } from './utils.js';

let currentPassword = '';
let currentData = null;

// Limpia sesión, localStorage y recarga el JSON por defecto
function clearAndReload() {
    sessionStorage.removeItem('cuentaPassword');
    sessionStorage.removeItem('cuentaData');
    localStorage.removeItem('encryptedBill');
    currentPassword = '';
    currentData = null;
    loadDefaultData();
    showModal('Datos restablecidos a los valores por defecto.');
}

// Cargar datos por defecto desde defaultData.json con manejo de errores
async function loadDefaultData() {
    try {
        const res = await fetch(new URL('defaultData.json', import.meta.url));
        if (!res.ok) throw new Error('No se pudo cargar defaultData.json');
        const data = await res.json();
        currentData = data;
        fillForm(data);
        updateTotals();
    } catch (err) {
        showModal('Error cargando datos por defecto: ' + (err.message || err));
        // Limpiar el formulario si falla
        fillForm({});
        updateTotals();
    }
}

// Auto-save to localStorage when data changes
function autoSave() {
    if (!currentPassword) return;
    const data = getFormData();
    currentData = data;
    const json = JSON.stringify(data);
    localStorage.setItem('encryptedBill', CryptoJS.AES.encrypt(json, currentPassword).toString());
}

function getFormData() {
    const form = document.getElementById('cuentaForm');
    const data = Object.fromEntries(new FormData(form));
    data.items = Array.from(document.querySelectorAll('#itemsBody tr')).map(tr => {
        const inputs = tr.querySelectorAll('input');
        return {
            concept: inputs[0]?.value || '',
            hours: Number(inputs[1]?.value) || 0,
            rate: Number(inputs[2]?.value) || 0
        };
    });
    return data;
}

// Modal functions
function showModal(message) {
    document.getElementById('modal-message').textContent = message;
    document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal').classList.add('hidden');
}

function saveFile() {
    const data = getFormData();
    if (!data || !data.items || data.items.length === 0) {
        showModal('No data to save.');
        return;
    }
    // Guardar en memoria la data y la contraseña como sesión
    currentData = data;
    if (currentPassword) sessionStorage.setItem('cuentaPassword', currentPassword);
    sessionStorage.setItem('cuentaData', JSON.stringify(data));
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cuenta_cobro.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    showModal('File saved successfully!');
}

function exportJSONMemory() {
    if (!currentData) {
        showModal('No data in memory.');
        return;
    }
    const json = JSON.stringify(currentData, null, 2);
    // Copiar al portapapeles
    navigator.clipboard.writeText(json);
    showModal('JSON copied to clipboard!');
}

// Show or hide controls that should not appear in exported images

// Se eliminaron las funciones saveImage y savePDF

function loadFile(evt) {
    let password = document.getElementById('password').value;
    if (!password) {
        // Si hay una sesión previa, usarla
        password = sessionStorage.getItem('cuentaPassword') || '';
        if (!password) {
            showModal('Enter a password first to encrypt your data.');
            evt.target.value = '';
            return;
        }
    }
    const file = evt.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            currentPassword = password;
            currentData = data;
            sessionStorage.setItem('cuentaPassword', password);
            sessionStorage.setItem('cuentaData', JSON.stringify(data));
            fillForm(data);
            autoSave(); // Save encrypted version to localStorage
            showModal('Data loaded successfully!');
        } catch {
            showModal('Invalid JSON file.');
        }
    };
    reader.readAsText(file);
    evt.target.value = '';
}

// Fill form with data
function fillForm(data) {
    const form = document.getElementById('cuentaForm');
    for (const [key, value] of Object.entries(data)) {
        if (key === 'items') continue;
        // Buscar input, textarea o select por name
        const field = form.querySelector(`[name="${key}"]`);
        if (field) {
            if (field.tagName === 'TEXTAREA') {
                field.value = value || '';
                autoResizeTextarea(field);
            } else if (field.type === 'date') {
                // Si es date, asegurarse de que el valor esté en formato yyyy-mm-dd
                if (value && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    field.value = value;
                } else if (value) {
                    // Intentar parsear fechas tipo dd/mm/yyyy o similares
                    const parts = value.split(/[\/\-]/);
                    if (parts.length === 3) {
                        let yyyy, mm, dd;
                        if (parts[0].length === 4) { // yyyy-mm-dd
                            [yyyy, mm, dd] = parts;
                        } else { // dd/mm/yyyy
                            [dd, mm, yyyy] = parts;
                        }
                        field.value = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
                    }
                } else {
                    field.value = '';
                }
            } else {
                field.value = value || '';
            }
        }
    }
    // Load items
    const tbody = document.getElementById('itemsBody');
    tbody.innerHTML = '';
    (data.items || []).forEach(addRow);
    updateTotals();
    // Mostrar imagen de firma si existe
    if (data.signatureImage) {
        const container = document.getElementById('signatureImageContainer');
        container.innerHTML = `<img src="${data.signatureImage}" style="max-width:100%; max-height:100%;" />`;
    }
}

// Load from localStorage on password entry
function tryLoadFromStorage() {
    const password = document.getElementById('password').value;
    if (!password) return;
    const encrypted = localStorage.getItem('encryptedBill');
    if (!encrypted) return;
    try {
        const bytes = CryptoJS.AES.decrypt(encrypted, password);
        const json = bytes.toString(CryptoJS.enc.Utf8);
        if (json) {
            const data = JSON.parse(json);
            currentPassword = password;
            currentData = data;
            fillForm(data);
            showModal('Local data loaded successfully!');
        }
    } catch {
        // Invalid password or no data
    }
}

function addRow(item = {}) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><input name="concept" type="text" class="p-2 w-full bg-transparent border-b border-gray-200 focus:outline-none" value="${item.concept || ''}" placeholder="Descripción del servicio" /></td>
        <td><input name="hours" type="number" class="p-2 w-20 text-center bg-transparent border-b border-gray-200 focus:outline-none" value="${item.hours || 0}" min="0" step="0.5" /></td>
        <td><input name="rate" type="number" class="p-2 w-28 text-right bg-transparent border-b border-gray-200 focus:outline-none" value="${item.rate || 0}" min="0" step="1000" /></td>
        <td class="text-right font-semibold p-2"><span class="row-total"></span></td>
        <td class="no-print p-2"><button type="button" class="text-red-500 hover:text-red-700 delete-row">🗑️</button></td>`;
    document.getElementById('itemsBody').appendChild(tr);
    updateRowTotal(tr);
    attachRowListeners(tr);
}


function updateRowTotal(tr) {
    const hours = tr.querySelector('input[name=hours]').value;
    const rate = tr.querySelector('input[name=rate]').value;
    const total = calculateRowTotal(hours, rate);
    tr.querySelector('.row-total').textContent = total ? "$" + total.toLocaleString('es-CO') : '';
    updateTotals();
    autoSave();
}

function attachRowListeners(tr) {
    tr.querySelector('input[name=hours]')?.addEventListener('input', () => updateRowTotal(tr));
    tr.querySelector('input[name=rate]')?.addEventListener('input', () => updateRowTotal(tr));
    tr.querySelector('.delete-row')?.addEventListener('click', () => {
        tr.remove();
        updateTotals();
        autoSave();
    });
}

function updateTotals() {
    let total = 0;
    const rows = document.querySelectorAll('#itemsBody tr');
    rows.forEach(tr => {
        const hours = parseFloat(tr.querySelector('input[name=hours]').value) || 0;
        const rate = parseFloat(tr.querySelector('input[name=rate]').value) || 0;
        const subtotal = hours * rate;
        tr.querySelector('.row-total').textContent = subtotal ? "$" + subtotal.toLocaleString('es-CO') : '';
        total += subtotal;
    });
    document.getElementById('totalAmount').textContent = "$" + (total ? total.toLocaleString('es-CO') : '0');
}

// Inicialización y manejo de eventos
document.addEventListener('DOMContentLoaded', init);

async function init() {
    const sessionPass = sessionStorage.getItem('cuentaPassword');
    const sessionData = sessionStorage.getItem('cuentaData');
    const hasEncrypted = localStorage.getItem('encryptedBill');
    if (sessionPass && sessionData) {
        currentPassword = sessionPass;
        currentData = JSON.parse(sessionData);
        fillForm(currentData);
    } else if (hasEncrypted) {
        await loadDefaultData();
    } else {
        await loadDefaultData();
    }
    updateTotals();

    // Floating and modal controls
    document.getElementById('printFloatBtn').addEventListener('click', () => window.print());
    document.getElementById('optionsBtn').addEventListener('click', () => {
        const modal = document.getElementById('optionsModal');
        const passInput = document.getElementById('modalPassword');
        const saved = sessionStorage.getItem('cuentaPassword');
        passInput.value = saved ? '*****' : '';
        modal.classList.remove('hidden');
    });
    document.getElementById('optionsClose').addEventListener('click', () => {
        document.getElementById('optionsModal').classList.add('hidden');
    });
    document.getElementById('modalSave').addEventListener('click', () => {
        const val = document.getElementById('modalPassword').value;
        currentPassword = val;
        if (val) {
            sessionStorage.setItem('cuentaPassword', val);
        } else {
            sessionStorage.removeItem('cuentaPassword');
        }
        showModal('Clave de acceso guardada.');
    });
    document.getElementById('modalExport').addEventListener('click', exportJSONMemory);
    document.getElementById('modalClear').addEventListener('click', clearAndReload);
}
