This mail has been sent from an external source. Do not reply to it, or open any links/attachments unless you are sure of the sender's identity.

 
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const axios = require("axios");
//require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// In-memory order storage
let orders = [];

// Salesforce credentials
const {
  CLIENT_ID,
  CLIENT_SECRET,
  USERNAME,
  PASSWORD,
  SF_LOGIN_URL
} = process.env;

// Get Salesforce token
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

// Receive Order from Salesforce
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
    console.log("✅ Order stored:", orderObj);
    res.status(200).send({ message: "Order received successfully" });
  } catch (err) {
    console.error("❌ Error in /receive-order:", err);
    res.status(500).send({ error: "Failed to process order" });
  }
});

// Show Orders page
app.get("/orders", (req, res) => {
  res.render("orders", { orders });
});

// ✅ Fixed submit-statuses route
app.post("/submit-statuses", async (req, res) => {
  try {
    let updatedOrders = req.body.orders;
    console.log("🧾 Raw body.orders:", updatedOrders);

    if (typeof updatedOrders === "string") {
      try {
        updatedOrders = JSON.parse(updatedOrders);
      } catch (e) {
        console.error("⚠️ JSON parse error:", e.message);
      }
    }

    if (!updatedOrders || updatedOrders.length === 0) {
      console.log("❌ No orders received in form.");
      return res.status(400).send("No orders received.");
    }

    console.log("🚀 Sending updated orders to Salesforce:", updatedOrders);

    const auth = await getSalesforceToken();
    const endpoint = `${auth.instance_url}/services/apexrest/FulfillmentOrder`;

    const sfRes = await axios.post(
      endpoint,
      { orders: updatedOrders },
      {
        headers: {
          Authorization: `Bearer ${auth.access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Salesforce responded:", sfRes.status, sfRes.data);
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

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
