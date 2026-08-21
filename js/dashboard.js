// 速來得網購團購網 - 後台訂單儀表板邏輯
// 注意：這是輕量級的畫面存取門檻（非真正的帳號權限控管），
// 因為前端使用的是 Supabase anon key，資料表已開放公開讀取，僅適合內部測試/展示使用。

const DASHBOARD_PASSCODE = "sulaide2026";
const DASHBOARD_AUTH_KEY = "sld_dashboard_auth";
const STATUS_OPTIONS = ["待處理", "已出貨", "已完成", "已取消"];

function checkDashboardAuth() {
  if (sessionStorage.getItem(DASHBOARD_AUTH_KEY)) return true;
  const input = prompt("請輸入後台通行碼：");
  if (input === DASHBOARD_PASSCODE) {
    sessionStorage.setItem(DASHBOARD_AUTH_KEY, input);
    return true;
  }
  return false;
}

function getAdminPasscode() {
  return sessionStorage.getItem(DASHBOARD_AUTH_KEY);
}

async function fetchOrders() {
  const passcode = getAdminPasscode();
  if (!passcode) return [];
  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/admin-orders`, {
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
        "x-admin-passcode": passcode
      }
    });
    const payload = await resp.json();
    if (!resp.ok || payload.error) throw new Error(payload.error || "讀取失敗");
    return payload.orders;
  } catch (err) {
    console.error(err);
    return [];
  }
}

async function updateOrderStatus(orderId, status) {
  const passcode = getAdminPasscode();
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/admin-orders`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
      "x-admin-passcode": passcode
    },
    body: JSON.stringify({ order_id: orderId, status })
  });
  return resp.ok;
}

function statusBadgeClass(status) {
  switch (status) {
    case "待處理": return "chip active";
    case "已出貨": return "chip";
    case "已完成": return "chip";
    case "已取消": return "chip";
    default: return "chip";
  }
}

function paymentBadgeHtml(paymentStatus) {
  const color =
    paymentStatus === "付款成功" ? "#1a9b62" : paymentStatus === "付款失敗" ? "#c0392b" : "#8a6d1f";
  const bg =
    paymentStatus === "付款成功" ? "#e5f8ef" : paymentStatus === "付款失敗" ? "#fdecea" : "#fdf6e3";
  return `<span style="display:inline-block; padding:3px 10px; border-radius:999px; font-size:12px; font-weight:700; color:${color}; background:${bg};">${paymentStatus || "未付款"}</span>`;
}

function orderRowHtml(order) {
  const dt = new Date(order.created_at);
  const dtStr = dt.toLocaleString("zh-TW", { hour12: false });
  const itemsSummary = (order.frozen_order_items || [])
    .map((i) => `${i.product_name} × ${i.quantity}`)
    .join("、");

  return `
    <tr data-id="${order.id}">
      <td>${order.id.slice(0, 8).toUpperCase()}</td>
      <td>${dtStr}</td>
      <td>${order.customer_name}<br><span style="color:var(--color-muted); font-size:12px;">${order.customer_phone || ""}</span></td>
      <td style="max-width:260px;">${itemsSummary}</td>
      <td>NT$ ${order.total}</td>
      <td>${paymentBadgeHtml(order.payment_status)}</td>
      <td>
        <select class="status-select" data-id="${order.id}">
          ${STATUS_OPTIONS.map((s) => `<option value="${s}" ${s === order.status ? "selected" : ""}>${s}</option>`).join("")}
        </select>
      </td>
    </tr>
  `;
}

function renderStats(orders) {
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
  const pendingCount = orders.filter((o) => o.status === "待處理").length;
  const today = new Date().toDateString();
  const todayCount = orders.filter((o) => new Date(o.created_at).toDateString() === today).length;

  document.getElementById("stat-total-orders").textContent = totalOrders;
  document.getElementById("stat-total-revenue").textContent = `NT$ ${totalRevenue.toLocaleString()}`;
  document.getElementById("stat-pending").textContent = pendingCount;
  document.getElementById("stat-today").textContent = todayCount;
}

let allOrders = [];
let currentStatusFilter = "全部";

function applyStatusFilter() {
  const filtered =
    currentStatusFilter === "全部"
      ? allOrders
      : allOrders.filter((o) => o.status === currentStatusFilter);
  const tbody = document.getElementById("orders-tbody");
  tbody.innerHTML = filtered.length
    ? filtered.map(orderRowHtml).join("")
    : `<tr><td colspan="7" style="text-align:center; color:var(--color-muted); padding:30px;">目前沒有符合條件的訂單</td></tr>`;
  bindStatusSelects();
}

function bindStatusSelects() {
  document.querySelectorAll(".status-select").forEach((select) => {
    select.addEventListener("change", async (e) => {
      const id = e.target.dataset.id;
      const newStatus = e.target.value;
      const ok = await updateOrderStatus(id, newStatus);
      if (!ok) {
        showToast("狀態更新失敗，請稍後再試");
        return;
      }
      const order = allOrders.find((o) => o.id === id);
      if (order) order.status = newStatus;
      renderStats(allOrders);
      showToast("訂單狀態已更新");
    });
  });
}

function bindFilterChips() {
  const chips = document.querySelectorAll("#status-filter-chips .chip");
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      chips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      currentStatusFilter = chip.dataset.status;
      applyStatusFilter();
    });
  });
}

async function initDashboard() {
  if (!checkDashboardAuth()) {
    document.getElementById("dashboard-content").innerHTML =
      '<p style="text-align:center; padding:80px 0; color:var(--color-muted);">通行碼錯誤，請重新整理頁面再試一次。</p>';
    return;
  }

  document.getElementById("dashboard-content").style.display = "block";
  bindFilterChips();

  allOrders = await fetchOrders();
  renderStats(allOrders);
  applyStatusFilter();

  document.getElementById("refresh-btn").addEventListener("click", async () => {
    allOrders = await fetchOrders();
    renderStats(allOrders);
    applyStatusFilter();
    showToast("已重新載入訂單資料");
  });
}

document.addEventListener("DOMContentLoaded", initDashboard);
