import express from "express";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();
const app = express();
const port = process.env.PORT || 5000;

app.get("/contacts", async (req, res) => {
  try {
    const response = await axios.get(
      "https://services.leadconnectorhq.com/contacts/",
      {
        headers: {
          Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
          Version: "2021-07-28",
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).send("Error fetching contacts");
  }
});

app.listen(port, () =>
  console.log(`🚀 Server running at http://localhost:${port}`)
);
