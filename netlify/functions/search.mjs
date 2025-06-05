import fetch from "node-fetch";
import process from "process";

const sendGAEvent = async (searchTerm, username) => {
  const gaMeasurementId = process.env.GA_MEASUREMENT_ID;
  const gaApiSecret = process.env.GA_API_SECRET;
  const requestBody = {
    client_id: username || "anonymous_user",
    events: [
      {
        name: "search",
        params: {
          search_term: searchTerm,
        },
      },
    ],
  };

  await fetch(
    `https://www.google-analytics.com/mp/collect?measurement_id=${gaMeasurementId}&api_secret=${gaApiSecret}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    }
  );
};

export async function handler(event) {
  const { searchTerm, username } = event.queryStringParameters;
  const apiUrl = `https://www.crookedmonkey.com/api/json/manage_orders/find?conditions[1][field]=3&conditions[1][condition]=1&conditions[1][string]=${encodeURIComponent(
    searchTerm
  )}&limit=100&offset=0&sortby=1&include_workflow_data=1&include_po_data=1&include_shipments=1&include_production_file_info=1&username=${
    process.env.API_USERNAME
  }&password=${process.env.API_PASSWORD}`;

  try {
    const response = await fetch(apiUrl);
    const data = await response.json();

    await sendGAEvent(searchTerm, username); // Replace 'username_from_context' with actual username if available

    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error("Error fetching data:", error);
    return {
      statusCode: 500,
      body: "Server error",
    };
  }
}
