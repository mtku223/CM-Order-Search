import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getProductImages } from "../src/lib/productImages.mjs";

describe("product image helpers", () => {
  it("prefers attachment image URLs over view thumbnails", () => {
    const images = getProductImages({
      product_name: "Custom Hat",
      attachment_urls: [
        {
          image_url:
            "https://www.crookedmonkey.com/configured_product_attachment/s/image/hat.png",
          name: "Hat mockup",
        },
      ],
      views: [
        {
          view_name: "Hat Front",
          thumbnail: "/configured_product_view/e/image/large_thumb.png?1",
        },
      ],
    });

    assert.deepEqual(images, [
      {
        url: "https://www.crookedmonkey.com/configured_product_attachment/s/image/hat.png",
        label: "Hat mockup",
        source: "attachment",
      },
    ]);
  });

  it("uses view thumbnails when attachments are not available", () => {
    const images = getProductImages({
      product_name: "Brushed Twill Cap",
      views: [
        {
          view_name: "Hat (Front)",
          thumbnail: "/configured_product_view/e/image/a/large_thumb.png?177",
        },
      ],
    });

    assert.deepEqual(images, [
      {
        url: "https://www.crookedmonkey.com/configured_product_view/e/image/a/large_thumb.png?177",
        label: "Hat (Front)",
        source: "thumbnail",
      },
    ]);
  });

  it("returns an empty list when no usable image data exists", () => {
    assert.deepEqual(getProductImages({ product_name: "Fee", views: [] }), []);
  });
});
