// 速來得網購團購網 - 綠界 ECPay 測試環境（沙盒）信用卡結帳
// 依訂單建立綠界「全方位金流」AioCheckOut 表單參數，前端收到後自動轉導至綠界收銀台。
import { createHash } from "node:crypto";

const ECPAY_MERCHANT_ID = "3002607";
const ECPAY_HASH_KEY = "pwFHCqoQZGmho4w6";
const ECPAY_HASH_IV = "EkRm7iFT261dpevs";
const ECPAY_CHECKOUT_URL = "https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function dotNetUrlEncode(str: string): string {
  return encodeURIComponent(str)
    .toLowerCase()
    .replace(/%20/g, "+")
    .replace(/%2d/g, "-")
    .replace(/%5f/g, "_")
    .replace(/%2e/g, ".")
    .replace(/%21/g, "!")
    .replace(/%2a/g, "*")
    .replace(/%28/g, "(")
    .replace(/%29/g, ")");
}

function generateCheckMacValue(params: Record<string, string>): string {
  const sortedKeys = Object.keys(params).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  let raw = `HashKey=${ECPAY_HASH_KEY}`;
  for (const key of sortedKeys) raw += `&${key}=${params[key]}`;
  raw += `&HashIV=${ECPAY_HASH_IV}`;
  const encoded = dotNetUrlEncode(raw);
  return createHash("md5").update(encoded, "utf8").digest("hex").toUpperCase();
}

function formatDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { order_id, client_back_url } = await req.json();
    if (!order_id) {
      return new Response(JSON.stringify({ error: "缺少 order_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orderRes = await fetch(
      `${SUPABASE_URL}/rest/v1/frozen_orders?id=eq.${order_id}&select=*,frozen_order_items(*)`,
      { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` } }
    );
    const orders = await orderRes.json();
    const order = orders[0];

    if (!order) {
      return new Response(JSON.stringify({ error: "找不到訂單" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (order.payment_status === "付款成功") {
      return new Response(JSON.stringify({ error: "此訂單已完成付款" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const merchantTradeNo = ("SLD" + Date.now().toString(36) + Math.floor(Math.random() * 1000))
      .toUpperCase()
      .replace(/[^0-9A-Z]/g, "")
      .slice(0, 20);

    const itemNames =
      (order.frozen_order_items || []).map((i: any) => `${i.product_name} x${i.quantity}`).join("#") ||
      "冷凍調理食品";

    const params: Record<string, string> = {
      MerchantID: ECPAY_MERCHANT_ID,
      MerchantTradeNo: merchantTradeNo,
      MerchantTradeDate: formatDate(new Date()),
      PaymentType: "aio",
      TotalAmount: String(order.total),
      TradeDesc: "速來得網購團購網訂單",
      ItemName: itemNames,
      ReturnURL: `${SUPABASE_URL}/functions/v1/ecpay-notify`,
      ChoosePayment: "Credit",
      ClientBackURL: client_back_url || "",
      EncryptType: "1",
    };

    const checkMacValue = generateCheckMacValue(params);

    await fetch(`${SUPABASE_URL}/rest/v1/frozen_orders?id=eq.${order_id}`, {
      method: "PATCH",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ merchant_trade_no: merchantTradeNo }),
    });

    return new Response(
      JSON.stringify({ action: ECPAY_CHECKOUT_URL, params: { ...params, CheckMacValue: checkMacValue } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
