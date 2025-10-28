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

app.get("/orders", (req, res) => {
  res.render("orders", { orders });
});

app.post("/submit-statuses", async (req, res) => {
  try {
    console.log(" Incoming order data:", req.body.orders);

    const auth = await getSalesforceToken();

    for (const order of req.body.orders) {
      const { orderName, status, referenceId } = order;

      const response = await axios.post(
        `${auth.instance_url}/services/apexrest/FulfillmentOrder`,
        {
          Order_Name__c: orderName, 
          Order_Status__c: status, 
          Sales_Order_No__c: referenceId 
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
    console.error("Error in /submit-statuses:", err.response?.data || err.message);
    res.status(500).send("Failed to submit orders");
  }
});





app.post("/delete-order", (req, res) => {
  try {
    const { referenceId } = req.body;
    console.log("🗑️ Deleting order with Reference ID:", referenceId);

    const index = orders.findIndex(o => o.referenceId === referenceId);
    if (index !== -1) {
      orders.splice(index, 1);
      console.log("✅ Order deleted successfully:", referenceId);
    } else {
      console.log("⚠️ Order not found:", referenceId);
    }

    res.redirect("/orders");
  } catch (err) {
    console.error("❌ Error deleting order:", err);
    res.status(500).send("Failed to delete order");
  }
});



app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
