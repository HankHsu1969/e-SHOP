# 速來得網購團購網 — 系統架構規格書

版本：v1.0　最後更新：2026-07-02

## 1. 系統概述

「速來得網購團購網」是一個冷凍調理食品的網購／團購網站，採用**純前端靜態網站 + BaaS（Backend as a Service）+ 第三方金流**的輕量架構，沒有自建的應用伺服器。

| 角色 | 使用服務 | 說明 |
|---|---|---|
| 前端網站 | 靜態 HTML/CSS/JS，託管於 **Netlify** | 5 個主要頁面 + 2 個輔助頁面，無框架、無建置流程 |
| 資料庫 / 會員系統 / 無伺服器函式 | **Supabase**（專案：Course Test） | PostgreSQL 資料庫、Auth 會員系統、Edge Functions |
| 金流 | **綠界科技 ECPay**（目前為測試環境） | 信用卡收單，透過 Supabase Edge Functions 中介 |
| 版本控制 / CI 觸發 | **GitHub**（HankHsu1969/e-shop） | Netlify 監聽此 repo 的分支自動部署 |

---

## 2. 系統架構圖

```mermaid
flowchart TB
    subgraph User["使用者瀏覽器"]
        Browser["靜態網頁\n(index / products / cart / member ...)"]
    end

    subgraph Netlify["Netlify（靜態網站託管）"]
        Site["sulaide-frozen-food.netlify.app\n純靜態檔案，無伺服器邏輯"]
    end

    subgraph GitHub["GitHub"]
        Repo["HankHsu1969/e-shop\n分支：claude/frozen-food-ecommerce-site-5y2j87"]
    end

    subgraph Supabase["Supabase 專案（Course Test）"]
        DB[("PostgreSQL\nfrozen_products / frozen_members\nfrozen_cart_items / frozen_orders\nfrozen_order_items")]
        Auth["Supabase Auth\n(email/password 會員登入)"]
        EF1["Edge Function\necpay-checkout"]
        EF2["Edge Function\necpay-notify (Webhook)"]
    end

    subgraph ECPay["綠界 ECPay（測試環境）"]
        Checkout["AioCheckOut 收銀台\npayment-stage.ecpay.com.tw"]
    end

    Repo -- "git push 觸發自動建置部署" --> Site
    Browser -- "HTTPS 靜態資源" --> Site
    Browser -- "Supabase JS SDK\n(anon key)" --> DB
    Browser -- "登入/註冊" --> Auth
    Browser -- "建立訂單後呼叫" --> EF1
    EF1 -- "讀寫訂單" --> DB
    EF1 -- "回傳付款表單參數" --> Browser
    Browser -- "表單 POST 導向" --> Checkout
    Checkout -- "使用者刷卡" --> Checkout
    Checkout -- "Server 端 Webhook\n(ReturnURL)" --> EF2
    EF2 -- "驗證後更新付款狀態" --> DB
    Checkout -- "瀏覽器導回 ClientBackURL" --> Site
    Site -- "payment-result.html 輪詢查詢" --> DB
```

---

## 3. 前端頁面清單

所有頁面共用固定導覽列（`.site-header` / `.main-nav`）與品牌色系（見 `css/style.css` 的 CSS 變數 `--color-primary` 等），彼此為獨立 HTML 檔案，非 SPA。

| 檔案 | 對應功能 | 主要相依 JS |
|---|---|---|
| `index.html` | 主畫面（Hero、精選商品、品牌介紹） | `products.js`、`products-data.js` |
| `brand-story.html` | 品牌故事 | 無資料庫存取 |
| `products.html` | 商品列表、搜尋、分類篩選 | `products.js` |
| `cart.html` | 購物車、結帳、付款方式選擇（信用卡／貨到付款） | `cart.js` |
| `member.html` | 會員註冊／登入／資料編輯 | `member.js` |
| `payment-result.html` | 綠界付款導回頁，輪詢訂單付款狀態 | `payment-result.js` |
| `dashboard.html` | **內部**訂單後台儀表板（footer 連結進入，不在主導覽列） | `dashboard.js` |

