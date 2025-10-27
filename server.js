const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const axios = require("axios");
//require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(bodyParser.json()); // Parse JSON payloads
//app.use(express.json({ limit: '10mb' }));
//app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true })); // Parse URL form payloads
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// In-memory orders
let orders = [];

// Salesforce creds
const {
  CLIENT_ID,
  CLIENT_SECRET,
  USERNAME,
  PASSWORD,
  SF_LOGIN_URL
} = process.env;

// ------------------------
// Salesforce Auth
// ------------------------
async function getSalesforceToken() {
  const response = await axios.post(SF_LOGIN_URL, null, {
    params: {
      grant_type: "password",
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      username: process.env.USERNAME,
      password: process.env.PASSWORD,
    },
  });
  return response.data;
}

// ------------------------
// Routes
// ------------------------

// Home
app.get("/", (req, res) => {
  res.render("home");
});

// Receive order from Salesforce
app.post("/receive-order", (req, res) => {
  try {
    const data = req.body;
    console.log("📦 Received Order:", JSON.stringify(data, null, 2));

    const manufacturerOrderNo =
      "Issue-" + (orders.length + 1).toString().padStart(7, "0");

    const orderObj = {
      manufacturerOrderNo,
      salesOrderNo: data.order.orderNumber,
      dealerName: data.order.dealerName || "Unknown Dealer",
      vehicle: data.products.map((p) => `${p.ProductName} (x${p.Quantity})`),
      status: data.order.status,
    };

    orders.push(orderObj);
    console.log("✅ Order stored:", orderObj);
    res.status(200).send({ message: "Order received successfully" });
  } catch (err) {
    console.error("❌ Error in /receive-order:", err);
    res.status(500).send({ error: "Failed to process order" });
  }
});

// Orders page
app.get("/orders", (req, res) => {
  res.render("orders", { orders });
});

// ------------------------
// Submit Statuses (fixed)
// ------------------------
app.post("/submit-statuses", async (req, res) => {
  try {
    console.log("📥 Received /submit-statuses");

    // Handle both JSON and form-encoded bodies
    let updatedOrders = req.body.orders;

    if (typeof updatedOrders === "string") {
      try {
        updatedOrders = JSON.parse(updatedOrders);
      } catch (err) {
        console.log("⚠️ Orders were not valid JSON string, wrapping manually");
        updatedOrders = [];
      }
    }

    if (!Array.isArray(updatedOrders) || updatedOrders.length === 0) {
      console.log("❌ No orders received in form or JSON.");
      return res.status(400).send("No orders received.");
    }

    console.log("🚀 Orders to send:", updatedOrders);

    const auth = await getSalesforceToken();
    const endpoint = `${auth.instance_url}/services/apexrest/FulfillmentOrder`;

    const payload = { orders: updatedOrders };
    console.log("📦 Payload for Salesforce:", JSON.stringify(payload, null, 2));

    const sfResponse = await axios.post(endpoint, payload, {
      headers: {
        Authorization: `Bearer ${auth.access_token}`,
        "Content-Type": "application/json",
      },
    });

    console.log("✅ Salesforce Response:", sfResponse.status, sfResponse.data);
    res.status(200).send("Orders submitted successfully to Salesforce.");
  } catch (err) {
    console.error("❌ Error in /submit-statuses:", err.message);
    if (err.response) {
      console.error("🔻 Salesforce Response:", err.response.data);
    }
    res.status(500).send("Failed to submit orders: " + err.message);
  }
});
// ------------------------
// Login
// ------------------------
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

// ------------------------
// Start Server
// ------------------------
app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);
