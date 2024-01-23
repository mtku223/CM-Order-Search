import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

app.get("/api/search", async (req, res) => {
  const { searchTerm } = req.query;
  const apiUrl = `https://www.crookedmonkey.com/api/json/manage_orders/find?conditions[1][field]=3&conditions[1][condition]=1&conditions[1][string]=${encodeURIComponent(
    searchTerm
  )}&limit=100&offset=0&sortby=1&include_workflow_data=1&include_po_data=1&include_shipments=1&include_production_file_info=1&username=${
    process.env.API_USERNAME
  }&password=${process.env.API_PASSWORD}`;

  try {
    const response = await fetch(apiUrl);
    const data = await response.json();
    console.log("Data received from API:", data);

    res.json(data);
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).send("Server error");
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
