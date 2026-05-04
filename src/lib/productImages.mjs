const DECO_BASE_URL = "https://www.crookedmonkey.com";

function toAbsoluteDecoUrl(url) {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return `${DECO_BASE_URL}${url}`;
  return `${DECO_BASE_URL}/${url}`;
}

export function getProductImages(lineItem) {
  const attachmentImages = (lineItem?.attachment_urls || [])
    .map((attachment) => ({
      url: toAbsoluteDecoUrl(attachment.image_url),
      label: attachment.name || lineItem.product_name || "Product image",
      source: "attachment",
    }))
    .filter((image) => Boolean(image.url));

  if (attachmentImages.length > 0) {
    return attachmentImages;
  }

  return (lineItem?.views || [])
    .map((view) => ({
      url: toAbsoluteDecoUrl(view.thumbnail),
      label: view.view_name || lineItem.product_name || "Product thumbnail",
      source: "thumbnail",
    }))
    .filter((image) => Boolean(image.url));
}
