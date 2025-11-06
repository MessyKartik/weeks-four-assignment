import express from "express";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

// Step 1: Redirect user to GHL OAuth URL
app.get("/auth/ghl", (req, res) => {
  const scopes = [
    "contacts.readonly",
    "contacts.write",
    "opportunities.readonly",
    "opportunities.write",
    "calendars.readonly",
    "calendars.write",
    "locations.readonly",
    "oauth.write",
    "oauth.readonly",
  ].join(" ");

  const authUrl = `https://marketplace.leadconnectorhq.com/oauth/chooselocation?response_type=code&client_id=${
    process.env.CLIENT_ID
  }&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(
    process.env.REDIRECT_URI
  )}`;

  res.redirect(authUrl);
});

// Step 2: Handle OAuth callback
app.get("/oauth/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).send("No authorization code provided");
  }

  try {
    // ✅ Fix: Send form data as x-www-form-urlencoded
    const params = new URLSearchParams();
    params.append("client_id", process.env.CLIENT_ID);
    params.append("client_secret", process.env.CLIENT_SECRET);
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("redirect_uri", process.env.REDIRECT_URI);

    const tokenResponse = await axios.post(
      "https://services.leadconnectorhq.com/oauth/token",
      params,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const data = tokenResponse.data;
    console.log(data.access_token);

    res.send(`
      <h2>✅ GHL OAuth Successful!</h2>
      <p><strong>Access Token:</strong></p>
      <code>${data.access_token}</code>
      <p><strong>Refresh Token:</strong></p>
      <code>${data.refresh_token}</code>
    `);
  } catch (err) {
    console.error(
      "❌ Error exchanging code for token",
      err.response?.data || err.message
    );
    res.status(500).send("Error exchanging code for token");
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
