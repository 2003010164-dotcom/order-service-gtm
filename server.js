const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const axios = require("axios");
//require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// ---------- Middleware ----------
app.use(bodyParser.json()); // for JSON POST (from fetch)
app.use(bodyParser.urlencoded({ extended: true })); // for regular form posts
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ---------- In-memory storage ----------
let orders = [];

// ---------- Salesforce credentials ----------
const {
  CLIENT_ID,
  CLIENT_SECRET,
  USERNAME,
  PASSWORD,
  SF_LOGIN_URL
} = process.env;

// ---------- Salesforce Auth ----------
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

// ---------- Routes ----------

// Home
app.get("/", (req, res) => {
  res.render("home"); // your landing page if you have one
});

// Receive order from Salesforce
app.post("/receive-order", (req, res) => {
  try {
    const data = req.body;
    console.log("📦 Received Order:", JSON.stringify(data, null, 2));

    const manufacturerOrderNo = "Issue-" + (orders.length + 1).toString().padStart(7, "0");

    const orderObj = {
      manufacturerOrderNo,
      salesOrderNo: data.order.orderNumber,
      dealerName: data.order.dealerName || "Unknown Dealer",
      vehicle: data.products.map(p => `${p.ProductName} (x${p.Quantity})`),
      status: data.order.status
    };

    orders.push(orderObj);
    console.log("✅ Stored new order:", orderObj);
    res.status(200).send({ message: "Order received successfully" });
  } catch (err) {
    console.error("❌ Error in /receive-order:", err);
    res.status(500).send({ error: "Failed to process order" });
  }
});

// Display all manufacturer orders
app.get("/orders", (req, res) => {
  res.render("orders", { orders });
});

// ---------- Submit statuses ----------
app.post("/submit-statuses", async (req, res) => {
  try {
    console.log("🧾 Full raw request body:", JSON.stringify(req.body, null, 2));
    let updatedOrders = req.body.orders;

    if (!updatedOrders || !Array.isArray(updatedOrders)) {
      console.log("❌ No valid orders array received.");
      return res.status(400).send("No orders received.");
    }

    console.log("🚀 Sending updated orders to Salesforce:", updatedOrders);

    // Get Salesforce auth
    const auth = await getSalesforceToken();
    const endpoint = `${auth.instance_url}/services/apexrest/FulfillmentOrder`;

    // Post to Salesforce REST API
    const sfResponse = await axios.post(
      endpoint,
      { orders: updatedOrders },
      {
        headers: {
          Authorization: `Bearer ${auth.access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Salesforce responded:", sfResponse.status, sfResponse.data);

    // Redirect back to /orders page
    res.redirect("/orders");
  } catch (err) {
    console.error("❌ Error in /submit-statuses:", err.message);
    if (err.response) {
      console.error("Salesforce Response Code:", err.response.status);
      console.error("Salesforce Response Body:", JSON.stringify(err.response.data, null, 2));
    }
    res.status(500).send(
      "Failed to submit orders to Salesforce: " +
        (err.response?.data?.message || err.message)
    );
  }
});

// ---------- Login ----------
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

// ---------- Start Server ----------
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
