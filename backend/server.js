const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const axios = require("axios");
//require("dotenv").config();

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


// const CLIENT_ID = process.env.CLIENT_ID;
// const CLIENT_SECRET = process.env.CLIENT_SECRET;
// const USERNAME = process.env.USERNAME;
// const PASSWORD = process.env.PASSWORD;


// const SF_LOGIN_URL = process.env.SF_LOGIN_URL;

// ⚡ Replace these values with your Connected App credentials


// Function to get Salesforce Token
async function getSalesforceToken() {
  const response = await axios.post(SF_LOGIN_URL, null, {
    params: {
      grant_type: "password",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      username: USERNAME,
      password: PASSWORD,
    },
  });
  return response.data; // { access_token, instance_url }
}











// Receive Order from Salesforce
app.post("/receive-order", (req, res) => {
  try {
    const data = req.body;
    console.log("📥 Received Order from Salesforce:", data);

    // Generate Reference ID
    const referenceId = "REF-" + (orders.length + 1).toString().padStart(4, "0");

    const orderObj = {
      orderNumber: data.order.orderNumber,
      orderName: data.order.orderName,
      products: data.products.map(
        (p) => `${p.ProductName} (x${p.Quantity})`
      ),
      status: data.order.status,
      referenceId: referenceId,
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
      const { orderName, status, referenceId } = order;

      // Create FulfillmentOrder record in Salesforce
      const response = await axios.post(
        `${auth.instance_url}/services/apexrest/FulfillmentOrder`,
        {
          Order_Name__c: orderName, // 👈 Salesforce field
          Order_Status__c: status, // 👈 Salesforce field
          Sales_Order_No__c: referenceId //  Salesforce field
        },
        {
          headers: {
            Authorization: `Bearer ${auth.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("✅ FulfillmentOrder created:", response.data);
    } // <- ✅ for loop yaha band ho raha hai

    // After loop completes, redirect
    res.redirect("/orders");

  } catch (err) {
    console.error("❌ Error in /submit-statuses:", err.response?.data || err.message);
    res.status(500).send("Failed to submit orders");
  }
});




// DELETE ORDER ROUTE
// =====================
app.post("/delete-order", (req, res) => {
  try {
    const { referenceId } = req.body;
    console.log("🗑️ Deleting order with Reference ID:", referenceId);

    // Find order index
    const index = orders.findIndex(o => o.referenceId === referenceId);
    if (index !== -1) {
      orders.splice(index, 1);
      console.log("✅ Order deleted successfully:", referenceId);
    } else {
      console.log("⚠️ Order not found:", referenceId);
    }

    // Redirect back to the orders page
    res.redirect("/orders");
  } catch (err) {
    console.error("❌ Error deleting order:", err);
    res.status(500).send("Failed to delete order");
  }
});



// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});