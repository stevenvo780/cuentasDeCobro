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
window.clearAndReload = clearAndReload;
let currentPassword = '';
let currentData = null;

// Cargar datos por defecto desde defaultData.json con manejo de errores
async function loadDefaultData() {
    try {
        const res = await fetch('defaultData.json');
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

function loadFile(event) {
    let password = document.getElementById('password').value;
    if (!password) {
        // Si hay una sesión previa, usarla
        password = sessionStorage.getItem('cuentaPassword') || '';
        if (!password) {
            showModal('Enter a password first to encrypt your data.');
            event.target.value = '';
            return;
        }
    }
    const file = event.target.files[0];
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
    event.target.value = '';
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
    (data.items || []).forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><input name="concept" type="text" class="p-2 w-full bg-transparent border-b border-gray-200" value="${item.concept || ''}" /></td>
            <td><input name="hours" type="number" class="p-2 w-20 text-center bg-transparent border-b border-gray-200" value="${item.hours || ''}" min="0" onchange="updateRowTotal(this)" /></td>
            <td><input name="rate" type="number" class="p-2 w-28 text-right bg-transparent border-b border-gray-200" value="${item.rate || ''}" min="0" onchange="updateRowTotal(this)" /></td>
            <td class="text-right font-semibold"><span class="row-total"></span></td>
            <td class="no-print"><button type="button" onclick="deleteRow(this)" class="text-red-500">🗑️</button></td>`;
        tbody.appendChild(tr);
    });
    updateTotals();
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

function addRow() {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><input name="concept" type="text" class="p-2 w-full bg-transparent border-b border-gray-200" /></td>
        <td><input name="hours" type="number" class="p-2 w-20 text-center bg-transparent border-b border-gray-200" value="0" min="0" onchange="updateRowTotal(this)" /></td>
        <td><input name="rate" type="number" class="p-2 w-28 text-right bg-transparent border-b border-gray-200" value="0" min="0" onchange="updateRowTotal(this)" /></td>
        <td class="text-right font-semibold"><span class="row-total"></span></td>
        <td class="no-print"><button type="button" onclick="deleteRow(this)" class="text-red-500">🗑️</button></td>`;
    document.getElementById('itemsBody').appendChild(tr);
}

function deleteRow(btn) {
    btn.closest('tr').remove();
    updateTotals();
    autoSave();
}

function updateRowTotal(input) {
    const tr = input.closest('tr');
    const hours = parseFloat(tr.querySelector('input[name=hours]').value) || 0;
    const rate = parseFloat(tr.querySelector('input[name=rate]').value) || 0;
    const total = hours * rate;
    tr.querySelector('.row-total').textContent = total ? "$" + total.toLocaleString('es-CO') : '';
    updateTotals();
    autoSave();
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

// Registrar funciones globales para el HTML
window.clearAndReload = clearAndReload;
window.saveFile = saveFile;
window.exportJSONMemory = exportJSONMemory;
window.loadFile = loadFile;
window.addRow = addRow;
window.deleteRow = deleteRow;
window.updateRowTotal = updateRowTotal;

// Event listeners
window.addEventListener('DOMContentLoaded', async () => {
    // Si hay sesión previa, restaurar
    const sessionPass = sessionStorage.getItem('cuentaPassword');
    const sessionData = sessionStorage.getItem('cuentaData');
    const hasEncrypted = localStorage.getItem('encryptedBill');
    if (sessionPass && sessionData) {
        currentPassword = sessionPass;
        currentData = JSON.parse(sessionData);
        fillForm(currentData);
    } else if (hasEncrypted) {
        // Si hay datos encriptados pero no sesión, esperar a que el usuario ingrese la clave
        await loadDefaultData(); // Para que el formulario no esté vacío
    } else {
        // Si no hay nada, cargar los datos por defecto (incluye items)
        await loadDefaultData();
    }
    // Limpiar el total al inicio si no hay items
    updateTotals();
    document.getElementById('cuentaForm').addEventListener('input', () => {
        updateTotals();
        autoSave();
    });
    document.getElementById('password').addEventListener('input', tryLoadFromStorage);
});
