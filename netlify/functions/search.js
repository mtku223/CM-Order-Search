exports.handler = async (event) => {
  const { searchTerm } = event.queryStringParameters;
  const fetch = (await import("node-fetch")).default;

  const apiUrl = `https://www.crookedmonkey.com/api/json/manage_orders/find?conditions[1][field]=3&conditions[1][condition]=1&conditions[1][string]=${encodeURIComponent(
    searchTerm
  )}&limit=100&offset=0&sortby=1&include_workflow_data=1&include_po_data=1&include_shipments=1&include_production_file_info=1&username=${
    process.env.API_USERNAME
  }&password=${process.env.API_PASSWORD}`;

  try {
    const response = await fetch(apiUrl);
    const data = await response.json();
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
};
