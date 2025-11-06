import express from "express";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// In-memory storage (replace with database in production)
const tokenStore = new Map();

// Home route
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>GHL OAuth Integration</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
          button { background: #4CAF50; color: white; padding: 15px 30px; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; }
          button:hover { background: #45a049; }
        </style>
      </head>
      <body>
        <h1>🚀 GHL OAuth Integration</h1>
        <p>Click the button below to authorize with GoHighLevel</p>
        <a href="/auth/ghl"><button>Connect to GHL</button></a>
      </body>
    </html>
  `);
});

// Step 1: Redirect user to GHL authorization page
app.get("/auth/ghl", (req, res) => {
  // Validate environment variables
  if (!process.env.CLIENT_ID || !process.env.REDIRECT_URI) {
    return res
      .status(500)
      .send("Missing CLIENT_ID or REDIRECT_URI in environment variables");
  }

  // Define scopes based on what your app needs
  const scopes = [
    "contacts.readonly",
    "contacts.write",
    "opportunities.readonly",
    "opportunities.write",
    "calendars.readonly",
    "calendars.write",
    "locations.readonly",
  ].join(" ");

  const authUrl = `https://marketplace.gohighlevel.com/oauth/chooselocation?response_type=code&redirect_uri=${encodeURIComponent(
    process.env.REDIRECT_URI
  )}&client_id=${process.env.CLIENT_ID}&scope=${encodeURIComponent(scopes)}`;

  console.log("🔐 Redirecting to GHL authorization page...");
  res.redirect(authUrl);
});

// Step 2: Handle OAuth callback
app.get("/oauth/callback", async (req, res) => {
  const { code } = req.query;

  if (!code) {
    console.error("❌ No authorization code received");
    return res.status(400).send(`
      <h2>❌ Authorization Failed</h2>
      <p>No authorization code was provided.</p>
      <a href="/">Go back</a>
    `);
  }

  try {
    console.log("🔄 Exchanging authorization code for access token...");

    // Exchange authorization code for access token
    const tokenResponse = await axios.post(
      "https://services.leadconnectorhq.com/oauth/token",
      {
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.REDIRECT_URI,
        user_type: "Company", // or "Location" depending on your use case
      },
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const {
      access_token,
      refresh_token,
      token_type,
      expires_in,
      scope,
      userType,
      locationId,
      companyId,
      userId,
    } = tokenResponse.data;

    // Store tokens (use a database in production)
    const tokenData = {
      accessToken: access_token,
      refreshToken: refresh_token,
      tokenType: token_type,
      expiresIn: expires_in,
      expiresAt: Date.now() + expires_in * 1000,
      scope,
      userType,
      locationId,
      companyId,
      userId,
      createdAt: new Date().toISOString(),
    };

    tokenStore.set(userId || "default", tokenData);

    console.log("✅ OAuth successful!");
    console.log("📍 Location ID:", locationId);
    console.log("🏢 Company ID:", companyId);
    console.log("👤 User ID:", userId);

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>OAuth Success</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
            .success { background: #d4edda; border: 1px solid #c3e6cb; padding: 20px; border-radius: 5px; }
            .token-box { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0; overflow-x: auto; }
            code { color: #e83e8c; }
            .info { margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="success">
            <h2>✅ GHL OAuth Successful!</h2>
            <div class="info"><strong>User Type:</strong> ${userType}</div>
            <div class="info"><strong>Location ID:</strong> ${
              locationId || "N/A"
            }</div>
            <div class="info"><strong>Company ID:</strong> ${
              companyId || "N/A"
            }</div>
            <div class="info"><strong>User ID:</strong> ${userId || "N/A"}</div>
            <div class="info"><strong>Expires In:</strong> ${expires_in} seconds</div>
            
            <h3>Access Token:</h3>
            <div class="token-box">
              <code>${access_token}</code>
            </div>
            
            <h3>Refresh Token:</h3>
            <div class="token-box">
              <code>${refresh_token}</code>
            </div>
            
            <p><strong>⚠️ Important:</strong> Store these tokens securely. In production, save them to a database.</p>
            <a href="/"><button style="background: #4CAF50; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer;">Back to Home</button></a>
          </div>
        </body>
      </html>
    `);
  } catch (err) {
    console.error("❌ Error exchanging code for token:");
    console.error(err.response?.data || err.message);

    res.status(500).send(`
      <h2>❌ Error</h2>
      <p>Failed to exchange authorization code for access token.</p>
      <pre>${JSON.stringify(err.response?.data || err.message, null, 2)}</pre>
      <a href="/">Try again</a>
    `);
  }
});

