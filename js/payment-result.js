// 速來得網購團購網 - 綠界付款完成返回頁邏輯
// 使用者從綠界收銀台導回後，輪詢訂單付款狀態（實際狀態由 ecpay-notify Server 端 Webhook 更新）

const POLL_INTERVAL_MS = 1500;
const MAX_POLL_ATTEMPTS = 8;

function getOrderIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("order");
}

function renderState(state, order) {
  const iconEl = document.getElementById("result-icon");
  const titleEl = document.getElementById("result-title");
  const descEl = document.getElementById("result-desc");
  const detailEl = document.getElementById("result-detail");

  if (state === "success") {
    iconEl.textContent = "✅";
    titleEl.textContent = "付款成功，感謝您的購買！";
    descEl.textContent = `訂單編號：${order.id.slice(0, 8).toUpperCase()}`;
    detailEl.innerHTML = `
      <div class="summary-row"><span>付款方式</span><span>${order.payment_method || "信用卡"}</span></div>
      <div class="summary-row total"><span>訂單金額</span><span>NT$ ${order.total}</span></div>
    `;
  } else if (state === "failed") {
    iconEl.textContent = "❌";
    titleEl.textContent = "付款失敗";
    descEl.textContent = order.ecpay_rtn_msg || "很抱歉，交易未能完成，請重新嘗試或改用其他付款方式。";
    detailEl.innerHTML = "";
  } else if (state === "pending") {
    iconEl.textContent = "⏳";
    titleEl.textContent = "付款處理中";
    descEl.textContent = "已收到您的付款請求，系統正在確認交易結果，請稍候片刻或稍後於會員中心查詢。";
    detailEl.innerHTML = "";
  } else {
    iconEl.textContent = "⚠️";
    titleEl.textContent = "找不到訂單資訊";
    descEl.textContent = "請確認連結是否正確，或返回購物車重新結帳。";
    detailEl.innerHTML = "";
  }
}

async function pollOrderStatus(orderId, attempt = 1) {
  const { data: order, error } = await supabaseClient
    .from("frozen_orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (error || !order) {
    renderState("not-found", null);
    return;
  }

  if (order.payment_status === "付款成功") {
    renderState("success", order);
    return;
  }
  if (order.payment_status === "付款失敗") {
    renderState("failed", order);
    return;
  }

  if (attempt >= MAX_POLL_ATTEMPTS) {
    renderState("pending", order);
    return;
  }

  renderState("pending", order);
  setTimeout(() => pollOrderStatus(orderId, attempt + 1), POLL_INTERVAL_MS);
}

document.addEventListener("DOMContentLoaded", () => {
  const orderId = getOrderIdFromUrl();
  if (!orderId || !supabaseClient) {
    renderState("not-found", null);
    return;
  }
  pollOrderStatus(orderId);
});
