const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
//require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ---------------------------
// In-memory + file-based order storage
// ---------------------------
let orders = [];
const ORDERS_FILE = path.join(__dirname, "orders.json");

// Load existing orders if available (persist across Render restarts)
if (fs.existsSync(ORDERS_FILE)) {
  try {
    orders = JSON.parse(fs.readFileSync(ORDERS_FILE));
    console.log(`✅ Loaded ${orders.length} existing orders from file`);
  } catch (e) {
    console.error(" Failed to read orders.json:", e.message);
  }
}

// Salesforce credentials
const {
  CLIENT_ID,
  CLIENT_SECRET,
  USERNAME,
  PASSWORD,
  SF_LOGIN_URL,
  MANUFACTURER_EMAIL,
  MANUFACTURER_PASSWORD
} = process.env;

// ---------------------------
// Function to get Salesforce Access Token
// ---------------------------
async function getSalesforceToken() {
  const response = await axios.post(SF_LOGIN_URL, null, {
    params: {
      grant_type: "password",
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      username: process.env.USERNAME,
      password: process.env.PASSWORD, // includes security token
    },
  });
  return response.data; // { access_token, instance_url }
}

// ---------------------------
// 1️⃣ Receive Order from Salesforce
// ---------------------------
app.post("/receive-order", (req, res) => {
  try {
    const data = req.body;
    console.log("📥 Received Order from Salesforce:", data);

    const manufacturerOrderNo = "Issue-" + (orders.length + 1).toString().padStart(7, "0");

    const orderObj = {
      manufacturerOrderNo,
      salesOrderNo: data.order.orderNumber,
      dealerName: data.order.accountName || "Unknown Dealer",
      vehicle: data.products.map(p => `${p.ProductName} (x${p.Quantity})`),
      status: data.order.status
    };

    orders.push(orderObj);
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2)); // persist

    res.status(200).send({ message: "✅ Order received successfully" });
  } catch (err) {
    console.error("❌ Error in /receive-order:", err);
    res.status(500).send({ error: "Failed to process order" });
  }
});

// ---------------------------
// 2️⃣ Display Orders Page
// ---------------------------
app.get("/orders", (req, res) => {
  res.render("orders", { orders });
});

// ---------------------------
// 3️⃣ Submit Updated Statuses to Salesforce
// ---------------------------
app.post("/submit-statuses", async (req, res) => {
  try {
    const updatedOrders = req.body.orders || [];

    if (!Array.isArray(updatedOrders) || updatedOrders.length === 0) {
      console.log("❌ No orders received in request body.");
      return res.status(400).send("No orders received.");
    }

    console.log(" Sending updated orders to Salesforce:", JSON.stringify(updatedOrders, null, 2));

    const auth = await getSalesforceToken();
    const endpoint = `${auth.instance_url}/services/apexrest/FulfillmentOrder`;

    const response = await axios.post(
      endpoint,
      { orders: updatedOrders },
      {
        headers: {
          Authorization: `Bearer ${auth.access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Fulfillment Orders sent successfully!");
    res.redirect("/orders");
  } catch (err) {
  console.error("❌ Error in /submit-statuses:", err.response?.data || err.message);
  if (err.response) {
    console.error("Salesforce Response:", err.response.status, err.response.data);
  }
  res.status(500).send("Failed to submit orders to Salesforce.");
}
});


//  Manufacturer Login

app.get("/login", (req, res) => res.render("login"));
app.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (email === "manufacturer@app.com" && password === "admin123") {
    console.log("✅ Login success:", email);
    res.redirect("/orders");
  } else {
    res.send("<h3>❌ Invalid credentials. <a href='/login'>Try again</a></h3>");
  }
});


app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
