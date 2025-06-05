import fetch from "node-fetch";
import { PDFDocument } from "pdf-lib";
import { Buffer } from "buffer";

export async function handler(event) {
  // Enable CORS
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  // Handle preflight requests
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { pdfUrl, pages, filename } = JSON.parse(event.body);

    if (!pdfUrl || !pages || !Array.isArray(pages)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error:
            "Missing required parameters: pdfUrl, pages (array of page numbers)",
        }),
      };
    }

    // Download the original PDF
    console.log("Downloading PDF from:", pdfUrl);
    const response = await fetch(pdfUrl);

    if (!response.ok) {
      throw new Error(
        `Failed to download PDF: ${response.status} ${response.statusText}`
      );
    }

    const pdfBuffer = await response.arrayBuffer();

    // Load the PDF document
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const totalPages = pdfDoc.getPageCount();

    // Validate page numbers
    const validPages = pages.filter(
      (pageNum) => pageNum >= 1 && pageNum <= totalPages
    );

    if (validPages.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: `No valid pages found. PDF has ${totalPages} pages. Requested: ${pages.join(
            ", "
          )}`,
        }),
      };
    }

    // Create a new PDF document
    const newPdfDoc = await PDFDocument.create();

    // Copy the specified pages to the new document
    for (const pageNum of validPages.sort((a, b) => a - b)) {
      const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [pageNum - 1]);
      newPdfDoc.addPage(copiedPage);
    }

    // Serialize the new PDF
    const newPdfBytes = await newPdfDoc.save();

    // Return the PDF as base64
    const base64Pdf = Buffer.from(newPdfBytes).toString("base64");

    return {
      statusCode: 200,
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: true,
        filename: filename || `extracted_pages_${validPages.join("-")}.pdf`,
        pdfData: base64Pdf,
        extractedPages: validPages,
        totalPages: totalPages,
      }),
    };
  } catch (error) {
    console.error("Error processing PDF:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Failed to process PDF",
        details: error.message,
      }),
    };
  }
}
