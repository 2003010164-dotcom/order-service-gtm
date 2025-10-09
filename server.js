const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const axios = require("axios");
//require("dotenv").config();
require('dotenv').config()

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Store orders temporarily in memory
let orders = [];
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const USERNAME = process.env.USERNAME;
const PASSWORD = process.env.PASSWORD;


const SF_LOGIN_URL = process.env.SF_LOGIN_URL;

// Manufacturer credentials (from .env)
const MANUFACTURER_EMAIL = process.env.MANUFACTURER_EMAIL;
const MANUFACTURER_PASSWORD = process.env.MANUFACTURER_PASSWORD;


// const CLIENT_ID = process.env.CLIENT_ID;
// const CLIENT_SECRET = process.env.CLIENT_SECRET;
// const USERNAME = process.env.USERNAME;
// const PASSWORD = process.env.PASSWORD;


// const SF_LOGIN_URL = process.env.SF_LOGIN_URL;




// Function to get Salesforce Token
async function getSalesforceToken() {
  const response = await axios.post(process.env.SF_LOGIN_URL, null, {
    params: {
      grant_type: "password",
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      username: process.env.USERNAME,
      password: process.env.PASSWORD,
    },
  });
  return response.data; // { access_token, instance_url }
}











// Receive Order from Salesforce
app.post("/receive-order", (req, res) => {
  try {
    const data = req.body;
    console.log(" Received Order from Salesforce:", data);

    // Generate Reference ID
    const manufacturerOrderNo = "Issue-" + (orders.length + 1).toString().padStart(7, "0");

    const dealerName = data.order.accountName || data.order.AccountId || "Unknown Dealer";

    const orderObj = {
      manufacturerOrderNo : manufacturerOrderNo,
      salesOrderNo: data.order.orderNumber,
     

      dealerName: dealerName,
      vehicle: data.products.map(
        (p) => `${p.ProductName} (x${p.Quantity})`
      ),
      status: data.order.status,
     
    };

    orders.push(orderObj);

    res.status(200).send({ message: "Order received successfully" });
  } catch (err) {
    console.error("❌ Error in /receive-order:", err);
    res.status(500).send({ error: "Failed to process order" });
  }
});

// Show Orders Page
app.get("/orders", (req, res) => {
  res.render("orders", { orders });
});

// Submit updated statuses back to Salesforce
app.post("/submit-statuses", async (req, res) => {
  try {
    console.log(" Incoming order data:", req.body.orders);

    // Authenticate with Salesforce
    const auth = await getSalesforceToken();

    // Loop through all orders from frontend
    for (const order of req.body.orders) {
      const { dealerName, status, manufacturerOrderNo } = order;

      // Create FulfillmentOrder record in Salesforce
      const response = await axios.post(
        `${auth.instance_url}/services/apexrest/FulfillmentOrder`,
        {
          Order_Name__c: dealerName, 
          Order_Status__c: status, 
          Sales_Order_No__c: manufacturerOrderNo 
        },
        {
          headers: {
            Authorization: `Bearer ${auth.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("✅ FulfillmentOrder created:", response.data);
    } 

    
    res.redirect("/orders");

  } catch (err) {
    console.error("❌ Error in /submit-statuses:", err.response?.data || err.message);
    res.status(500).send("Failed to submit orders");
  }
});









const users = []; // temporary in-memory storage




// LOGIN ROUTE
app.get("/login", (req, res) => res.render("login"));

app.post("/login", (req, res) => {
  const { email, password } = req.body;

  // Compare with .env credentials
  if (email === "manufacturer@app.com" || password === "admin123") {
    console.log("✅ Manufacturer login successful:", email);
    res.redirect("/orders");
  } else {
    res.send("<h2>❌ Invalid credentials. <a href='/login'>Try again</a></h2>");
  }
});


//checking env
app.get("/check-env", (req, res) => {
  res.send({
    MANUFACTURER_EMAIL: process.env.MANUFACTURER_EMAIL,
    MANUFACTURER_PASSWORD: process.env.MANUFACTURER_PASSWORD
  });
});


// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});