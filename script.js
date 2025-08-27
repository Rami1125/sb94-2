// קובץ JavaScript להתממשקות עם Google Apps Script API

// ⚠️ עדכן את ה-URL הזה עם ה-URL האמיתי של הפריסה החדשה של יישום האינטרנט של Google Apps Script.
// זהו ה-URL שקיבלת לאחר הפריסה האחרונה.
const SCRIPT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwx_RT2pXdUyirOrCc-EiNx-oGO5zRwYoOWslFe9KVxQW-cpWlbF-WxOtsxcNqmFdBpCw/exec';

// URL של סקריפט Apps Script נפרד לרישום הודעות WhatsApp (⚠️ החלף ב-ID האמיתי של הסקריפט שלך)
// תצטרך פרויקט Apps Script נפרד שפרוס כיישום אינטרנט במיוחד לרישום הודעות WhatsApp.
const WHATSAPP_LOG_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx_Q8-t3tT3qG6-E9bF0-R9-j0t4t6s-x3t3y/exec';

// משתני מצב
let allOrders = [];
let filteredOrders = [];
let allDeliveryNotes = [];
let allAgents = [];

// אובייקטי Chart.js
let totalOrdersChart;
let newVsClosedChart;
let actionTypeChart;
let statusPieChart;

// --- פונקציות טעינה וטיפול בנתונים ---

/**
 * מפעיל את טעינת הנתונים הראשונית ומאתחל את האפליקציה.
 */