// Step 3: Refresh access token
app.post("/oauth/refresh", async (req, res) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json({ error: "refresh_token is required" });
  }

  try {
    console.log("🔄 Refreshing access token...");

    const tokenResponse = await axios.post(
      "https://services.leadconnectorhq.com/oauth/token",
      {
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token,
      },
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    console.log("✅ Token refreshed successfully!");
    res.json(tokenResponse.data);
  } catch (err) {
    console.error("❌ Error refreshing token:");
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

// Example: Get contacts using access token
app.get("/api/contacts", async (req, res) => {
  const userId = req.query.user_id || "default";
  const tokenData = tokenStore.get(userId);

  if (!tokenData) {
    return res.status(401).json({
      error: "No token found. Please complete OAuth flow first.",
      hint: "Visit /auth/ghl to authorize",
    });
  }

  // Check if token is expired
  if (Date.now() >= tokenData.expiresAt) {
    return res.status(401).json({
      error: "Token expired. Please refresh using /oauth/refresh endpoint",
      refresh_token: tokenData.refreshToken,
    });
  }

  try {
    console.log("📞 Fetching contacts...");
    console.log("📍 Using Location ID:", tokenData.locationId);

    // GHL API v2 - Note: locationId goes in query params, not headers
    const response = await axios.get(
      "https://services.leadconnectorhq.com/contacts/",
      {
        headers: {
          Authorization: `Bearer ${tokenData.accessToken}`,
          Version: "2021-07-28",
          Accept: "application/json",
        },
        params: {
          locationId: tokenData.locationId,
          limit: 100, // Optional: limit results
        },
      }
    );

    console.log("✅ Contacts fetched successfully!");
    res.json(response.data);
  } catch (err) {
    console.error("❌ Error fetching contacts:");
    console.error("Status:", err.response?.status);
    console.error("Data:", err.response?.data);
    console.error("Headers sent:", {
      Authorization: `Bearer ${tokenData.accessToken.substring(0, 20)}...`,
      Version: "2021-07-28",
    });

    res.status(err.response?.status || 500).json({
      error: err.response?.data || err.message,
      locationId: tokenData.locationId,
      status: err.response?.status,
      hint:
        err.response?.status === 403
          ? "Token doesn't have access to this location. Try re-authorizing."
          : "API request failed",
    });
  }
});

// Create a contact (example POST request)
app.post("/api/contacts", async (req, res) => {
  const userId = req.query.user_id || "default";
  const tokenData = tokenStore.get(userId);

  if (!tokenData) {
    return res.status(401).json({ error: "No token found" });
  }

  try {
    const contactData = {
      firstName: req.body.firstName || "Test",
      lastName: req.body.lastName || "Contact",
      email: req.body.email || "test@example.com",
      locationId: tokenData.locationId,
    };

    console.log("➕ Creating contact:", contactData);

    const response = await axios.post(
      "https://services.leadconnectorhq.com/contacts/",
      contactData,
      {
        headers: {
          Authorization: `Bearer ${tokenData.accessToken}`,
          Version: "2021-07-28",
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Contact created successfully!");
    res.json(response.data);
  } catch (err) {
    console.error(
      "❌ Error creating contact:",
      err.response?.data || err.message
    );
    res.status(err.response?.status || 500).json({
      error: err.response?.data || err.message,
    });
  }
});
// Test endpoint - get location info
app.get("/api/location", async (req, res) => {
  const userId = req.query.user_id || "default";
  const tokenData = tokenStore.get(userId);

  if (!tokenData) {
    return res.status(401).json({ error: "No token found" });
  }

  try {
    const response = await axios.get(
      `https://services.leadconnectorhq.com/locations/${tokenData.locationId}`,
      {
        headers: {
          Authorization: `Bearer ${tokenData.accessToken}`,
          Version: "2021-07-28",
        },
      }
    );

    res.json(response.data);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(err.response?.status || 500).json({
      error: err.response?.data || err.message,
    });
  }
});
// Get stored token info
app.get("/api/token-info", (req, res) => {
  const userId = req.query.user_id || "default";
  const tokenData = tokenStore.get(userId);

  if (!tokenData) {
    return res.status(404).json({ error: "No token found" });
  }

  res.json({
    locationId: tokenData.locationId,
    companyId: tokenData.companyId,
    userId: tokenData.userId,
    userType: tokenData.userType,
    expiresAt: new Date(tokenData.expiresAt).toISOString(),
    isExpired: Date.now() >= tokenData.expiresAt,
    scopes: tokenData.scope,
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("💥 Unhandled error:", err);
  res.status(500).send("Internal Server Error");
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
  console.log(`📋 Environment check:`);
  console.log(`   CLIENT_ID: ${process.env.CLIENT_ID ? "✓ Set" : "✗ Missing"}`);
  console.log(
    `   CLIENT_SECRET: ${process.env.CLIENT_SECRET ? "✓ Set" : "✗ Missing"}`
  );
  console.log(`   REDIRECT_URI: ${process.env.REDIRECT_URI || "✗ Missing"}`);
  console.log(`\n🔗 Visit http://localhost:${port} to start OAuth flow`);
});
