const fileInput = document.getElementById("file");
const btn = document.getElementById("go");
const statusEl = document.getElementById("status");
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d", { willReadFrequently: true });

const wInput = document.getElementById("w");
const hInput = document.getElementById("h");
const linkBtn = document.getElementById("link");

const progressContainer = document.getElementById("progress-container");
const progressBar = document.getElementById("progress");
const progressText = document.getElementById("progress-text");

let isLinked = true;
let aspect = null;
let suppressSync = false;
let lastEdited = "w";

function setLinkUI() {
  linkBtn.setAttribute("aria-pressed", String(isLinked));
  linkBtn.textContent = isLinked ? "🔗" : "⛓️";
}
setLinkUI();

// ... (keep all your existing sync functions: syncFromWidth, syncFromHeight, etc.)

// Keep your existing fileInput and linkBtn listeners unchanged...

btn.addEventListener("click", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;

  statusEl.textContent = "Loading image…";
  progressContainer.style.display = "none";

  const img = await fileToImage(file);
  if (!aspect) aspect = img.height / img.width;

  let outW = Math.max(1, parseInt(wInput.value || "64", 10));
  let outH = Math.max(1, parseInt(hInput.value || "64", 10));

  if (isLinked && aspect) {
    if (lastEdited === "h") {
      outW = Math.max(1, Math.round(outH / aspect));
      wInput.value = outW;
    } else {
      outH = Math.max(1, Math.round(outW * aspect));
      hInput.value = outH;
    }
  }

  canvas.width = outW;
  canvas.height = outH;
  ctx.clearRect(0, 0, outW, outH);
  ctx.drawImage(img, 0, 0, outW, outH);

  statusEl.textContent = `Converting… (${outW}×${outH})`;
  progressContainer.style.display = "block";
  progressBar.value = 0;

  const imageData = ctx.getImageData(0, 0, outW, outH);
  const csv = imageDataToGrayCsv(imageData, outW, outH);   // ← updated with progress

  const outName = (file.name.replace(/\.[^.]+$/, "") || "image") + `_${outW}x${outH}.csv`;

  downloadText(csv, outName);
  
  progressContainer.style.display = "none";
  statusEl.textContent = `Done! Downloaded: ${outName}`;
});

function imageDataToGrayCsv(imageData, width, height) {
  const { data } = imageData;
  const lines = [];
  const totalPixels = width * height;

  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const gray = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
      row.push(String(gray));
    }
    lines.push(row.join(","));

    // Update progress every row
    if (y % 8 === 0 || y === height - 1) {
      const progress = Math.round(((y + 1) / height) * 100);
      progressBar.value = progress;
      progressText.textContent = `Converting... ${progress}%`;
    }
  }
  return lines.join("\n");
}

// Keep your existing fileToImage() and downloadText() functions
