// 速來得網購團購網 - 商品資料存取與渲染

async function fetchProducts() {
  if (supabaseClient) {
    const { data, error } = await supabaseClient
      .from("frozen_products")
      .select("*")
      .order("sort_order", { ascending: true });
    if (!error && data && data.length > 0) return data;
  }
  return PRODUCTS_DATA;
}

function productCardHtml(p) {
  const discount = p.original_price && p.original_price > p.price;
  return `
    <article class="product-card" data-sku="${p.sku}" data-category="${p.category}">
      <div class="product-thumb">
        <img src="${p.image_url}" alt="${p.name}" loading="lazy">
        ${discount ? `<span class="product-badge">優惠中</span>` : ""}
        ${p.is_group_buy ? `<span class="product-badge group">團購熱銷</span>` : ""}
      </div>
      <div class="product-body">
        <span class="product-cat">${p.category}</span>
        <h3 class="product-name">${p.name}</h3>
        <p class="product-spec">${p.spec}</p>
        <div class="product-price-row">
          <span class="price-now">NT$ ${p.price}</span>
          ${discount ? `<span class="price-old">NT$ ${p.original_price}</span>` : ""}
        </div>
        <div class="product-actions">
          <input type="number" class="qty-input" min="1" value="1" aria-label="數量">
          <button class="btn btn-primary btn-sm btn-block add-cart-btn">加入購物車</button>
        </div>
      </div>
    </article>
  `;
}

function bindAddToCartButtons(container, products) {
  container.querySelectorAll(".product-card").forEach((card) => {
    const sku = card.dataset.sku;
    const product = products.find((p) => p.sku === sku);
    const btn = card.querySelector(".add-cart-btn");
    const qtyInput = card.querySelector(".qty-input");
    btn.addEventListener("click", () => {
      const qty = Math.max(1, parseInt(qtyInput.value, 10) || 1);
      addToCart(product, qty);
    });
  });
}

async function renderProductGrid(container, options = {}) {
  const products = await fetchProducts();
  const list = options.limit ? products.slice(0, options.limit) : products;
  container.innerHTML = list.map(productCardHtml).join("");
  bindAddToCartButtons(container, products);
  return products;
}
