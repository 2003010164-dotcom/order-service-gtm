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
  SF_LOGIN_URL,
  MANUFACTURER_EMAIL,
  MANUFACTURER_PASSWORD
} = process.env;

// Get Salesforce token
async function getSalesforceToken() {
  const response = await axios.post(SF_LOGIN_URL, null, {
    params: {
      grant_type: "password",
      client_id: process.env.CLIENT_ID,
      client_secret:  process.env.CLIENT_SECRET,
      username:  process.env.USERNAME,
      password:  process.env.PASSWORD,
    },
  });
  return response.data;
}

// Receive Order from Salesforce
app.post("/receive-order", (req, res) => {
  try {
    const data = req.body;
    console.log(" Received Order:", data);

    const manufacturerOrderNo = "Issue-" + (orders.length + 1).toString().padStart(7, "0");

    const orderObj = {
      manufacturerOrderNo,
      salesOrderNo: data.order.orderNumber,
      dealerName: data.order.accountName || "Unknown Dealer",
      vehicle: data.products.map(p => `${p.ProductName} (x${p.Quantity})`),
      status: data.order.status
    };

    orders.push(orderObj);
    res.status(200).send({ message: "Order received successfully" });
  } catch (err) {
    console.error("❌ Error in /receive-order:", err);
    res.status(500).send({ error: "Failed to process order" });
  }
});

//  Display Orders Page
app.get("/orders", (req, res) => {
  res.render("orders", { orders });
});

// 3️⃣ Submit Updated Statuses
app.post("/submit-statuses", async (req, res) => {
  try {
    const updatedOrders = req.body.orders;
    if (!updatedOrders) {
      console.log("❌ No orders received in form.");
      return res.status(400).send("No orders received.");
    }

    console.log(" Sending updated orders to Salesforce:", updatedOrders);

    const auth = await getSalesforceToken();
    const endpoint = `${auth.instance_url}/services/apexrest/FulfillmentOrder`;

    await axios.post(
      endpoint,
      { orders: updatedOrders }, // structure Salesforce expects
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
  console.error(" Error in /submit-statuses:", err.message);
  if (err.response) {
    console.error(" Salesforce Response Code:", err.response.status);
    console.error(" Salesforce Response Body:", JSON.stringify(err.response.data, null, 2));
  } else {
    console.error(" No response from Salesforce");
  }
  res.status(500).send("Failed to submit orders to Salesforce: " + (err.response?.data?.message || err.message));
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

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
