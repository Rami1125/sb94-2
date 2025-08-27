// URL of your Google Apps Script for Orders
const ORDERS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxiS3wXwXCyh8xM1EdTiwXy0T-UyBRQgfrnRRis531lTxmgtJIGawfsPeetX5nVJW3V/exec';

// URL of your Google Apps Script for Delivery Notes
// This should be a separate script or a different sheet tab handled by the same script
const DELIVERY_NOTES_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzP0wjHzQrvo0pzSigKuJX25xvqIck8IQGXildOp-BEOqaT5Yvf9odw4_OeP4y9dyEzrQ/exec';

let allDocuments = []; // Stores all documents (orders and delivery notes)
let customers = []; // Stores unique customer names for autofill

// --- Utility Functions ---
function showLoader() { document.getElementById('loader-overlay').classList.remove('opacity-0', 'pointer-events-none'); }
function hideLoader() { document.getElementById('loader-overlay').classList.add('opacity-0', 'pointer-events-none'); }

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

function showAlert(message, type = 'info') {
    const container = document.getElementById('alert-container');
    const alertItem = document.createElement('div');
    let bgColor, icon, textColor, borderColor;
    switch(type) {
        case 'success': bgColor = 'bg-green-50'; borderColor = 'border-green-500'; textColor = 'text-green-700'; icon = 'fa-check-circle'; break;
        case 'error': bgColor = 'bg-red-50'; borderColor = 'border-red-500'; textColor = 'text-red-700'; icon = 'fa-times-circle'; break;
        case 'warning': bgColor = 'bg-yellow-50'; borderColor = 'border-yellow-500'; textColor = 'text-yellow-700'; icon = 'fa-exclamation-triangle'; break;
        default: bgColor = 'bg-blue-50'; borderColor = 'border-blue-500'; textColor = 'text-blue-700'; icon = 'fa-info-circle'; break;
    }
    alertItem.className = `p-4 rounded-lg border-l-4 shadow-md flex items-center gap-3 transform translate-x-full opacity-0 transition-all duration-500 ease-out ${bgColor} ${borderColor} ${textColor}`;
    alertItem.innerHTML = `<i class="fas ${icon}"></i><p>${message}</p>`;
    container.prepend(alertItem);
    
    setTimeout(() => {
        alertItem.style.transform = 'translateX(0)';
        alertItem.style.opacity = '1';
    }, 100);

    setTimeout(() => {
        alertItem.style.transform = 'translateX(100%)';
        alertItem.style.opacity = '0';
        setTimeout(() => alertItem.remove(), 500);
    }, 5000);
}

