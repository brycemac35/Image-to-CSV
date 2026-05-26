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
  linkBtn.title = isLinked ? "Aspect ratio locked" : "Aspect ratio unlocked";
}
setLinkUI();

function syncFromWidth() {
  if (suppressSync || !aspect) return;
  const w = Math.max(1, parseInt(wInput.value || "1", 10));
  suppressSync = true;
  hInput.value = String(Math.max(1, Math.round(w * aspect)));
  suppressSync = false;
}

function syncFromHeight() {
  if (suppressSync || !aspect) return;
  const h = Math.max(1, parseInt(hInput.value || "1", 10));
  suppressSync = true;
  wInput.value = String(Math.max(1, Math.round(h / aspect)));
  suppressSync = false;
}

linkBtn.addEventListener("click", () => {
  isLinked = !isLinked;
  setLinkUI();
  if (isLinked && aspect) {
    if (lastEdited === "h") syncFromHeight();
    else syncFromWidth();
  }
});

wInput.addEventListener("input", () => {
  if (suppressSync) return;
  lastEdited = "w";
  if (isLinked && aspect) syncFromWidth();
});

hInput.addEventListener("input", () => {
  if (suppressSync) return;
  lastEdited = "h";
  if (isLinked && aspect) syncFromHeight();
});

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  btn.disabled = !file;

  if (!file) {
    statusEl.textContent = "";
    return;
  }

  statusEl.textContent = "Reading image...";
  try {
    const img = await fileToImage(file);
    aspect = img.height / img.width;
    statusEl.textContent = "Image loaded. Ready to convert.";
  } catch (e) {
    statusEl.textContent = "Error loading image.";
    console.error(e);
  }
});

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

  statusEl.textContent = `Converting… (${outW} × ${outH})`;
  progressContainer.style.display = "block";
  progressBar.value = 0;
  progressText.textContent = "Converting... 0%";

  const imageData = ctx.getImageData(0, 0, outW, outH);
  btn.disabled = true;
  const csv = await imageDataToGrayCsv(imageData, outW, outH);
  btn.disabled = false;

  const outName = (file.name.replace(/\.[^.]+$/, "") || "image") + `_${outW}x${outH}.csv`;
  downloadText(csv, outName);

  progressContainer.style.display = "none";
  statusEl.textContent = `✅ Done! Downloaded ${outName}`;
});

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

async function imageDataToGrayCsv(imageData, width, height) {
  const { data } = imageData;
  const lines = [];
  const CHUNK = 50; // rows per chunk before yielding to the browser

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

    if (y % CHUNK === 0 || y === height - 1) {
      const progress = Math.round(((y + 1) / height) * 100);
      progressBar.value = progress;
      progressText.textContent = `Converting... ${progress}%`;
      await new Promise(r => setTimeout(r, 0)); // yield to browser so it can repaint
    }
  }
  return lines.join("\n");
}

function downloadText(text, filename) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
