// 速來得網購團購網 - 購物車頁面邏輯

const SHIPPING_FEE = 80;
const FREE_SHIPPING_THRESHOLD = 1000;

function cartRowHtml(item) {
  return `
    <div class="cart-row" data-sku="${item.sku}">
      <img src="${item.image_url}" alt="${item.name}">
      <div>
        <div class="name">${item.name}</div>
        <div class="spec">${item.spec}</div>
      </div>
      <div class="qty-control">
        <button class="qty-minus" aria-label="減少">−</button>
        <span>${item.quantity}</span>
        <button class="qty-plus" aria-label="增加">＋</button>
      </div>
      <div class="price">NT$ ${item.price * item.quantity}</div>
      <button class="remove-btn">移除</button>
    </div>
  `;
}

function renderCart() {
  const cart = getCart();
  const listEl = document.getElementById("cart-list");
  const emptyEl = document.getElementById("cart-empty");

  if (cart.length === 0) {
    listEl.style.display = "none";
    emptyEl.style.display = "block";
  } else {
    listEl.style.display = "block";
    emptyEl.style.display = "none";
    listEl.innerHTML = cart.map(cartRowHtml).join("");
  }

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = cart.length === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const total = subtotal + shipping;

  document.getElementById("summary-subtotal").textContent = `NT$ ${subtotal}`;
  document.getElementById("summary-shipping").textContent = shipping === 0 ? "免運" : `NT$ ${shipping}`;
  document.getElementById("summary-total").textContent = `NT$ ${total}`;

  const checkoutBtn = document.getElementById("checkout-btn");
  checkoutBtn.disabled = cart.length === 0;

  bindCartRowEvents();
}

function bindCartRowEvents() {
  document.querySelectorAll(".cart-row").forEach((row) => {
    const sku = row.dataset.sku;
    row.querySelector(".qty-plus").addEventListener("click", () => changeQty(sku, 1));
    row.querySelector(".qty-minus").addEventListener("click", () => changeQty(sku, -1));
    row.querySelector(".remove-btn").addEventListener("click", () => removeItem(sku));
  });
}

function changeQty(sku, delta) {
  const cart = getCart();
  const item = cart.find((i) => i.sku === sku);
  if (!item) return;
  item.quantity = Math.max(1, item.quantity + delta);
  saveCart(cart);
  renderCart();
}

function removeItem(sku) {
  const cart = getCart().filter((i) => i.sku !== sku);
  saveCart(cart);
  renderCart();
}

function generateLocalOrderNo() {
  return "SLD" + Date.now().toString(36).toUpperCase();
}

function orderSuccessItemHtml(item) {
  return `
    <div class="order-item">
      <span>${item.name} × ${item.quantity}</span>
      <span>NT$ ${item.price * item.quantity}</span>
    </div>
  `;
}

function renderOrderSuccess(order, cart, contact) {
  document.querySelector(".cart-layout").style.display = "none";
  const successEl = document.getElementById("order-success");
  successEl.style.display = "block";

  document.getElementById("order-success-no").textContent = order.orderNo;
  document.getElementById("order-success-items").innerHTML = cart.map(orderSuccessItemHtml).join("");
  document.getElementById("order-success-total").textContent = `NT$ ${order.total}`;
  document.getElementById("order-success-contact").textContent =
    `${contact.name}．${contact.phone}．${contact.address}`;
}

async function checkout() {
  const cart = getCart();
  if (cart.length === 0) return;

  const contact = {
    name: document.getElementById("checkout-name").value.trim(),
    phone: document.getElementById("checkout-phone").value.trim(),
    address: document.getElementById("checkout-address").value.trim()
  };

  if (!contact.name || !contact.phone || !contact.address) {
    showToast("請填寫完整的訂購人姓名、電話與地址");
    return;
  }

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const total = subtotal + shipping;
  const member = getMember();

  let orderNo = generateLocalOrderNo();

  if (supabaseClient) {
    const { data: order, error: orderError } = await supabaseClient
      .from("frozen_orders")
      .insert({
        member_id: member && member.id ? member.id : null,
        customer_name: contact.name,
        customer_email: member ? member.email : null,
        customer_phone: contact.phone,
        customer_address: contact.address,
        subtotal,
        shipping_fee: shipping,
        total
      })
      .select()
      .single();

    if (orderError) {
      showToast("訂單送出失敗，請稍後再試");
      return;
    }

    const items = cart.map((item) => ({
      order_id: order.id,
      product_sku: item.sku,
      product_name: item.name,
      unit_price: item.price,
      quantity: item.quantity,
      line_total: item.price * item.quantity
    }));
    await supabaseClient.from("frozen_order_items").insert(items);

    orderNo = order.id.slice(0, 8).toUpperCase();
  }

  renderOrderSuccess({ orderNo, total }, cart, contact);
  saveCart([]);
}

document.addEventListener("DOMContentLoaded", () => {
  renderCart();

  const member = getMember();
  if (member) {
    const nameInput = document.getElementById("checkout-name");
    const phoneInput = document.getElementById("checkout-phone");
    const addressInput = document.getElementById("checkout-address");
    if (nameInput && !nameInput.value) nameInput.value = member.name || "";
    if (phoneInput && !phoneInput.value) phoneInput.value = member.phone || "";
    if (addressInput && !addressInput.value) addressInput.value = member.address || "";
  }

  const checkoutBtn = document.getElementById("checkout-btn");
  if (checkoutBtn) checkoutBtn.addEventListener("click", checkout);

  const continueBtn = document.getElementById("continue-shopping-btn");
  if (continueBtn) continueBtn.addEventListener("click", () => { window.location.href = "products.html"; });
});
