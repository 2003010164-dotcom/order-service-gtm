const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const axios = require("axios");
//require("dotenv").config();
 
const app = express();
const PORT = process.env.PORT || 5000;
 
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
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
let partsOrders = [];


let telemetryData = [
  {
    vin: "VIN-JEEP-0001",
    vehicle: "Jeep Compass",
    speed: 62,
    battery: 78,
    fuel: 54,
    engineTemp: 92,
    tyrePressure: "34 PSI",
    location: "Pune, India",
    odometer: 15234,
    lastUpdated: new Date().toLocaleString()
  },
  {
    vin: "VIN-JEEP-0002",
    vehicle: "Jeep Meridian",
    speed: 80,
    battery: 65,
    fuel: 61,
    engineTemp: 96,
    tyrePressure: "33 PSI",
    location: "Delhi, India",
    odometer: 22340,
    lastUpdated: new Date().toLocaleString()
  },
  {
    vin: "VIN-JEEP-0003",
    vehicle: "Jeep Wrangler",
    speed: 55,
    battery: 70,
    fuel: 40,
    engineTemp: 90,
    tyrePressure: "35 PSI",
    location: "Bangalore, India",
    odometer: 18500,
    lastUpdated: new Date().toLocaleString()
  },
  {
    vin: "VIN-CIT-0001",
    vehicle: "Citroën C3",
    speed: 48,
    battery: 50,
    fuel: 68,
    engineTemp: 87,
    tyrePressure: "33 PSI",
    location: "Mumbai, India",
    odometer: 9820,
    lastUpdated: new Date().toLocaleString()
  },
  {
    vin: "VIN-CIT-0002",
    vehicle: "Citroën eC3",
    speed: 72,
    battery: 82,
    fuel: 0,
    engineTemp: 78,
    tyrePressure: "34 PSI",
    location: "Hyderabad, India",
    odometer: 7650,
    lastUpdated: new Date().toLocaleString()
  },
  {
    vin: "VIN-CIT-0003",
    vehicle: "Citroën C5 Aircross",
    speed: 66,
    battery: 60,
    fuel: 58,
    engineTemp: 93,
    tyrePressure: "32 PSI",
    location: "Chennai, India",
    odometer: 31210,
    lastUpdated: new Date().toLocaleString()
  }
];


let deliveryVehicles = [
  { brand: "Jeep", model: "Compass", variant: "Limited", status: "Allocated", color: "White", duration: "45 Days" },
  { brand: "Jeep", model: "Compass", variant: "Sport", status: "In Production", color: "Red", duration: "25 Days" },
   { brand: "Jeep", model: "Meridian", variant: "Longitude AT", status: "Acknowledged", color: "Black", duration: "28 Days" },
  { brand: "Jeep", model: "Meridian", variant: "Longitude AT", status: "In Production", color: "White", duration: "19 Days" },
  { brand: "Jeep", model: "Wrangler", variant: "Rubicon", status: "In Transit", color: "Red", duration: "15 Days" },
  { brand: "Jeep", model: "Wrangler", variant: "Sport", status: "Acknowledged", color: "Red", duration: "18 Days" },
  { brand: "Jeep", model: "Renegade", variant: "Base", status: "Allocated", color: "Black", duration: "50 Days" },
  { brand: "Jeep", model: "Renegade", variant: "Premium", status: "In Paint", color: "White", duration: "45 Days" },

  { brand: "Citroën", model: "C3", variant: "Live", status: "Acknowledged", color: "Red", duration: "25 Days" },
  { brand: "Citroën", model: "C3", variant: "Feel", status: "Allocated", color: "Black", duration: "30 Days" },
  { brand: "Citroën", model: "C3", variant: "Feel Optional", status: "In Production", color: "White", duration: "35 Days" },
  { brand: "Citroën", model: "C3", variant: "Shine Turbo AT", status: "In Paint", color: "White", duration: "18 Days" },
  { brand: "Citroën", model: "C3", variant: "Shine CNG", status: "In Transit", color: "Red", duration: "15 Days" },

  { brand: "Citroën", model: "eC3", variant: "Live", status: "Allocated", color: "Black", duration: "27 Days" },
  { brand: "Citroën", model: "eC3", variant: "Feel", status: "In Production", color: "Red", duration: "32 Days" },
  { brand: "Citroën", model: "eC3", variant: "Shine", status: "In Transit", color: "Red", duration: "16 Days" },

  { brand: "Citroën", model: "C3 Aircross", variant: "Max 1.2 Turbo 7 STR AT", status: "In Paint", color: "Red", duration: "22 Days" },
  { brand: "Citroën", model: "C3 Aircross", variant: "Shine Turbo AT", status: "In Production", color: "Black", duration: "28 Days" },
  { brand: "Citroën", model: "C3 Aircross", variant: "Max Turbo Dark Edition", status: "Allocated", color: "White", duration: "19 Days" },

  { brand: "Citroën", model: "C5 Aircross", variant: "Shine", status: "Acknowledged", color: "Black", duration: "40 Days" },
  { brand: "Citroën", model: "C5 Aircross", variant: "Max", status: "In Production", color: "White", duration: "34 Days" },
  { brand: "Citroën", model: "C5 Aircross", variant: "Shine", status: "In Voiced", color: "Red", duration: "14 Days" },
  { brand: "Citroën", model: "C5 Aircross", variant: "Max", status: "Delivered", color: "White", duration: "Delivered" }
];
 
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
  res.render("home");
});


