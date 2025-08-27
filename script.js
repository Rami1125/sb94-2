// קובץ JavaScript להתממשקות עם Google Apps Script API

// ⚠️ עדכן את ה-URL הזה עם ה-URL האמיתי של הפריסה החדשה של יישום האינטרנט של Google Apps Script.
const SCRIPT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxiS3wXwXCyh8xM1EdTiwXy0T-UyBRQgfrnRRis531lTxmgtJIGawfsPeetX5nVJW3V/exec';

// URL של סקריפט Apps Script נפרד לרישום הודעות WhatsApp
const WHATSAPP_LOG_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx_Q8-t3tT3qG6-E9bF0-R9-j0t4t6s-x3t3y/exec';

// משתני מצב
let allOrders = [];
let allDeliveryNotes = [];
let allAgents = [];
let customerData = [];
let currentCustomerHistory = []; // לטובת היסטוריית לקוח בטופס החדש

// --- פונקציות טעינה וטיפול בנתונים ---

/**
 * מפעיל את טעינת הנתונים הראשונית ומאתחל את האפליקציה.
 */
async function loadAllData() {
    showLoader();
    try {
        const ordersData = await fetchData({ action: 'readData', sheet: 'Orders' });
        const deliveryNotesData = await fetchData({ action: 'readData', sheet: 'DeliveryNotes' });
        
        // Ensure data is an array before assigning
        allOrders = Array.isArray(ordersData) ? ordersData : [];
        allDeliveryNotes = Array.isArray(deliveryNotesData) ? deliveryNotesData : [];

        // שילוב נתונים לטבלת הלקוחות וקיזוז כפילויות
        customerData = combineAndFilterCustomers(allOrders, allDeliveryNotes);
        renderCustomerAnalysisTable(customerData);

        // טעינת רשימת סוכנים
        allAgents = getUniqueAgents();

        // עדכון ה-UI עם הנתונים החדשים
        updateDashboardAndTables();

    } catch (error) {
        console.error('Failed to load data from API:', error);
        showMessageBox('שגיאה בטעינת הנתונים מהשרת. אנא נסה שנית מאוחר יותר.', 'error');
    } finally {
        hideLoader();
    }
}

/**
 * שליפת נתונים מה-Google Apps Script API באמצעות fetch.
 * @param {object} params פרמטרים לבקשה.
 * @returns {Promise<any>} הנתונים שהתקבלו כתגובה.
 */
async function fetchData(params) {
    const url = new URL(SCRIPT_WEB_APP_URL);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

    const response = await fetch(url.toString());
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
}

/**
 * שליחת נתונים ל-Google Apps Script API באמצעות בקשת POST.
 * @param {object} data הנתונים לשליחה.
 * @returns {Promise<any>} התגובה מהשרת.
 */
