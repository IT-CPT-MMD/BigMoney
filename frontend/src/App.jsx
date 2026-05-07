import { useMemo } from "react";
import "./styles.css";

const loginMarkup = `<div id="toastRoot" class="toast-root"></div>
  <main class="login-shell">
    <section class="login-brand reveal-up">
      <img src="assets/logo.png" class="brand-logo-xl" alt="BM Logo">
      <h1>BM Transaction System</h1>
      <p>Secure transaction balancing dashboard with Myanmar live time, role access, limits, risk reports, auto generated formats, and real-time history.</p>
      <div class="login-feature-grid">
        <span>• Duplicate Order ID block</span>
        <span>• Myanmar daily dashboard</span>
        <span>• Limit payment flow</span>
        <span>• Admin / Editor / QA roles</span>
      </div>
    </section>

    <section class="login-card reveal-up delay-1">
      <div class="login-card-head">
        <img src="assets/logo-1.1.png" class="brand-logo-sm" alt="BM Logo">
        <div>
          <h2>Welcome back</h2>
          <p>Login using username and password</p>
        </div>
      </div>
      <form id="loginForm" autocomplete="off">
        <label>Username</label>
        <input id="loginUsername" autocomplete="off" placeholder="admin" required />
        <label>Password</label>
        <div class="password-wrap">
          <input id="loginPassword" autocomplete="new-password" type="password" placeholder="••••••" required />
          <button type="button" id="togglePassword" class="password-toggle" aria-label="Show password" title="Show password">
            <svg class="eye-open" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M2.3 12s3.4-6 9.7-6 9.7 6 9.7 6-3.4 6-9.7 6-9.7-6-9.7-6Z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            <svg class="eye-closed" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 3l18 18"/>
              <path d="M10.6 10.6A2.8 2.8 0 0 0 12 15a3 3 0 0 0 2.8-4"/>
              <path d="M7.1 7.8C4.1 9.5 2.3 12 2.3 12s3.4 6 9.7 6c1.7 0 3.1-.4 4.4-1"/>
              <path d="M12 6c6.3 0 9.7 6 9.7 6s-.8 1.5-2.4 3"/>
            </svg>
          </button>
        </div>
        <button class="primary-btn full" type="submit"><span class="btn-text">Login</span><span class="btn-loader hidden"></span></button>
      </form>
    </section>
  </main>`;