// --- API Communication Function with Exponential Backoff ---
async function fetchData(action, params = {}, retries = 0, scriptUrl = ORDERS_SCRIPT_URL) {
    showLoader();
    const urlParams = new URLSearchParams({ action, ...params });
    const url = `${scriptUrl}?${urlParams.toString()}`;
    console.log(`[fetchData] Request URL: ${url}`);
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (!response.ok) {
            const errorMessage = data.message || `שגיאת שרת HTTP: ${response.status}`;
            showAlert(errorMessage, 'error');
            return { success: false, message: errorMessage };
        }
        if (!data.success && data.message && data.message.includes('Service invoked too many times')) {
            const delay = Math.pow(2, retries) * 1000;
            if (retries < 5) {
                console.warn(`[fetchData] Retrying in ${delay}ms... (Attempt ${retries + 1})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return fetchData(action, params, retries + 1, scriptUrl);
            } else {
                showAlert('השרת עמוס מדי, אנא נסה שוב מאוחר יותר.', 'error');
                return { success: false, message: 'Service too busy' };
            }
        } else if (!data.success) {
            showAlert(data.message || 'פעולה נכשלה בשרת.', 'error');
            return data;
        }
        return data;
    } catch (error) {
        showAlert('שגיאת תקשורת: לא ניתן להתחבר לשרת.', 'error');
        return { success: false, message: error.message };
    } finally {
        hideLoader();
    }
}

// --- Data Fetching and UI Rendering ---
async function fetchDocuments() {
    // This is a placeholder. In a real-world scenario, you would fetch from two different endpoints
    // or from a single endpoint that returns both types of documents.
    // For this example, we will simulate this by fetching from a single URL and assuming
    // the data contains both "הזמנה" and "תעודת משלוח".
    const ordersData = await fetchData('getOrders');
    const deliveryNotesData = await fetchData('getDeliveryNotes', {}, 0, DELIVERY_NOTES_SCRIPT_URL);

    let allDocs = [];
    if (ordersData.success && Array.isArray(ordersData.data)) {
        allDocs = allDocs.concat(ordersData.data.map(d => ({ ...d, type: 'הזמנה' })));
    }
    if (deliveryNotesData.success && Array.isArray(deliveryNotesData.data)) {
        allDocs = allDocs.concat(deliveryNotesData.data.map(d => ({ ...d, type: 'תעודת משלוח' })));
    }

    allDocuments = allDocs;
    updateCustomerDataList();
    renderDocumentsTable(allDocuments);
}

function updateCustomerDataList() {
    const uniqueCustomers = new Set();
    allDocuments.forEach(doc => {
        if (doc['שם לקוח']) {
            uniqueCustomers.add(doc['שם לקוח']);
        }
    });

    const datalist = document.getElementById('customer-list');
    datalist.innerHTML = '';
    uniqueCustomers.forEach(customer => {
        const option = document.createElement('option');
        option.value = customer;
        datalist.appendChild(option);
    });

    customers = Array.from(uniqueCustomers).map(name => {
        const doc = allDocuments.find(d => d['שם לקוח'] === name);
        return {
            name: doc['שם לקוח'],
            address: doc['כתובת'],
            phone: doc['טלפון לקוח']
        };
    });
}

function renderDocumentsTable(documents) {
    const tableBody = document.getElementById('documents-table-body');
    tableBody.innerHTML = '';

    if (documents.length === 0) {
        document.getElementById('no-documents').classList.remove('hidden');
        return;
    }
    document.getElementById('no-documents').classList.add('hidden');

    documents.forEach(doc => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors';
        
        let statusColorClass = 'text-[var(--color-text-base)]';
        let actionsHtml = '';

        if (doc.type === 'הזמנה' && doc['סטטוס'] !== 'הושלם') {
            statusColorClass = 'text-[var(--color-warning)]';
            actionsHtml = `<button onclick="convertToDeliveryNote('${doc['מספר מסמך']}')" class="bg-[var(--color-accent)] text-white px-3 py-1 rounded-full text-xs hover:bg-[var(--color-info)] transition-colors">
                            הפוך לתעודת משלוח
                           </button>`;
        } else if (doc.type === 'תעודת משלוח') {
            statusColorClass = 'text-[var(--color-success)]';
        }

        row.innerHTML = `
            <td class="p-3 whitespace-nowrap">${doc['מספר מסמך']}</td>
            <td class="p-3 whitespace-nowrap">${doc.type}</td>
            <td class="p-3 whitespace-nowrap">${doc['תאריך']}</td>
            <td class="p-3 whitespace-nowrap">${doc['שם לקוח']}</td>
            <td class="p-3 whitespace-nowrap">${doc['כתובת']}</td>
            <td class="p-3 whitespace-nowrap"><span class="${statusColorClass}">${doc['סטטוס']}</span></td>
            <td class="p-3">
                <div class="flex gap-2">
                    ${actionsHtml}
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// --- New Document Handling (Modal and Form) ---
const docForm = document.getElementById('document-form');
const docNumberInput = document.getElementById('doc-number-input');
const docTypeSelect = document.getElementById('doc-type-select');
const customerNameInput = document.getElementById('customer-name-input');
const customerAddressInput = document.getElementById('customer-address-input');
const customerPhoneInput = document.getElementById('customer-phone-input');
const existingCustomerCheckbox = document.getElementById('existing-customer-checkbox');

document.getElementById('add-order-btn').addEventListener('click', () => {
    openModal('document-modal');
    // Set default values for a new order
    docNumberInput.value = generateDocNumber('הזמנה');
    docTypeSelect.value = 'הזמנה';
    document.getElementById('doc-date-input').value = new Date().toISOString().slice(0, 10);
    // Clear other fields for a new document
    customerNameInput.value = '';
    customerAddressInput.value = '';
    customerPhoneInput.value = '';
    existingCustomerCheckbox.checked = false;
    document.getElementById('modal-title').textContent = 'יצירת הזמנה חדשה';
});

docTypeSelect.addEventListener('change', () => {
    docNumberInput.value = generateDocNumber(docTypeSelect.value);
});

existingCustomerCheckbox.addEventListener('change', (e) => {
    if (e.target.checked) {
        customerNameInput.addEventListener('input', autofillCustomerData);
    } else {
        customerNameInput.removeEventListener('input', autofillCustomerData);
    }
});

function autofillCustomerData() {
    const customer = customers.find(c => c.name === customerNameInput.value);
    if (customer) {
        customerAddressInput.value = customer.address;
        customerPhoneInput.value = customer.phone;
    }
}

function generateDocNumber(type) {
    // In a real-world scenario, the backend would generate this number.
    // For this client-side example, we'll use a simple simulation.
    const prefix = type === 'הזמנה' ? '620' : '671';
    const lastDoc = allDocuments.filter(doc => doc.type === type).pop();
    const lastNum = lastDoc ? parseInt(lastDoc['מספר מסמך'].replace(prefix, '')) : 0;
    const newNum = lastNum + 1;
    return `${prefix}${String(newNum).padStart(4, '0')}`;
}

docForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(docForm);
    const docData = Object.fromEntries(formData.entries());

    docData['מספר מסמך'] = docNumberInput.value;
    docData['סוג מסמך'] = docTypeSelect.value;
    
    // Default status if not provided
    docData['סטטוס'] = docData['סטטוס'] || 'חדש';
    
    // Add customer data if new customer
    if (!customers.find(c => c.name === docData['customer-name'])) {
        customers.push({
            name: docData['customer-name'],
            address: docData['customer-address'],
            phone: docData['customer-phone']
        });
        updateCustomerDataList();
    }
    
    let result;
    if (docData['סוג מסמך'] === 'הזמנה') {
        result = await fetchData('addOrder', docData);
    } else {
        result = await fetchData('addDeliveryNote', docData, 0, DELIVERY_NOTES_SCRIPT_URL);
    }

    if (result.success) {
        showAlert('המסמך נשמר בהצלחה!', 'success');
        closeModal('document-modal');
        fetchDocuments(); // Refresh the table
    } else {
        showAlert('שגיאה בשמירת המסמך.', 'error');
    }
});

async function convertToDeliveryNote(orderNumber) {
    const orderToConvert = allDocuments.find(doc => doc['מספר מסמך'] === orderNumber);
    if (!orderToConvert) {
        showAlert('הזמנה לא נמצאה.', 'error');
        return;
    }

    showLoader();
    // 1. Get a new delivery note number from the server or simulate
    const newDeliveryNoteNumber = generateDocNumber('תעודת משלוח');
    
    // 2. Create the new delivery note document data
    const deliveryNoteData = {
        'מספר מסמך': newDeliveryNoteNumber,
        'סוג מסמך': 'תעודת משלוח',
        'תאריך': orderToConvert['תאריך'],
        'שם לקוח': orderToConvert['שם לקוח'],
        'כתובת': orderToConvert['כתובת'],
        'טלפון לקוח': orderToConvert['טלפון לקוח'],
        'סטטוס': 'הושלם',
        'מספר הזמנה מקושר': orderNumber
    };

    // 3. Save the new delivery note to its spreadsheet
    const deliveryNoteResult = await fetchData('addDeliveryNote', deliveryNoteData, 0, DELIVERY_NOTES_SCRIPT_URL);

    if (deliveryNoteResult.success) {
        // 4. Update the original order's status to 'Completed' in its spreadsheet
        const updateOrderResult = await fetchData('updateOrderStatus', {
            'מספר מסמך': orderNumber,
            'סטטוס': 'הושלם'
        });

        if (updateOrderResult.success) {
            showAlert(`הזמנה ${orderNumber} הומרה בהצלחה לתעודת משלוח ${newDeliveryNoteNumber}.`, 'success');
            fetchDocuments(); // Refresh data to show changes
        } else {
            showAlert('המרת ההזמנה לתעודת משלוח נכשלה.', 'error');
        }
    } else {
        showAlert('שגיאה ביצירת תעודת משלוח חדשה.', 'error');
    }
    hideLoader();
}


// --- Scroll to Top Button ---
window.onscroll = function() { scrollFunction() };
function scrollFunction() {
    const scrollToTopBtn = document.getElementById("scroll-to-top-btn");
    if (document.body.scrollTop > 200 || document.documentElement.scrollTop > 200) {
        scrollToTopBtn.classList.remove('opacity-0', 'pointer-events-none');
    } else {
        scrollToTopBtn.classList.add('opacity-0', 'pointer-events-none');
    }
}
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// Initial load and setup
document.addEventListener('DOMContentLoaded', async () => {
    await fetchDocuments();
});
