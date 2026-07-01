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

async function checkout() {
  const cart = getCart();
  if (cart.length === 0) return;

  saveCart([]);
  renderCart();
  showToast("訂單已送出，感謝您的購買！");
}

document.addEventListener("DOMContentLoaded", () => {
  renderCart();
  const checkoutBtn = document.getElementById("checkout-btn");
  if (checkoutBtn) checkoutBtn.addEventListener("click", checkout);
});