// Store only the latest connected-asset received from Salesforce
let latestAsset = null;


app.post("/receive-asset", (req, res) => {
  try {
    const data = req.body;
    console.log("📥 Received Asset payload:", JSON.stringify(data, null, 2));

    // Expecting:
    // { orderNumber: "xxxx", asset: { assetId, serialNumber, name } }
    if (!data || !data.asset || !data.asset.serialNumber) {
      return res.status(400).json({ message: "Invalid payload. asset.serialNumber is required" });
    }

    latestAsset = {
      orderNumber: data.orderNumber || "",
      assetId: data.asset.assetId || "",
      serialNumber: data.asset.serialNumber,
      name: data.asset.name || ""
    };

    console.log("✅ Stored latest asset:", latestAsset);
    return res.status(200).json({ message: "Asset received successfully", latestAsset });
  } catch (err) {
    console.error("❌ Error in /receive-asset:", err);
    return res.status(500).json({ message: "Failed to process asset", error: err.message });
  }
});


 
app.post("/receive-order", (req, res) => {
  try {
    const data = req.body;
    console.log("📥 Received Order payload:", JSON.stringify(data, null, 2));
    if (data.orderType !== 'VEHICLE') {
    return res.status(400).send("Not a Vehicle order");
  }

 
    const manufacturerOrderNo = "Issue-" + (orders.length + 1).toString().padStart(7, "0");
 
    const orderObj = {
      manufacturerOrderNo,
      salesOrderNo: data.order?.orderNumber || data.orderNumber || "",
      dealerName: data.order?.GTM_Partner_Account__c || data.order?.dealerName || data.order?.accountName || "Unknown Dealer",
  vehicle: Array.isArray(data.products)
  ? data.products.map(p => `${p.Product2?.Name || "Unknown Product"} (x${p.Quantity})`)
  : [],      
     status: data.order?.status || "Acknowledged"
    };
 
    orders.push(orderObj);
    res.send("Vehicle order received");
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
 
    const order = orders.find(o => o.salesOrderNo === salesOrderNo);
    if (order) {
      order.status = status;
      console.log(`✅ Order ${salesOrderNo} updated to ${status}`);
    } else {
      console.warn(`⚠️ Order ${salesOrderNo} not found in Node memory`);
    }
 
    res.status(200).send({ message: "Order status updated successfully" });
  } catch (err) {
    console.error(" Error in /update-order-status:", err);
    res.status(500).send({ error: "Failed to update order status" });
  }
});
 
app.get("/orders", (req, res) => {
  res.render("orders", { orders });
});


 
app.post("/submit-statuses", async (req, res) => {
  try {
      console.log(" Received at /submit-statuses");
      console.log("Headers:", req.headers);
      console.log("Body:", JSON.stringify(req.body, null, 2));
   
    //console.log(" /submit-statuses incoming headers:", req.headers['content-type']);
    //console.log(" /submit-statuses raw body:", typeof req.body === 'object' ? JSON.stringify(req.body) : String(req.body));
   
 
    let updatedOrders = null;
 
    if (req.body && req.body.orders) {
      updatedOrders = req.body.orders;
      if (typeof updatedOrders === 'string') {
        try {
          updatedOrders = JSON.parse(updatedOrders);
        } catch (parseErr) {
          console.warn("⚠️ Could not parse stringified orders:", parseErr.message);
        }
      }
    } else {
      if (typeof req.body === 'string') {
        try {
          const parsed = JSON.parse(req.body);
          updatedOrders = parsed.orders || parsed;
        } catch (e) {
        }
      } else if (req.body && Object.keys(req.body).length === 0) {
      } else if (req.body) {
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
          }
        }
      }
    }
 
    if (!updatedOrders || !Array.isArray(updatedOrders) || updatedOrders.length === 0) {
      console.log(" No orders received in form.");
      return res.status(400).send({ message: "No orders received." });
    }
 
    console.log(" Sending updated orders to Salesforce (count=" + updatedOrders.length + "):", JSON.stringify(updatedOrders, null, 2));
 
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
 
    console.log(" Fulfillment Orders sent successfully! Salesforce response status:", sfResp.status);
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
    res.redirect("/dashboard");
  } 
   if(email === "telemetryManager@app.com" && password === "admin123"){
    console.log("Login Success: ", email);
    res.redirect("/telemetry");
   }
  
  else {
    res.send("<h3>Invalid credentials. <a href='/login'>Try again</a></h3>");
  }
});