const appMarkup = `<div id="toastRoot" class="toast-root"></div>
  <div id="pageLoader" class="page-loader hidden"><div class="loader-card"><div class="fast-loader"></div><span>Processing...</span></div></div>

  <div id="payModal" class="modal hidden">
    <div class="modal-card">
      <div class="modal-head"><h3>Pay Pending Limit</h3><button id="closePayModal" class="icon-btn">×</button></div>
      <div id="payDetails" class="detail-grid"></div>
      <form id="payLimitForm" class="stack-form">
        <input id="payAccountCode" placeholder="Account / Area Code (Ex: KBZ_DA_64275)" required />
        <input id="payAmount" type="number" placeholder="Pay Amount" required />
        <input id="secondAccountCode" placeholder="Second Account Code (optional)" />
        <input id="secondPayAmount" type="number" placeholder="Second Account Amount (optional)" />
        <textarea id="payRemark" placeholder="Payment remark (optional)"></textarea>
        <button class="primary-btn" type="submit">Save Payment</button>
      </form>
    </div>
  </div>

  <div id="editTxModal" class="modal hidden">
    <div class="modal-card">
      <div class="modal-head"><h3>Edit History Record</h3><button id="closeEditTxModal" class="icon-btn">×</button></div>
      <p id="editTxMeta" class="muted"></p>
      <form id="editTxForm" class="stack-form">
        <input id="editTxOrder" placeholder="Order ID" readonly />
        <div class="form-grid compact-grid">
          <input id="editTxClientId" placeholder="Client ID" required />
          <input id="editTxClientName" placeholder="Client Name" />
          <input id="editTxClientAccount" placeholder="Client Account / Phone Number" />
          <select id="editTxBank"><option value="KBZ">KBZ</option><option value="Wave">Wave</option></select>
          <input id="editTxAmount" type="number" placeholder="Amount" required />
          <input id="editTxPaid" type="number" placeholder="Paid Amount" required />
        </div>
        <textarea id="editTxRemark" placeholder="Remark"></textarea>
        <div class="modal-actions"><button class="primary-btn" type="submit">Save Edit</button><button id="cancelEditTxBtn" class="ghost-btn" type="button">Cancel</button></div>
      </form>
    </div>
  </div>

  <div id="userPlatformModal" class="modal hidden">
    <div class="modal-card user-platform-card">
      <div class="modal-head"><h3 id="userPlatformModalTitle">Select Platform Access</h3><button id="closeUserPlatformModal" class="icon-btn">×</button></div>
      <p class="muted" id="editUserPlatformName">Tick the platforms this user can access.</p>
      <div class="stack-form">
        <label class="check-row" id="editUserAllPlatformsRow"><input type="checkbox" id="editUserAllPlatforms" /> Allow all platforms</label>
        <div class="platform-modal-tools"><button id="checkAllPlatformsBtn" class="soft-btn" type="button">Check All</button><button id="uncheckAllPlatformsBtn" class="ghost-btn" type="button">De-check All</button></div><div id="editAllowedPlatforms" class="platform-checkbox-grid" title="Allowed platforms"></div>
        <div class="modal-actions">
          <button id="saveUserPlatformsBtn" class="primary-btn" type="button">Save Platform Access</button>
          <button id="cancelUserPlatformsBtn" class="ghost-btn" type="button">Cancel</button>
        </div>
      </div>
    </div>
  </div>

  <button id="mobileMenuBtn" class="mobile-menu-btn">≡</button>
  <aside id="sidebar" class="sidebar">
    <div class="brand-block">
      <img src="assets/logo-1.1.png" class="sidebar-logo" alt="BM Logo">
      <h2>BM Core</h2>
      <p>Operations Console</p>
    </div>
    <nav>
      <button class="nav-item active" data-page="dashboard">
        <svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z"/></svg>
        <span>Dashboard</span>
      </button>
      <button class="nav-item" data-page="add">
        <svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5a1 1 0 1 1 2 0v6h6a1 1 0 1 1 0 2h-6v6a1 1 0 1 1-2 0v-6H5a1 1 0 1 1 0-2h6V5Z"/></svg>
        <span>Add Transaction</span>
      </button>
      <button class="nav-item" data-page="history">
        <svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 8.95 8h-2.02A7 7 0 1 1 16.95 6H14a1 1 0 1 0 0 2h5a1 1 0 0 0 1-1V2a1 1 0 1 0-2 0v2.52A8.96 8.96 0 0 0 12 3Zm1 5a1 1 0 1 0-2 0v4c0 .27.11.52.29.71l3 3a1 1 0 0 0 1.42-1.42L13 11.59V8Z"/></svg>
        <span>History</span>
      </button>
      <button class="nav-item" data-page="limits">
        <svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 3 7v6c0 5 3.8 8 9 9 5.2-1 9-4 9-9V7l-9-5Zm0 2.2L19 8v5c0 3.8-2.6 6.1-7 7-4.4-.9-7-3.2-7-7V8l7-3.8Zm0 3.3a1 1 0 0 0-1 1V12H8a1 1 0 1 0 0 2h3v3.5a1 1 0 1 0 2 0V14h3a1 1 0 1 0 0-2h-3V8.5a1 1 0 0 0-1-1Z"/></svg>
        <span>Limits / Pending</span>
      </button>
      <button class="nav-item risk-nav" data-page="risk">
        <svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 1.9 20.5A1 1 0 0 0 2.8 22h18.4a1 1 0 0 0 .9-1.5L12 3Zm0 4 7.45 13H4.55L12 7Zm-1 4v4a1 1 0 1 0 2 0v-4a1 1 0 1 0-2 0Zm1 7.4a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Z"/></svg>
        <span>Risk Reports</span>
      </button>
      <button class="nav-item manage-users-nav" data-page="users">
        <svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4 0-7 2.1-7 5v1a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1c0-2.9-3-5-7-5Zm8-1a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm0 2c-.7 0-1.35.07-1.95.2 1.82 1 2.95 2.44 2.95 4.3v.5h3a1 1 0 0 0 1-1v-.7c0-2-2.1-3.3-5-3.3Z"/></svg>
        <span>Users</span>
      </button>
      <button class="nav-item" data-page="settings">
        <svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M19.43 12.98c.04-.32.07-.65.07-.98s-.02-.66-.07-.98l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.6-.22l-2.49 1a7.28 7.28 0 0 0-1.69-.98L14.5 2.42A.5.5 0 0 0 14 2h-4a.5.5 0 0 0-.5.42L9.12 5.07c-.61.24-1.18.56-1.69.98l-2.49-1a.5.5 0 0 0-.6.22l-2 3.46a.5.5 0 0 0 .12.64l2.11 1.65c-.04.32-.07.65-.07.98s.02.66.07.98l-2.11 1.65a.5.5 0 0 0-.12.64l2 3.46c.13.22.39.31.62.22l2.46-1c.51.4 1.08.73 1.69.98l.38 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.38-2.65c.61-.24 1.18-.56 1.69-.98l2.46 1c.23.09.49 0 .62-.22l2-3.46a.5.5 0 0 0-.12-.64l-2.11-1.65ZM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5Z"/></svg>
        <span>Settings</span>
      </button>
    </nav>
    <div class="sidebar-bottom"><button id="themeToggle" class="sidebar-theme-btn" type="button">Dark Mode</button><button id="logoutBtn" class="logout-btn">Logout</button></div>
  </aside>

  <main class="app-main">
    <header class="topbar cardish">
      <div>
        <h1 id="pageTitle">Dashboard</h1>
        <p><span id="currentUserName">User</span> • <span id="currentUserRole">QA</span></p>
      </div>
      <div class="topbar-actions">
        <label class="platform-switcher">Platform <select id="globalPlatformSelect"></select></label>
        <div class="live-clock"><strong id="dateOnly">--</strong></div>
        <div class="live-clock time-box"><strong id="timeOnly">--:--:--</strong></div>
        
      </div>
    </header>
    <div id="dbStatus" class="db-status">Database not loaded yet</div>

    <section id="dashboardPage" class="page active-page fade-in">
      <div class="filters dashboard-filters">
        <label class="inline-label">View date</label>
        <input id="dashboardDate" type="date" />
        <button id="dashboardTodayBtn" class="ghost-btn" type="button">Show Today</button>
      </div>
      <div class="stats-grid upgraded-stats">
        <article class="stat-card paid">
          <div class="stat-top"><span>Total Paid</span><div class="stat-icon success">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v1h1a2 2 0 0 1 2 2v7a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3v-1H5a2 2 0 0 1-2-2V7zm15 3v7a1 1 0 0 0 1 1h1v-8h-2zM5 6a1 1 0 0 0-1 1v7h2v-4a2 2 0 0 1 2-2h8V7a1 1 0 0 0-1-1H5zm3 4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1H8z"/></svg>
          </div></div><strong id="dashPaid">0</strong></article>
        <article class="stat-card pending">
          <div class="stat-top"><span>Pending Balance</span><div class="stat-icon warning">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 5v5.59l3.7 3.7-1.4 1.41L11 13.41V7z"/></svg>
          </div></div><strong id="dashPendingBalance">0</strong></article>
        <article class="stat-card overpaid">
          <div class="stat-top"><span>Overpaid Amount</span><div class="stat-icon danger">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 17h-2v-1.07A4 4 0 0 1 8 14h2a2 2 0 1 0 2-2 4 4 0 0 1-1-7.87V3h2v1.13A4 4 0 0 1 16 8h-2a2 2 0 1 0-2 2 4 4 0 0 1 1 7.87z"/></svg>
          </div></div><strong id="dashOverpaidAmount">0</strong></article>
        <article class="stat-card">
          <div class="stat-top"><span>Today Transactions</span><div class="stat-icon primary">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19h16v2H2V3h2zm4-4.59 3-3 3 2 4.59-4.58L20 10l-5.99 6-3-2-4.59 4.58z"/></svg>
          </div></div><strong id="dashRecords">0</strong></article>
        <article class="stat-card">
          <div class="stat-top"><span>Done Count</span><div class="stat-icon success">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm-1.2 14.2L6.6 12l1.4-1.4 2.8 2.8 5.2-5.2 1.4 1.4z"/></svg>
          </div></div><strong id="dashDone">0</strong></article>
        <article class="stat-card">
          <div class="stat-top"><span>Pending Count</span><div class="stat-icon warning">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 5v5.59l3.7 3.7-1.4 1.41L11 13.41V7z"/></svg>
          </div></div><strong id="dashPendingCount">0</strong></article>
        <article class="stat-card">
          <div class="stat-top"><span>Overpaid Count</span><div class="stat-icon danger">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 17h-2v-1.07A4 4 0 0 1 8 14h2a2 2 0 1 0 2-2 4 4 0 0 1-1-7.87V3h2v1.13A4 4 0 0 1 16 8h-2a2 2 0 1 0-2 2 4 4 0 0 1 1 7.87z"/></svg>
          </div></div><strong id="dashOverpaidCount">0</strong></article>
      </div>
      <div class="two-col">
        <section class="panel chart-panel"><div class="panel-title-row"><div><h3>Transaction Activity Today</h3><p class="muted">Hourly breakdown of today's transactions</p></div><div class="panel-head-badge"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19h16v2H2V3h2zm4-4.59 3-3 3 2 4.59-4.58L20 10l-5.99 6-3-2-4.59 4.58z"/></svg><span>Transactions</span></div></div><canvas id="activityLineChart"></canvas></section>
        <section class="panel bank-panel"><div class="panel-title-row"><h3>Bank Summary</h3><div class="panel-icon-badge"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 3 8v2h18V8zm-7 9h2v6H5zm4 0h2v6H9zm4 0h2v6h-2zm4 0h2v6h-2zM3 20h18v1H3z"/></svg></div></div><div id="bankSummary" class="mini-list"></div></section>
      </div>
      <section class="panel"><h3>Pending Box</h3><div class="table-wrap"><table><thead><tr><th>Platform</th><th>Order ID</th><th>Client ID</th><th>Created Time</th><th>Processed Bank</th><th>Pending Balance</th><th>QA/User</th></tr></thead><tbody id="pendingBoxTable"></tbody></table></div></section>
      <section class="panel"><div class="panel-title-row"><h3 id="todayTitle">Transactions Today</h3></div><div class="table-wrap"><table><thead><tr><th>Platform</th><th>Order ID</th><th>Client ID</th><th>Client</th><th>Amount</th><th>Paid</th><th>Processed Bank</th><th>Status</th><th>QA/User</th><th>Format</th></tr></thead><tbody id="todayTable"></tbody></table></div><div id="dashboardPagination" class="pagination-bar"></div></section>
    </section>

    <section id="addPage" class="page fade-in">
      <section class="panel form-panel">
        <h3>Add Transaction</h3>
        <p class="muted">Enter order details first, then add one or more payment lines. The generated format updates automatically and can be copied before or after saving.</p>
        <form id="transactionForm" autocomplete="off">
          <div class="form-grid">
            <div class="field-stack order-id-field">
              <div class="order-id-submit-row"><input id="orderId" placeholder="Order ID" required /><button type="button" id="checkOrderIdBtn" class="soft-btn order-check-btn"><span class="btn-text">Submit Order ID</span><span class="btn-loader hidden"></span></button></div>
              <div id="orderIdStatus" class="order-id-status" aria-live="polite"></div>
            </div>
            <input id="clientId" placeholder="Client ID" required />
            <input id="amount" type="number" placeholder="Amount" required />
            <input id="exchangeType" placeholder="Exchange Type" value="Online banking" required />
            <input id="clientName" placeholder="Client Name" required />
            <input id="phoneNumber" placeholder="Client Account / Phone Number" required />
            <select id="bank" required><option value="KBZ">KBZ</option><option value="Wave">Wave</option></select>
            <input id="qaUser" readonly />
          </div>
          <textarea id="remark" class="wide-textarea" placeholder="Remark (optional)"></textarea>
          <div class="calc-strip">
            <span>Total Paid: <b id="totalPaidPreview">0</b></span>
            <span>Pending Balance: <b id="balancePreview">0</b></span>
            <span>Bank Check: <b id="bankCheckPreview">TRUE</b></span>
            <span>Status: <b id="statusPreview">PENDING</b></span>
          </div>
          <div class="payment-head"><h4>Payment Lines</h4></div>
          <div id="paymentLines" class="payment-lines"></div>
          <button type="button" id="addLineBtn" class="soft-btn full">+ Add Payment Line</button>
          <div class="format-row">
            <label>Generated Format</label>
            <div class="copy-field"><textarea id="generatedFormat" readonly></textarea><button type="button" id="copyFormatBtn">Copy</button></div>
          </div>
          <div class="form-actions">
            <button type="button" id="clearTransactionBtn" class="ghost-btn">Clear</button>
            <button type="submit" id="submitTransactionBtn" class="primary-btn"><span class="btn-text">Submit Transaction</span><span class="btn-loader hidden"></span></button>
          </div>
        </form>
      </section>
    </section>

    <section id="historyPage" class="page fade-in">
      <section class="panel"><h3>History</h3><p class="muted">Search, filter and export records. Date filter is set to today by default.</p>
        <div class="filters">
          <input id="historyDate" type="date" />
          <button id="historyTodayBtn" class="ghost-btn" type="button">Today</button>
          <select id="historyStatus"><option value="all">All Status</option><option>DONE</option><option>PENDING</option><option>OVERPAID</option></select>
          <input id="historySearch" placeholder="Search Order ID / Client ID / Account No" />
          <button id="historySearchBtn" class="ghost-btn" type="button">Search</button>
          <button id="exportCsvBtn" class="primary-btn">Export CSV</button>
                  </div>
        <div class="table-wrap"><table><thead><tr><th>Platform</th><th>Order ID</th><th>Client ID</th><th>Client Account</th><th>Created Time</th><th>Processed Bank</th><th>Amount</th><th>Paid</th><th>Pending</th><th>Status</th><th>User</th><th>Remark</th><th>Action</th></tr></thead><tbody id="historyTable"></tbody></table></div><div id="historyPagination" class="pagination-bar"></div>
      </section>
    </section>

    <section id="limitsPage" class="page fade-in">
      <section class="panel"><h3>Limits / Pending Transactions</h3>
        <div class="filters"><input id="limitSearch" placeholder="Search Order ID / Client ID" /><button id="limitSearchBtn" class="ghost-btn" type="button">Search</button></div>
        <p id="limitsPendingInfo" class="muted">Showing pending limits from the past 3 days. Maximum 5 transactions are shown at a time.</p>
        <div class="table-wrap"><table><thead><tr><th>Platform</th><th>Order ID</th><th>Client ID</th><th>Created Time</th><th>Processed Bank</th><th>Amount</th><th>Paid</th><th>Pending Balance</th><th>User</th><th>Action</th></tr></thead><tbody id="limitsTable"></tbody></table></div><div id="limitsPagination" class="pagination-bar limit-toggle-bar"></div>
      </section>
      <section class="panel"><h3>Pending Paid Accounts</h3><p class="muted">Tracks only the accounts and amounts used when a user pays a pending limit. Each payment line is saved against the specific transaction.</p><div class="filters"><input id="pendingPaidDate" type="date" /><button id="pendingPaidTodayBtn" class="ghost-btn" type="button">Today</button><button id="pendingPaidAllBtn" class="ghost-btn" type="button">All</button><button id="pendingPaidSearchBtn" class="ghost-btn" type="button">Search</button></div><div class="table-wrap"><table><thead><tr><th>Platform</th><th>Order ID</th><th>Client ID</th><th>Account Code</th><th>Paid Amount</th><th>Paid By</th><th>Paid Time</th><th>Transaction Status</th><th>Action</th></tr></thead><tbody id="pendingPaidAccountsTable"></tbody></table></div></section>
      <section class="panel"><h3>Limit Done</h3><p class="muted">Completed limits after QA/user payment. Modified time is added after the pending limit is paid.</p><div class="filters"><input id="limitDoneDate" type="date" /><button id="limitDoneTodayBtn" class="ghost-btn" type="button">Today</button><button id="limitDoneAllBtn" class="ghost-btn" type="button">All</button></div><div class="table-wrap"><table><thead><tr><th>Platform</th><th>Order ID</th><th>Client ID</th><th>Created Time</th><th>Modified Time</th><th>Processed Bank</th><th>Amount</th><th>Paid</th><th>Paid By</th><th>Remark</th></tr></thead><tbody id="limitDoneTable"></tbody></table></div></section>
    </section>

    <section id="riskPage" class="page fade-in">
      <section class="panel"><h3>Risk Reports</h3><p class="muted">Automatically generated when OVERPAID is detected.</p><div class="filters"><input id="riskDate" type="date" /><button id="riskTodayBtn" class="ghost-btn" type="button">Today</button><button id="riskAllBtn" class="ghost-btn" type="button">All</button><button id="riskSearchBtn" class="ghost-btn" type="button">Search</button></div><div class="table-wrap"><table><thead><tr><th>Platform</th><th>Client ID</th><th>Client Acc No</th><th>Order ID</th><th>Amount</th><th>Paid Amount</th><th>Losses</th><th>Reason</th><th>Name</th><th>Created Time</th><th>Action</th></tr></thead><tbody id="riskTable"></tbody></table></div></section>
    </section>

    <section id="usersPage" class="page fade-in">
      <section class="panel"><h3>User Enrollment</h3><p class="muted">First enter username, password, and role. After submit, choose platform access in the popup.</p><form id="userForm" class="user-form user-create-form" autocomplete="off"><input id="newUsername" autocomplete="off" placeholder="Username" /><input id="newPassword" autocomplete="new-password" type="password" placeholder="Password" /><select id="newRole"><option value="qa">QA</option><option value="editor">Editor</option><option value="admin">Admin</option></select><button class="primary-btn" type="submit">Next: Select Platforms</button></form><div class="filters user-filter-bar"><input id="userSearch" placeholder="Search user by username / role" /><select id="usersPlatformFilter"><option value="all">All platform access</option></select></div><div class="table-wrap"><table><thead><tr><th>Username</th><th>Allowed Platforms</th><th>Role</th><th>Status</th><th>Online</th><th>Actions</th></tr></thead><tbody id="usersTable"></tbody></table></div><div id="usersPagination" class="pagination-bar"></div></section>
    </section>

    <section id="settingsPage" class="page fade-in">
      <section class="panel narrow"><h3>Settings</h3><p class="muted">Change your own password and switch theme.</p><div class="setting-line"><span>Dark Mode</span><button id="settingsThemeBtn" class="ghost-btn">Toggle</button></div><form id="changePasswordForm" class="stack-form"><h4>Change Own Password</h4><input id="ownNewPassword" type="password" placeholder="New password" /><button class="primary-btn" type="submit">Update Password</button></form></section>
      <section class="panel narrow admin-delete-tools"><h3>Platform Management</h3><p class="muted">Add a new platform when it comes to the system. Disable keeps old history safe.</p><form id="platformForm" class="stack-form"><input id="newPlatformCode" placeholder="New platform ex: 4-35" /><button class="primary-btn" type="submit">Add Platform</button></form><div class="table-wrap"><table><thead><tr><th>Name</th><th>Code</th><th>Status</th><th>Action</th></tr></thead><tbody id="platformsTable"></tbody></table></div></section>
      <section class="panel narrow admin-delete-tools"><h3>Admin Bulk Actions</h3><p class="muted">Only Admin can bulk export or delete data. Choose platform and date duration before performing any action.</p><div class="stack-form bulk-action-box"><select id="bulkPlatformSelect"></select><div class="bulk-date-row"><label>From <input id="bulkFromDate" type="date" /></label><label>To <input id="bulkToDate" type="date" /></label></div><div class="modal-actions bulk-actions"><button id="bulkExportBtn" class="primary-btn" type="button">Bulk Export CSV</button><button id="bulkDeleteBtn" class="danger-btn" type="button">Bulk Delete</button></div></div></section>
    </section>
  </main>`;

export default function App() {
  const isApp = useMemo(() => window.location.pathname.includes("app.html"), []);
  return <div dangerouslySetInnerHTML={{ __html: isApp ? appMarkup : loginMarkup }} />;
}
