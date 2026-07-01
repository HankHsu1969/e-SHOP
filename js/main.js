// 速來得網購團購網 - 共用邏輯（導覽列、購物車、Toast）

const CART_KEY = "sld_cart_v1";
const MEMBER_KEY = "sld_member_v1";

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartBadge();
}

function cartCount() {
  return getCart().reduce((sum, item) => sum + item.quantity, 0);
}

function addToCart(product, quantity = 1) {
  const cart = getCart();
  const existing = cart.find((item) => item.sku === product.sku);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({
      sku: product.sku,
      name: product.name,
      spec: product.spec,
      price: product.price,
      image_url: product.image_url,
      quantity
    });
  }
  saveCart(cart);
  showToast(`已加入購物車：${product.name}`);
}

function updateCartBadge() {
  document.querySelectorAll(".cart-badge").forEach((el) => {
    el.textContent = cartCount();
  });
}

function showToast(message) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function getMember() {
  try {
    return JSON.parse(localStorage.getItem(MEMBER_KEY));
  } catch (e) {
    return null;
  }
}

function saveMember(member) {
  localStorage.setItem(MEMBER_KEY, JSON.stringify(member));
}

function clearMember() {
  localStorage.removeItem(MEMBER_KEY);
}

function initNav() {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".main-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => nav.classList.toggle("open"));
  }
  updateCartBadge();
}

document.addEventListener("DOMContentLoaded", initNav);