app.post('/fo-delivered', (req, res) => {
  const { salesOrderNo } = req.body;
  console.log(" Delivered update from Salesforce:", salesOrderNo);

  let order = orders.find(o => o.salesOrderNo === salesOrderNo);

  if (!order) {
    order = partsOrders.find(o => o.salesOrderNo === salesOrderNo);
  }

  if (order) {
    order.status = "Delivered";
    console.log(" Updated order status to Delivered in Node memory");
  } else {
    console.log(" Order not found in Node memory");
  }

  res.send("OK");
});

app.get("/dashboard" , (req,res) => {
 res.render("dashboard");
});


app.post("/receive-parts-order", (req, res) => {
  try {
    const data = req.body;
    console.log("📦 Parts Order received:", JSON.stringify(data, null, 2));
    if (data.orderType !== 'PARTS') {
    return res.status(400).send("Not a Parts order");
  }

    
    const manufacturerOrderNo = "Issue-" + (orders.length + 1).toString().padStart(7, "0");


    const partsOrderObj = {
      manufacturerOrderNo,
      salesOrderNo: data.order?.orderNumber || "",
      dealerName: data.order?.dealerName || "Unknown Dealer",
     parts: Array.isArray(data.products)
  ? data.products.map(p => `${p.Product2?.Name || "Unknown Product"} (x${p.Quantity})`)
  : [],
      status: data.order?.status || "Acknowledged"
    };

    partsOrders.push(partsOrderObj);
    res.send("Parts order received");

    console.log("✅ Parts order stored:", partsOrderObj);

    res.status(200).send({ message: "Parts order received" });
  } catch (err) {
    console.error("❌ Error receiving parts order:", err);
    res.status(500).send("Failed to receive parts order");
  }
});

app.get("/parts-orders", (req, res) => {
  res.render("partsOrders", { orders: partsOrders });
});



app.get("/telemetry", (req, res) => {
  // Default model with required fields (editable)
  const model = {
    vehicleSerialNumber: latestAsset?.serialNumber || "VHC-0004",
    eventTimestamp: new Date().toISOString().slice(0, 16), // for datetime-local
    eventType: "RPMSpike",
    sensorValueNumber: 0,
    sensorUnit: "RPM",
    severity: "High",
    component: "Engine",
    recommendedAction: "Log incident for analysis. Could indicate aggressive driving or transmission slippage.",
    status: "New"
  };

  res.render("telemetry", { latestAsset, model });
});


app.post("/send-telemetry-to-crm", async (req, res) => {
  try {
    // Payload from UI
    const {
      vehicleSerialNumber,
      eventTimestamp,
      eventType,
      sensorValueNumber,
      sensorUnit,
      severity,
      component,
      recommendedAction,
      status
    } = req.body;

    const finalSerial = vehicleSerialNumber || latestAsset?.serialNumber;
    if (!finalSerial) {
      return res.status(400).json({ message: "No vehicleSerialNumber available. Receive asset first." });
    }

    // Compose sensorValue text like "35 °C" or "0 RPM"
    const sensorText = `${sensorValueNumber ?? 0} ${sensorUnit || ""}`.trim();

    // Salesforce token using your existing password flow
    const auth = await getSalesforceToken();

    // Call Salesforce Apex REST endpoint created above
    const endpoint = `${auth.instance_url}/services/apexrest/telematics/v1/events`;

    const sfPayload = {
      vehicleSerialNumber: finalSerial,
      eventTimestamp: eventTimestamp ? new Date(eventTimestamp).toISOString() : new Date().toISOString(),
      eventType,
      sensorValue: sensorText,
      severity,
      component,
      recommendedAction,
      status
    };

    console.log("➡️ Sending telemetry to Salesforce:", JSON.stringify(sfPayload, null, 2));

    const sfResp = await axios.post(endpoint, sfPayload, {
      headers: {
        Authorization: `Bearer ${auth.access_token}`,
        "Content-Type": "application/json"
      },
      timeout: 20000
    });

    return res.status(200).json(sfResp.data);

  } catch (err) {
    console.error("❌ Error in /send-telemetry-to-crm:", err.message);
    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
});




app.get("/delivery-duration", (req,res)=>{
 res.render("deliveryDuration", {deliveryVehicles});
});
app.listen(PORT, () => console.log(` Server running on http://localhost:${PORT}`));