async function loadAllData() {
    showLoader();
    try {
        const ordersData = await fetchData({ action: 'readData', sheet: 'Orders' });
        allOrders = ordersData;
        
        const deliveryNotesData = await fetchData({ action: 'readData', sheet: 'DeliveryNotes' });
        allDeliveryNotes = deliveryNotesData;

        // שילוב נתונים לטבלת הלקוחות וקיזוז כפילויות
        const customerData = combineAndFilterCustomers(allOrders, allDeliveryNotes);
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
    // הוספת פרמטרים לבקשת GET
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
    const allEntries = [...orders, ...deliveryNotes];
    const customersMap = new Map();

    allEntries.forEach(entry => {
        const customerPhone = entry['טלפון'].trim();
        if (customersMap.has(customerPhone)) {
            // עדכון נתוני הלקוח הקיים
            const existingCustomer = customersMap.get(customerPhone);
            existingCustomer.totalOrders++;
            existingCustomer.lastAddress = entry['כתובת'].trim();
        } else {
            // יצירת אובייקט לקוח חדש
            customersMap.set(customerPhone, {
                name: entry['שם לקוח'].trim(),
                lastAddress: entry['כתובת'].trim(),
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
                <button onclick="handleCustomerAction('${customer.phone}')" class="text-white bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 font-medium rounded-lg text-xs px-2.5 py-1.5 transition-colors duration-200">
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
        loader.classList.remove('hidden');
    }
}

/**
 * מסתיר את לוחית הטעינה.
 */
function hideLoader() {
    const loader = document.getElementById('loader-overlay');
    if (loader) {
        loader.classList.add('hidden');
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

    // הגדרת סגנונות ואיקונים בהתאם לסוג ההודעה
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
    messageIcon.className = `${iconClass} mr-2`;
    messageText.textContent = message;

    // הסתרת התיבה לאחר 5 שניות
    setTimeout(() => {
        messageBox.classList.add('hidden');
    }, 5000);
}


/**
 * מפעיל את פונקציות הסינון ומעדכן את הטבלה.
 */
function filterTable() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const statusFilter = document.getElementById('filter-status-select').value;
    const agentFilter = document.getElementById('filter-agent-select').value;
    const actionTypeFilter = document.getElementById('filter-action-type-select').value;
    const showClosed = document.getElementById('show-closed-orders').checked;

    filteredOrders = allOrders.filter(order => {
        const orderStatus = order['סטטוס'];
        const orderActionType = order['סוג פעולה'];
        const orderAgent = order['סוכן מטפל'];
        const orderText = Object.values(order).join(' ').toLowerCase();

        // סינון לפי סטטוס
        if (statusFilter !== 'all' && orderStatus !== statusFilter) {
            return false;
        }

        // סינון לפי סוג פעולה
        if (actionTypeFilter !== 'all' && orderActionType !== actionTypeFilter) {
            return false;
        }

        // סינון לפי סוכן מטפל
        if (agentFilter !== 'all' && orderAgent !== agentFilter) {
            return false;
        }

        // סינון לפי טקסט חיפוש
        if (searchTerm && !orderText.includes(searchTerm)) {
            return false;
        }

        // סינון לפי "הצג הזמנות שנסגרו"
        if (!showClosed && orderStatus === 'סגור') {
            return false;
        }

        return true;
    });

    renderOrdersTable(filteredOrders);
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

// --- אירועים ופונקציות עזר ---

/**
 * מטפל בפעולות שבוצעו על הזמנות.
 * @param {string} docId מזהה המסמך.
 * @param {string} action סוג הפעולה ('update' או 'move').
 */
async function handleOrderAction(docId, action) {
    if (action === 'update') {
        // פתיחת חלון קופץ לעדכון
        const newStatus = prompt('הזן סטטוס חדש עבור הזמנה זו:');
        if (newStatus) {
            showLoader();
            try {
                await postData({
                    action: 'updateStatus',
                    docId: docId,
                    newStatus: newStatus
                });
                showMessageBox('הסטטוס עודכן בהצלחה!', 'success');
                // רענון הנתונים
                await loadAllData();
            } catch (error) {
                console.error('Failed to update status:', error);
                showMessageBox('שגיאה בעדכון הסטטוס.', 'error');
            } finally {
                hideLoader();
            }
        }
    } else if (action === 'move') {
        // אישור העברת הזמנה
        const confirmation = confirm('האם אתה בטוח שברצונך להעביר הזמנה זו לגיליון "DeliveryNotes"?');
        if (confirmation) {
            showLoader();
            try {
                await postData({
                    action: 'moveOrderToDelivery',
                    orderId: docId
                });
                showMessageBox('הזמנה הועברה בהצלחה לגיליון משלוחים!', 'success');
                // רענון הנתונים
                await loadAllData();
            } catch (error) {
                console.error('Failed to move order:', error);
                showMessageBox('שגיאה בהעברת ההזמנה.', 'error');
            } finally {
                hideLoader();
            }
        }
    }
}

/**
 * מאפשר מיון של טבלאות.
 * @param {string} tableId מזהה הטבלה.
 * @param {number} n אינדקס העמודה למיון.
 */
function sortTable(tableId, n) {
    let table, rows, switching, i, x, y, shouldSwitch, dir, switchcount = 0;
    table = document.getElementById(tableId);
    switching = true;
    dir = "asc"; // הגדרת כיוון המיון לראשונה כעולה

    while (switching) {
        switching = false;
        rows = table.rows;

        // לולאה על כל השורות בטבלה (מלבד הכותרות)
        for (i = 1; i < (rows.length - 1); i++) {
            shouldSwitch = false;
            x = rows[i].getElementsByTagName("TD")[n];
            y = rows[i + 1].getElementsByTagName("TD")[n];

            // בדיקת התוכן וקביעת אם צריך להחליף את השורות
            if (dir === "asc") {
                if (x.innerHTML.toLowerCase() > y.innerHTML.toLowerCase()) {
                    shouldSwitch = true;
                    break;
                }
            } else if (dir === "desc") {
                if (x.innerHTML.toLowerCase() < y.innerHTML.toLowerCase()) {
                    shouldSwitch = true;
                    break;
                }
            }
        }
        if (shouldSwitch) {
            rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
            switching = true;
            switchcount++;
        } else {
            // אם לא בוצעו החלפות והכיוון הוא עולה, שנה אותו ליורד והפעל שוב
            if (switchcount === 0 && dir === "asc") {
                dir = "desc";
                switching = true;
            }
        }
    }
}

/**
 * חוזר לראש הדף.
 */
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

/**
 * מעדכן את מצב כפתור "חזור למעלה" על פי מיקום הגלילה.
 */
window.onscroll = function() {
    const scrollToTopBtn = document.getElementById("scroll-to-top-btn");
    if (document.body.scrollTop > 200 || document.documentElement.scrollTop > 200) {
        scrollToTopBtn.style.display = "block";
    } else {
        scrollToTopBtn.style.display = "none";
    }
};

// --- פונקציות נוספות מהקובץ המקורי ---

function initializeTheme() {
    // פונקציה זו יכולה לטפל בנושאים של ערכת נושא (Theme)
}

function updateDashboardAndTables() {
    // עדכון טבלת ההזמנות
    filterTable();

    // קריאה לפונקציית עדכון ה-KPIs והגרפים
    updateKpisAndCharts();
}

/**
 * מאחזר רשימה של כל הסוכנים הייחודיים מתוך נתוני ההזמנות.
 * @returns {Array<string>} מערך של שמות סוכנים ייחודיים.
 */
function getUniqueAgents() {
    const agents = allOrders.map(order => order['סוכן מטפל']);
    return [...new Set(agents)].filter(agent => agent); // מסיר כפילויות וערכים ריקים
}

/**
 * עדכון הגרפים ולוח המחוונים (Dashboard) על בסיס הנתונים המעודכנים.
 */
function updateKpisAndCharts() {
    const kpiData = {
        totalOrders: allOrders.length + allDeliveryNotes.length,
        openOrders: allOrders.filter(o => o['סטטוס'] === 'פתוח').length,
        inProgressOrders: allOrders.filter(o => o['סטטוס'] === 'בתהליך').length,
        closedOrders: allDeliveryNotes.length
    };
    
    // עדכון תיבות ה-KPI ב-HTML
    document.getElementById('total-orders-kpi').textContent = kpiData.totalOrders;
    document.getElementById('open-orders-kpi').textContent = kpiData.openOrders;
    document.getElementById('in-progress-orders-kpi').textContent = kpiData.inProgressOrders;
    document.getElementById('closed-orders-kpi').textContent = kpiData.closedOrders;

    // עדכון הגרפים
    // (הנחה שפונקציות init/updateCharts קיימות ומוכנות לשימוש)
    initCharts();
}

/**
 * מאתחל את כל הגרפים בדף.
 */
function initCharts() {
    // דוגמה לאתחול גרף אחד:
    const ctxTotal = document.getElementById('totalOrdersChart').getContext('2d');
    if (totalOrdersChart) {
        totalOrdersChart.destroy();
    }
    totalOrdersChart = new Chart(ctxTotal, {
        type: 'bar',
        data: {
            labels: ['הזמנות פתוחות', 'הזמנות שנסגרו'],
            datasets: [{
                label: 'מספר הזמנות',
                data: [
                    allOrders.filter(o => o['סטטוס'] !== 'סגור').length,
                    allDeliveryNotes.length
                ],
                backgroundColor: ['#2196F3', '#4CAF50'],
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    // יש להוסיף כאן אתחול לגרפים נוספים כמו newVsClosedChart, actionTypeChart וכו'.
}

/**
 * פונקציה לעדכון ה-UI לאחר שינוי.
 * יש לרענן את לוחות המחוונים והטבלאות.
 */
function updateUiAfterChange() {
    // עדכון הטבלה
    filterTable(); 
    // עדכון ה-KPIs והגרפים
    updateKpisAndCharts();
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