共用模組：

- `js/supabase-client.js`：建立全域 `supabaseClient`（Supabase URL + anon/publishable key）
- `js/main.js`：購物車 localStorage 存取、Toast 提示、導覽列手機版選單
- `js/products-data.js`：10 筆商品的**離線備援資料**（Supabase 連不上時前端會 fallback 使用）

---

## 4. 資料庫結構（Supabase Postgres）

```mermaid
erDiagram
    frozen_members ||--o{ frozen_orders : "下單(可選)"
    frozen_members ||--o{ frozen_cart_items : "購物車(可選)"
    frozen_products ||--o{ frozen_cart_items : "加入購物車"
    frozen_orders ||--|{ frozen_order_items : "訂單明細"

    frozen_products {
        uuid id PK
        text sku UK
        text name
        text category
        text description
        text spec
        int price
        int original_price
        int stock
        text image_url
        text[] tags
        bool is_group_buy
        int sort_order
    }

    frozen_members {
        uuid id PK
        uuid auth_user_id FK "references auth.users"
        text email UK
        text name
        text phone
        text address
        text member_level
        int points
    }

    frozen_cart_items {
        uuid id PK
        uuid member_id FK
        text session_id
        uuid product_id FK
        int quantity
    }

    frozen_orders {
        uuid id PK
        uuid member_id FK
        text customer_name
        text customer_email
        text customer_phone
        text customer_address
        int subtotal
        int shipping_fee
        int total
        text status "待處理/已出貨/已完成/已取消"
        text payment_status "未付款/付款成功/付款失敗"
        text payment_method
        text merchant_trade_no UK
        timestamptz paid_at
        text ecpay_rtn_msg
    }

    frozen_order_items {
        uuid id PK
        uuid order_id FK
        text product_sku
        text product_name
        int unit_price
        int quantity
        int line_total
    }
```

> 注意：Course Test 這個 Supabase 專案原本就有 `customers` / `categories` / `drinks` / `profiles` / `orders` / `order_items` 等舊表（來自其他練習專案），與本網站的 `frozen_*` 系列資料表**互不相關**，刻意用 `frozen_` 前綴區隔避免混用。

### RLS（Row Level Security）現況

所有 `frozen_*` 資料表皆已啟用 RLS，但目前的政策是「**匿名 anon key 可自由讀寫**」（`using (true)` / `with check (true)`），僅適用於 demo／測試階段。正式上線前應改為：

- `frozen_orders` / `frozen_order_items`：只允許本人（`auth.uid()` 對應的 `member_id`）或後台管理角色讀取
- 後台 `dashboard.html` 目前僅用一組寫死在前端 JS 的通行碼（`sulaide2026`）做輕量門檻，**不是真正的權限控管**

---

## 5. Supabase Edge Functions

| Function | 觸發者 | JWT 驗證 | 用途 |
|---|---|---|---|
| `ecpay-checkout` | 前端 `cart.js`（使用者按下「前往結帳」且選信用卡） | 否（`verify_jwt=false`，一般訪客結帳無登入） | 讀取訂單、組出綠界 `AioCheckOut` 表單參數並計算 `CheckMacValue`，回傳給前端自動送出表單 |
| `ecpay-notify` | 綠界伺服器（`ReturnURL` webhook，非使用者瀏覽器） | 否（改用 `CheckMacValue` 驗證來源合法性） | 驗證綠界回傳的 `CheckMacValue`，更新 `frozen_orders.payment_status` |

兩者皆使用 `SUPABASE_SERVICE_ROLE_KEY`（Supabase 自動注入的環境變數）直接呼叫 PostgREST，繞過 RLS 限制，確保金流狀態更新一定成功。