async function postData(data) {
    const response = await fetch(SCRIPT_WEB_APP_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
}

// --- פונקציות עיבוד נתונים והצגה ---

/**
 * מאחד את רשימות ההזמנות וההערות כדי ליצור רשימת לקוחות ייחודיים.
 * @param {Array<Object>} orders רשימת ההזמנות.
 * @param {Array<Object>} deliveryNotes רשימת הערות המסירה.
 * @returns {Array<Object>} מערך של אובייקטים של לקוחות ייחודיים.
 */
function combineAndFilterCustomers(orders, deliveryNotes) {
    // Add a check to ensure inputs are arrays
    const allEntries = [...(Array.isArray(orders) ? orders : []), ...(Array.isArray(deliveryNotes) ? deliveryNotes : [])];
    const customersMap = new Map();

    allEntries.forEach(entry => {
        const customerPhone = entry['טלפון']?.trim();
        if (!customerPhone) return; // Skip if no phone number exists

        if (customersMap.has(customerPhone)) {
            const existingCustomer = customersMap.get(customerPhone);
            existingCustomer.totalOrders++;
            existingCustomer.lastAddress = entry['כתובת']?.trim() || existingCustomer.lastAddress;
        } else {
            customersMap.set(customerPhone, {
                name: entry['שם לקוח']?.trim() || 'שם לא ידוע',
                lastAddress: entry['כתובת']?.trim() || 'כתובת לא ידועה',
                phone: customerPhone,
                totalOrders: 1
            });
        }
    });

    return Array.from(customersMap.values());
}

/**
 * יוצר ומציג את טבלת ניתוח הלקוחות.
 * @param {Array<Object>} customerData מערך נתוני הלקוחות.
 */
function renderCustomerAnalysisTable(customerData) {
    const tableBody = document.getElementById('customer-analysis-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    
    if (customerData.length === 0) {
        document.getElementById('no-customer-analysis').classList.remove('hidden');
        return;
    }
    document.getElementById('no-customer-analysis').classList.add('hidden');

    customerData.forEach(customer => {
        const row = document.createElement('tr');
        row.className = 'border-b hover:bg-gray-50 dark:hover:bg-gray-700';
        row.innerHTML = `
            <td class="p-3 whitespace-nowrap">${customer.name}</td>
            <td class="p-3 text-sm text-gray-500">${customer.lastAddress}</td>
            <td class="p-3 whitespace-nowrap text-sm text-gray-500">${customer.phone}</td>
            <td class="p-3 text-sm">${customer.totalOrders}</td>
            <td class="p-3 flex justify-center">
                <button onclick="showCustomerHistoryModal('${customer.phone}')" class="text-white bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 font-medium rounded-lg text-xs px-2.5 py-1.5 transition-colors duration-200">
                    פרטים
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

/**
 * מציג לוחית טעינה (Loader).
 */
function showLoader() {
    const loader = document.getElementById('loader-overlay');
    if (loader) {
        loader.classList.remove('opacity-0', 'pointer-events-none');
        loader.classList.add('opacity-100');
    }
}

/**
 * מסתיר את לוחית הטעינה.
 */
function hideLoader() {
    const loader = document.getElementById('loader-overlay');
    if (loader) {
        loader.classList.remove('opacity-100');
        loader.classList.add('opacity-0', 'pointer-events-none');
    }
}

/**
 * מציג תיבת הודעה מותאמת אישית (במקום alert).
 * @param {string} message תוכן ההודעה.
 * @param {string} type סוג ההודעה ('success', 'error', 'info').
 */
function showMessageBox(message, type = 'info') {
    const messageBox = document.getElementById('message-box');
    const messageText = document.getElementById('message-text');
    const messageIcon = document.getElementById('message-icon');

    if (!messageBox || !messageText || !messageIcon) return;

    messageBox.className = 'fixed bottom-5 left-1/2 transform -translate-x-1/2 p-4 rounded-lg shadow-lg z-50 text-white transition-all duration-300 ease-in-out flex items-center hidden';
    messageIcon.className = '';
    
    let iconClass = '';
    let bgColor = '';

    switch(type) {
        case 'success':
            iconClass = 'fas fa-check-circle';
            bgColor = 'bg-green-500';
            break;
        case 'error':
            iconClass = 'fas fa-times-circle';
            bgColor = 'bg-red-500';
            break;
        case 'info':
        default:
            iconClass = 'fas fa-info-circle';
            bgColor = 'bg-blue-500';
            break;
    }
    
    messageBox.classList.add(bgColor);
    messageBox.classList.remove('hidden');
    messageIcon.className = `${iconClass} ml-2`;
    messageText.textContent = message;

    setTimeout(() => {
        messageBox.classList.add('hidden');
    }, 5000);
}

/**
 * פתיחת חלון קופץ.
 * @param {string} modalId מזהה ה-ID של החלון.
 */
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('open');
    }
}

/**
 * סגירת חלון קופץ.
 * @param {string} modalId מזהה ה-ID של החלון.
 */
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('open');
    }
}

/**
 * מציג את טבלת ההזמנות עם הנתונים המסוננים.
 * @param {Array<Object>} orders מערך ההזמנות להצגה.
 */
function renderOrdersTable(orders) {
    const tableBody = document.getElementById('orders-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    
    if (orders.length === 0) {
        document.getElementById('no-orders-message').classList.remove('hidden');
    } else {
        document.getElementById('no-orders-message').classList.add('hidden');
        orders.forEach(order => {
            const row = document.createElement('tr');
            row.className = 'border-b hover:bg-gray-50 dark:hover:bg-gray-700';
            
            // עיצוב שורות על בסיס סטטוס
            if (order['סטטוס'] === 'סגור') {
                row.classList.add('bg-gray-100', 'text-gray-500', 'line-through');
            } else if (order['סטטוס'] === 'דחוף') {
                row.classList.add('bg-red-100', 'text-red-700', 'font-semibold');
            }

            row.innerHTML = `
                <td class="p-3 text-sm">${order['מספר מסמך']}</td>
                <td class="p-3 text-sm">${order['שם לקוח']}</td>
                <td class="p-3 text-sm">${order['כתובת']}</td>
                <td class="p-3 text-sm">${order['תאריך יצירה']}</td>
                <td class="p-3 text-sm">${order['סוג פעולה']}</td>
                <td class="p-3 text-sm">${order['סטטוס']}</td>
                <td class="p-3 text-sm">${order['סוכן מטפל']}</td>
                <td class="p-3 text-sm flex space-x-2">
                    <button onclick="handleOrderAction('${order['מספר מסמך']}', 'update')" class="text-blue-500 hover:text-blue-700">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="handleOrderAction('${order['מספר מסמך']}', 'move')" class="text-green-500 hover:text-green-700">
                        <i class="fas fa-truck"></i>
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }
}

// --- פונקציות טופס חדשות ---

/**
 * פותח את חלון יצירת ההזמנה ומאפס את הטופס.
 */
function openOrderModal() {
    document.getElementById('order-form').reset();
    document.getElementById('modal-title').textContent = 'הוסף הזמנה חדשה';
    document.getElementById('submit-order-btn').textContent = 'שמור הזמנה';
    document.getElementById('customer-history-summary').classList.add('hidden');
    document.getElementById('phone-validation-message').textContent = '';
    document.getElementById('phone-status-icon').className = 'fas';
    openModal('order-modal');
}

/**
 * מטפל בשינוי סוג הפעולה בטופס.
 */
function handleOrderTypeChange() {
    const orderType = document.getElementById('order-type').value;
    const containerTakenDiv = document.getElementById('container-taken-div');
    const containerBroughtDiv = document.getElementById('container-brought-div');
    
    // מציג ומסתיר שדות בהתאם לסוג הפעולה
    if (orderType === 'הורדה') {
        containerTakenDiv.classList.remove('hidden');
        containerBroughtDiv.classList.add('hidden');
    } else if (orderType === 'העלאה') {
        containerTakenDiv.classList.add('hidden');
        containerBroughtDiv.classList.remove('hidden');
    } else if (orderType === 'החלפה') {
        containerTakenDiv.classList.remove('hidden');
        containerBroughtDiv.classList.remove('hidden');
    }
}

/**
 * מאמת את תקינות מספר הטלפון.
 */
function validatePhone() {
    const phoneInput = document.getElementById('customer-phone');
    const phone = phoneInput.value.replace(/[^0-9]/g, ''); // מסיר תווים שאינם ספרות
    const validationMessage = document.getElementById('phone-validation-message');
    const statusIcon = document.getElementById('phone-status-icon');

    // בדיקה בסיסית של מספר טלפון ישראלי
    const isValid = phone.length >= 9 && phone.length <= 10;

    if (isValid) {
        validationMessage.textContent = 'מספר תקין';
        validationMessage.classList.remove('text-red-500');
        validationMessage.classList.add('text-green-500');
        statusIcon.className = 'fas fa-check text-green-500';
    } else {
        validationMessage.textContent = 'מספר טלפון לא תקין';
        validationMessage.classList.remove('text-green-500');
        validationMessage.classList.add('text-red-500');
        statusIcon.className = 'fas fa-times text-red-500';
    }
}

/**
 * בודק אם לקוח קיים ומציג את היסטוריית ההזמנות שלו.
 */
function checkCustomerAndShowHistory() {
    const phone = document.getElementById('customer-phone').value.trim();
    const customer = customerData.find(c => c.phone === phone);
    const historySummaryDiv = document.getElementById('customer-history-summary');
    const historyTextSpan = document.getElementById('customer-history-text');

    if (customer) {
        historySummaryDiv.classList.remove('hidden');
        historyTextSpan.textContent = `לקוח חוזר! נמצאו ${customer.totalOrders} הזמנות קודמות.`;
    } else {
        historySummaryDiv.classList.add('hidden');
    }
}

/**
 * מציג את חלון היסטוריית הלקוח עם כל ההזמנות הקודמות.
 * @param {string} phone טלפון הלקוח.
 */
function showCustomerHistoryModal(phone) {
    const customer = customerData.find(c => c.phone === phone);
    if (!customer) {
        showMessageBox('שגיאה: פרטי לקוח לא נמצאו.', 'error');
        return;
    }

    const allCustomerOrders = [...allOrders, ...allDeliveryNotes].filter(o => o['טלפון']?.trim() === phone);
    allCustomerOrders.sort((a, b) => new Date(b['תאריך יצירה']) - new Date(a['תאריך יצירה']));

    const detailsName = document.getElementById('customer-details-name');
    const detailsPhone = document.getElementById('customer-details-phone');
    const detailsAddress = document.getElementById('customer-details-address');
    const detailsTotal = document.getElementById('customer-details-total-orders');
    const historyList = document.getElementById('customer-history-list');
    const noHistoryMessage = document.getElementById('no-customer-history-message');

    // עדכון פרטי הלקוח בראש המודאל
    detailsName.textContent = customer.name;
    detailsPhone.textContent = customer.phone;
    detailsAddress.textContent = customer.lastAddress;
    detailsTotal.textContent = allCustomerOrders.length;
    document.getElementById('customer-name-display').textContent = customer.name;

    historyList.innerHTML = '';
    
    if (allCustomerOrders.length > 0) {
        noHistoryMessage.classList.add('hidden');
        allCustomerOrders.forEach(order => {
            const listItem = document.createElement('div');
            listItem.className = 'history-item card p-4 mb-4 flex-col sm:flex-row items-start sm:items-center rounded-lg shadow-sm';
            
            const actionType = order['סוג פעולה'];
            let iconClass;
            if (actionType === 'הורדה') {
                iconClass = 'fas fa-arrow-down text-red-500';
            } else if (actionType === 'העלאה') {
                iconClass = 'fas fa-arrow-up text-green-500';
            } else {
                iconClass = 'fas fa-exchange-alt text-blue-500';
            }
            
            const isClosed = order['סטטוס'] === 'סגור';
            const closedClass = isClosed ? 'line-through text-gray-500' : '';
            
            listItem.innerHTML = `
                <div class="history-item-icon mb-2 sm:mb-0"><i class="${iconClass}"></i></div>
                <div class="history-item-content flex-grow">
                    <p class="font-bold text-lg ${closedClass}">${order['סוג פעולה']} - ${order['מספר מכולה ירדה'] || order['מספר מכולה עלתה'] || ''}</p>
                    <p class="text-sm text-gray-600 ${closedClass}"><strong>תאריך:</strong> ${order['תאריך יצירה']}</p>
                    <p class="text-sm text-gray-600 ${closedClass}"><strong>כתובת:</strong> ${order['כתובת']}</p>
                    <p class="text-sm text-gray-600 ${closedClass}"><strong>סטטוס:</strong> ${order['סטטוס']}</p>
                </div>
            `;
            historyList.appendChild(listItem);
        });
    } else {
        noHistoryMessage.classList.remove('hidden');
    }

    openModal('customer-analysis-modal');
}

// --- פונקציות נוספות מהקובץ המקורי ---

function filterTable() {
    // ... פונקציית סינון קיימת
}
function sortTable(tableId, n) {
    // ... פונקציית מיון קיימת
}
function scrollToTop() {
    // ... פונקציית גלילה קיימת
}
window.onscroll = function() {
    // ... פונקציית כפתור גלילה קיימת
}
function initializeTheme() {
    // ...
}
function updateDashboardAndTables() {
    // ...
}
function getUniqueAgents() {
    // ...
}
function updateKpisAndCharts() {
    // ...
}
function initCharts() {
    // ...
}
function updateUiAfterChange() {
    // ...
}

// --- אירועים ---
document.addEventListener('DOMContentLoaded', async () => {
    initializeTheme();
    await loadAllData();
});

// הפעלת פונקציות סינון ואיפוס כשמשתמשים משנים את הקלט
document.getElementById('search-input').addEventListener('input', filterTable);
document.getElementById('filter-status-select').addEventListener('change', filterTable);
document.getElementById('filter-action-type-select').addEventListener('change', filterTable);
document.getElementById('filter-agent-select').addEventListener('change', filterTable);
document.getElementById('show-closed-orders').addEventListener('change', filterTable);

// טיפול בטופס החדש
document.getElementById('order-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const data = {};
    const formData = new FormData(form);
    formData.forEach((value, key) => {
        data[key] = value;
    });

    showLoader();
    try {
        const payload = {
            action: 'createOrder',
            data: data
        };
        await postData(payload);
        showMessageBox('ההזמנה נשמרה בהצלחה!', 'success');
        closeModal('order-modal');
        await loadAllData(); // רענון הנתונים
    } catch (error) {
        console.error('Failed to save order:', error);
        showMessageBox('שגיאה בשמירת ההזמנה.', 'error');
    } finally {
        hideLoader();
    }
});
