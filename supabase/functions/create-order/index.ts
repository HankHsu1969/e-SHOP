// 速來得網購團購網 - 建立訂單 (取代前端直接寫入 frozen_orders / frozen_order_items)
// 資料表 RLS 已鎖死一般使用者的讀寫權限，訂單一律透過這支 Function（service role）建立，
// 避免任何人可以用公開的 anon key 直接列出或竄改所有訂單。
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "MethodNotAllowed" }, 405);

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "InvalidJSON" }, 400);
  }

  const { member_id, customer_name, customer_email, customer_phone, customer_address, items } = payload as {
    member_id?: string | null;
    customer_name?: string;
    customer_email?: string | null;
    customer_phone?: string;
    customer_address?: string;
    items?: Array<{ sku: string; name: string; price: number; quantity: number }>;
  };

  if (!customer_name || !customer_phone || !customer_address || !Array.isArray(items) || items.length === 0) {
    return jsonResponse({ error: "MissingFields" }, 400);
  }

  for (const item of items) {
    if (
      typeof item.sku !== "string" ||
      typeof item.name !== "string" ||
      typeof item.price !== "number" ||
      item.price < 0 ||
      typeof item.quantity !== "number" ||
      item.quantity <= 0
    ) {
      return jsonResponse({ error: "InvalidItem" }, 400);
    }
  }

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const FREE_SHIPPING_THRESHOLD = 1500;
  const SHIPPING_FEE = 100;
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const total = subtotal + shipping;

  const restHeaders = {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };

  const orderResp = await fetch(`${SUPABASE_URL}/rest/v1/frozen_orders`, {
    method: "POST",
    headers: { ...restHeaders, Prefer: "return=representation" },
    body: JSON.stringify({
      member_id: member_id || null,
      customer_name,
      customer_email: customer_email || null,
      customer_phone,
      customer_address,
      subtotal,
      shipping_fee: shipping,
      total,
    }),
  });

  if (!orderResp.ok) {
    return jsonResponse({ error: "OrderCreateFailed" }, 500);
  }
  const [order] = await orderResp.json();

  const orderItems = items.map((item) => ({
    order_id: order.id,
    product_sku: item.sku,
    product_name: item.name,
    unit_price: item.price,
    quantity: item.quantity,
    line_total: item.price * item.quantity,
  }));

  const itemsResp = await fetch(`${SUPABASE_URL}/rest/v1/frozen_order_items`, {
    method: "POST",
    headers: { ...restHeaders, Prefer: "return=minimal" },
    body: JSON.stringify(orderItems),
  });

  if (!itemsResp.ok) {
    return jsonResponse({ error: "OrderItemsCreateFailed" }, 500);
  }

  return jsonResponse({ order });
});
