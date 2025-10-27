const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const axios = require("axios");
//require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware - ensure JSON parser is enabled BEFORE routes
app.use(bodyParser.json({ limit: '2mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use((req, res, next) => {
  // small CORS helper for testing from other origins (safe for dev)
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// In-memory order storage
let orders = [];

const {
  CLIENT_ID,
  CLIENT_SECRET,
  USERNAME,
  PASSWORD,
  SF_LOGIN_URL,
  MANUFACTURER_EMAIL,
  MANUFACTURER_PASSWORD
} = process.env;

// Get Salesforce token
async function getSalesforceToken() {
  const response = await axios.post(SF_LOGIN_URL, null, {
    params: {
      grant_type: "password",
      client_id: process.env.CLIENT_ID || CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET || CLIENT_SECRET,
      username: process.env.USERNAME || USERNAME,
      password: process.env.PASSWORD || PASSWORD,
    },
  });
  return response.data;
}

// Home Page
app.get("/", (req, res) => {
  res.render("home"); // Render the home.ejs file
});

// Receive order (Salesforce callout)
app.post("/receive-order", (req, res) => {
  try {
    const data = req.body;
    console.log("📥 Received Order payload:", JSON.stringify(data, null, 2));

    const manufacturerOrderNo = "Issue-" + (orders.length + 1).toString().padStart(7, "0");

    const orderObj = {
      manufacturerOrderNo,
      salesOrderNo: data.order?.orderNumber || data.orderNumber || "",
      dealerName: data.order?.GTM_Partner_Account__c || data.order?.dealerName || data.order?.accountName || "Unknown Dealer",
      vehicle: Array.isArray(data.products) ? data.products.map(p => `${p.ProductName} (x${p.Quantity})`) : (data.products || []),
      status: data.order?.status || "Acknowledged"
    };

    orders.push(orderObj);
    console.log("✅ Stored order in memory:", orderObj);
    res.status(200).send({ message: "Order received successfully" });
  } catch (err) {
    console.error("❌ Error in /receive-order:", err);
    res.status(500).send({ error: "Failed to process order" });
  }
});

app.post("/update-order-status", (req, res) => {
  try {
    const { salesOrderNo, status } = req.body;
    console.log("📦 Salesforce update received:", salesOrderNo, status);

    // Find matching order in memory
    const order = orders.find(o => o.salesOrderNo === salesOrderNo);
    if (order) {
      order.status = status;
      console.log(`✅ Order ${salesOrderNo} updated to ${status}`);
    } else {
      console.warn(`⚠️ Order ${salesOrderNo} not found in Node memory`);
    }

    res.status(200).send({ message: "Order status updated successfully" });
  } catch (err) {
    console.error("❌ Error in /update-order-status:", err);
    res.status(500).send({ error: "Failed to update order status" });
  }
});

app.get("/orders", (req, res) => {
  res.render("orders", { orders });
});

// Submit Updated Statuses -> POST to Salesforce Apex
app.post("/submit-statuses", async (req, res) => {
  try {
    // req.body could be:
    // - an object { orders: [...] } when sent as JSON
    // - a form-encoded string where orders is a JSON string
    console.log("➡️ /submit-statuses incoming headers:", req.headers['content-type']);
    console.log("➡️ /submit-statuses raw body:", typeof req.body === 'object' ? JSON.stringify(req.body) : String(req.body));

    let updatedOrders = null;

    // if body already has parsed orders array
    if (req.body && req.body.orders) {
      updatedOrders = req.body.orders;
      // If orders comes as a stringified JSON, parse it
      if (typeof updatedOrders === 'string') {
        try {
          updatedOrders = JSON.parse(updatedOrders);
        } catch (parseErr) {
          console.warn("⚠️ Could not parse stringified orders:", parseErr.message);
        }
      }
    } else {
      // Some clients might send the entire body as JSON string in raw text
      if (typeof req.body === 'string') {
        try {
          const parsed = JSON.parse(req.body);
          updatedOrders = parsed.orders || parsed;
        } catch (e) {
          // ignore
        }
      } else if (req.body && Object.keys(req.body).length === 0) {
        // empty body
      } else if (req.body) {
        // Maybe the client sent orders under another key, try finding
        for (const key of Object.keys(req.body)) {
          try {
            const maybe = typeof req.body[key] === 'string' ? JSON.parse(req.body[key]) : req.body[key];
            if (Array.isArray(maybe)) {
              updatedOrders = maybe;
              break;
            } else if (maybe && Array.isArray(maybe.orders)) {
              updatedOrders = maybe.orders;
              break;
            }
          } catch (e) {
            // ignore
          }
        }
      }
    }

    if (!updatedOrders || !Array.isArray(updatedOrders) || updatedOrders.length === 0) {
      console.log("❌ No orders received in form.");
      return res.status(400).send({ message: "No orders received." });
    }

    console.log("📤 Sending updated orders to Salesforce (count=" + updatedOrders.length + "):", JSON.stringify(updatedOrders, null, 2));

    const auth = await getSalesforceToken();
    const endpoint = `${auth.instance_url}/services/apexrest/FulfillmentOrder`;

    const sfResp = await axios.post(
      endpoint,
      { orders: updatedOrders },
      {
        headers: {
          Authorization: `Bearer ${auth.access_token}`,
          "Content-Type": "application/json",
        },
        timeout: 20000
      }
    );

    console.log("✅ Fulfillment Orders sent successfully! Salesforce response status:", sfResp.status);
    // optional: update in-memory orders' statuses to latest (so UI shows updated)
    updatedOrders.forEach(u => {
      const found = orders.find(o => o.manufacturerOrderNo === u.manufacturerOrderNo || o.salesOrderNo === u.salesOrderNo);
      if (found && u.status) found.status = u.status;
    });

    res.status(200).send({ message: "Fulfillment Orders created/updated", salesforceResponse: sfResp.data });
  } catch (err) {
    console.error("❌ Error in /submit-statuses:", err.message);
    if (err.response) {
      console.error("Salesforce response code:", err.response.status);
      console.error("Salesforce response body:", JSON.stringify(err.response.data, null, 2));
      res.status(err.response.status).send({ message: "Salesforce error", details: err.response.data });
    } else {
      res.status(500).send({ message: "Internal server error", error: err.message });
    }
  }
});

// Login
app.get("/login", (req, res) => res.render("login"));
app.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (email === "manufacturer@app.com" && password === "admin123") {
    console.log("✅ Login success:", email);
    res.redirect("/orders");
  } else {
    res.send("<h3>Invalid credentials. <a href='/login'>Try again</a></h3>");
  }
});

app.listen(PORT, () => console.log(` Server running on http://localhost:${PORT}`));
