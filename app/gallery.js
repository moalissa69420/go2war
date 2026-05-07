// Very small gallery switcher for the client board.
// Swaps the media source and updates GTW_ASSET_ID so annotations load per asset.

(function () {
  const grid = document.getElementById("assetGrid");
  const media = document.getElementById("media");
  if (!grid || !media) return;

  grid.querySelectorAll("a[data-asset]").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const asset = a.getAttribute("data-asset");
      const src = a.getAttribute("data-src");
      const type = a.getAttribute("data-type") || "image";
      if (!asset || !src) return;

      // MVP supports images only (videos can be added next).
      if (type !== "image") {
        alert("Video support is next (MVP is images).");
        return;
      }

      window.GTW_ASSET_ID = asset;
      media.setAttribute("src", src);

      // Re-init annotate script by forcing a reload (simple MVP).
      // This keeps the code small and predictable.
      window.location.hash = asset;
      window.location.reload();
    });
  });
})();