### 金流串接關鍵參數

- 環境：綠界**測試環境**（`payment-stage.ecpay.com.tw`）
- MerchantID：`3002607`（測試帳號，僅供 sandbox 使用）
- 簽章演算法：**SHA256**（`EncryptType: 1`）— 此為 AioCheckOut 服務對應規則，注意綠界的物流測試帳號是另一組帳號、且用 MD5，兩者不可混用

---

## 6. 金流付款時序圖

```mermaid
sequenceDiagram
    participant U as 使用者瀏覽器
    participant C as cart.html / cart.js
    participant D as Supabase DB
    participant F1 as ecpay-checkout
    participant E as 綠界收銀台
    participant F2 as ecpay-notify
    participant P as payment-result.html

    U->>C: 填寫收件資訊、選信用卡、按下結帳
    C->>D: insert frozen_orders (未付款)
    C->>D: insert frozen_order_items
    C->>F1: POST {order_id, client_back_url}
    F1->>D: 查詢訂單與明細
    F1->>F1: 產生 MerchantTradeNo、計算 CheckMacValue(SHA256)
    F1->>D: 寫入 merchant_trade_no
    F1-->>C: 回傳 AioCheckOut 表單參數
    C->>E: 自動提交表單，瀏覽器導向綠界
    U->>E: 輸入信用卡資訊付款
    E->>F2: Server端 POST 付款結果 (ReturnURL)
    F2->>F2: 驗證 CheckMacValue
    F2->>D: update frozen_orders.payment_status
    F2-->>E: 回應 "1|OK"
    E->>P: 使用者按「返回商店」導向 ClientBackURL
    P->>D: 輪詢查詢 payment_status（最多 8 次、間隔 1.5 秒）
    D-->>P: 回傳最新付款狀態
    P-->>U: 顯示 付款成功 / 處理中 / 失敗
```

---

## 7. 部署與環境資訊

| 項目 | 內容 |
|---|---|
| 原始碼倉庫 | GitHub `HankHsu1969/e-shop`，開發分支 `claude/frozen-food-ecommerce-site-5y2j87` |
| 前端託管 | Netlify 專案 `sulaide-frozen-food`，已連接上述 GitHub 分支，push 後自動建置部署（無 build command，publish directory 為根目錄） |
| 資料庫 / Auth / Edge Functions | Supabase 專案 **Course Test**（project_id: `cbaapxvsgaqsogqijtzo`） |
| 金流 | 綠界 ECPay 測試環境（尚未申請正式特約商店） |
| 前端連線金鑰 | `js/supabase-client.js` 內硬編碼 Supabase URL + **publishable/anon key**（此為公開金鑰，設計上可曝露於前端，安全性依賴 RLS） |

---

## 8. 已知限制 / 上線前待辦

1. **RLS 政策過於寬鬆**：目前 `frozen_orders` 等表對任何持有 anon key 的人開放讀寫，正式上線前需改為依 `auth.uid()` 限制存取範圍。
2. **後台儀表板無真正權限控管**：`dashboard.html` 僅前端寫死通行碼，建議改用 Supabase Auth 角色 + RLS，或另外架設需登入的後台。
3. **金流為測試環境**：需向綠界申請正式特約商店代號，並將 `ECPAY_MERCHANT_ID` / `ECPAY_HASH_KEY` / `ECPAY_HASH_IV` 換成正式環境金鑰，同時將 `ECPAY_CHECKOUT_URL` 由 `payment-stage.ecpay.com.tw` 改為正式 `payment.ecpay.com.tw`。
4. **會員系統與購物車尚未完全綁定 Supabase**：目前購物車以 `localStorage` 為主，只有下單當下才寫入 Supabase 的 `frozen_orders`；`frozen_cart_items` 表已建立但前端尚未串接使用。
5. **Netlify 網域為預設子網域**：尚未綁定自訂網域（如 sulaide.com.tw）。
