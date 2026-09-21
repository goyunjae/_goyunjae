const fileInput = document.getElementById("fileInput");
const convertBtn = document.getElementById("convertBtn");
const fileInfo = document.getElementById("fileInfo");
const statusEl = document.getElementById("status");
const dropzone = document.getElementById("dropzone");

let selectedFile = null;

const REQUIRED_COLUMNS = [
  "순번", "자산번호", "자산명", "규격명", "운용상태", "분류번호", "분류명",
  "식별번호", "품목명", "운영조직", "운영부서", "사용위치", "물품용도",
  "취득일자", "취득수량", "취득단가", "내용년수", "지출결의서 건명",
  "발의자", "발의부서"
];

const OUTPUT_COLUMNS = [
  "순번", "자산번호", "자산명", "운용상태", "분류명", "식별번호", "품목명",
  "운영부서", "사용위치", "취득일자", "내용년수", "불용가능기간",
  "취득수량", "취득단가", "발의자", "발의부서", "지출결의서 건명"
];

function setStatus(message, type = "") {
  statusEl.textContent = message;
  statusEl.className = "status" + (type ? " " + type : "");
}

function pickFile(file) {
  if (!file) return;
  const ext = file.name.split(".").pop().toLowerCase();
  if (!["xls", "xlsx"].includes(ext)) {
    selectedFile = null;
    convertBtn.disabled = true;
    fileInfo.classList.add("hidden");
    setStatus("지원하지 않는 파일입니다. .xls 또는 .xlsx 파일을 선택하세요.", "error");
    return;
  }
  selectedFile = file;
  convertBtn.disabled = false;
  fileInfo.textContent = `${file.name} · ${(file.size / 1024).toFixed(1)} KB`;
  fileInfo.classList.remove("hidden");
  setStatus("");
}

fileInput.addEventListener("change", e => pickFile(e.target.files[0]));

["dragenter", "dragover"].forEach(type => {
  dropzone.addEventListener(type, e => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  });
});
["dragleave", "drop"].forEach(type => {
  dropzone.addEventListener(type, e => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
  });
});
dropzone.addEventListener("drop", e => pickFile(e.dataTransfer.files[0]));

function normalizeText(value) {
  return String(value ?? "").trim();
}

function parseYears(value) {
  const n = Number(normalizeText(value).replace(/,/g, ""));
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function parseDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const s = normalizeText(value);
  if (!s) return null;

  const compact = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) return new Date(Number(compact[1]), Number(compact[2]) - 1, Number(compact[3]));

  const m = s.match(/^(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatDate(date) {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addYears(date, years) {
  const d = new Date(date.getFullYear() + years, date.getMonth(), date.getDate());
  if (d.getMonth() !== date.getMonth()) {
    return new Date(date.getFullYear() + years, date.getMonth() + 1, 0);
  }
  return d;
}

function todayFileName() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `4단계 두뇌한국(BK)21 물품 현황_${yy}.${mm}.${dd}.xlsx`;
}

async function convertExcel(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error("시트를 찾을 수 없습니다.");

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });

  if (!rows.length) throw new Error("데이터가 없습니다.");

  const headers = Object.keys(rows[0]).map(normalizeText);
  const missing = REQUIRED_COLUMNS.filter(col => !headers.includes(col));
  if (missing.length) {
    throw new Error("필수 열이 없습니다: " + missing.join(", "));
  }

  const cutoff = new Date(2020, 8, 1);
  const output = [];

  for (const row of rows) {
    const acquired = parseDate(row["취득일자"]);
    if (!acquired || acquired < cutoff) continue;

    const years = parseYears(row["내용년수"]);
    const disposal = addYears(acquired, years);

    output.push({
      "순번": row["순번"],
      "자산번호": row["자산번호"],
      "자산명": row["자산명"],
      "운용상태": row["운용상태"],
      "분류명": row["분류명"],
      "식별번호": row["식별번호"],
      "품목명": row["품목명"],
      "운영부서": row["운영부서"],
      "사용위치": row["사용위치"],
      "취득일자": formatDate(acquired),
      "내용년수": years,
      "불용가능기간": formatDate(disposal),
      "취득수량": row["취득수량"],
      "취득단가": row["취득단가"],
      "발의자": row["발의자"],
      "발의부서": row["발의부서"],
      "지출결의서 건명": row["지출결의서 건명"]
    });
  }

  const outSheet = XLSX.utils.json_to_sheet(output, { header: OUTPUT_COLUMNS });
  outSheet["!cols"] = OUTPUT_COLUMNS.map(col => {
    let max = col.length;
    for (const row of output) max = Math.max(max, normalizeText(row[col]).length);
    return { wch: Math.max(8, Math.min(max + 2, 50)) };
  });

  const outBook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(outBook, outSheet, "Sheet1");
  XLSX.writeFile(outBook, todayFileName());

  return output.length;
}

convertBtn.addEventListener("click", async () => {
  if (!selectedFile) return;
  convertBtn.disabled = true;
  setStatus("파일을 변환하고 있습니다.");

  try {
    const count = await convertExcel(selectedFile);
    setStatus(`완료: ${count.toLocaleString()}건을 변환했습니다. 다운로드가 시작되었습니다.`, "ok");
  } catch (error) {
    console.error(error);
    setStatus("변환 실패: " + (error?.message || "알 수 없는 오류"), "error");
  } finally {
    convertBtn.disabled = false;
  }
});
