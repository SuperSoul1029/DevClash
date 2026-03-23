const fs = require("fs/promises");
const path = require("path");
const env = require("../src/config/env");
const { connectDb, disconnectDb } = require("../src/config/db");
const { upsertKnowledgeFromText } = require("../src/services/ragService");

async function readPdfText(filePath) {
  let PDFParse;
  try {
    ({ PDFParse } = require("pdf-parse"));
  } catch {
    return null;
  }

  const buffer = await fs.readFile(filePath);
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    return result?.text || "";
  } finally {
    await parser.destroy();
  }
}

async function readDocument(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".txt" || ext === ".md") {
    return fs.readFile(filePath, "utf8");
  }

  if (ext === ".json") {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (typeof parsed === "string") {
      return parsed;
    }

    if (Array.isArray(parsed)) {
      return parsed.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).join("\n\n");
    }

    return JSON.stringify(parsed);
  }

  if (ext === ".pdf") {
    const pdfText = await readPdfText(filePath);
    return pdfText;
  }

  return null;
}

function parseMetaFromName(filePath) {
  const fileName = path.basename(filePath, path.extname(filePath));
  const parts = fileName.split("_").map((part) => part.trim());
  const normalizedFileName = fileName.toLowerCase();

  let classLevel = "";
  let subject = "";

  if (parts[0] && ["11", "12"].includes(parts[0])) {
    classLevel = parts[0];
  }

  if (!classLevel) {
    if (/\b11(th)?\b/.test(normalizedFileName) || /\bclass\s*11\b/.test(normalizedFileName)) {
      classLevel = "11";
    } else if (/\b12(th)?\b/.test(normalizedFileName) || /\bclass\s*12\b/.test(normalizedFileName)) {
      classLevel = "12";
    }
  }

  if (parts[1]) {
    subject = parts[1].replace(/-/g, " ");
  }

  if (!subject) {
    if (/\bphy(sics)?\b/.test(normalizedFileName)) {
      subject = "Physics";
    } else if (/\bchem(istry)?\b/.test(normalizedFileName)) {
      subject = "Chemistry";
    } else if (/\bmath(s|ematics)?\b/.test(normalizedFileName)) {
      subject = "Mathematics";
    } else if (/\bbio(logy)?\b/.test(normalizedFileName)) {
      subject = "Biology";
    }
  }

  return {
    classLevel,
    subject,
    sourceLabel: fileName.replace(/[-_]/g, " ")
  };
}

async function collectFiles(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    const absolutePath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const nested = await collectFiles(absolutePath);
      results.push(...nested);
      continue;
    }

    results.push(absolutePath);
  }

  return results;
}

async function run() {
  const sourceDirArg = process.argv[2] || path.resolve(process.cwd(), "knowledge");
  const ingestBatch = new Date().toISOString();

  try {
    await connectDb(env.mongoUri);

    const sourceDirExists = await fs
      .access(sourceDirArg)
      .then(() => true)
      .catch(() => false);

    if (!sourceDirExists) {
      console.log(`Knowledge directory not found: ${sourceDirArg}`);
      console.log("Create the folder and add .txt/.md/.json (and optional .pdf) files, then rerun.");
      process.exit(0);
    }

    const files = await collectFiles(sourceDirArg);
    let processed = 0;
    let inserted = 0;

    for (const filePath of files) {
      const text = await readDocument(filePath);
      if (!text || !String(text).trim()) {
        continue;
      }

      const meta = parseMetaFromName(filePath);
      const result = await upsertKnowledgeFromText({
        text,
        sourceType: path.extname(filePath).toLowerCase() === ".pdf" ? "pdf" : "text",
        sourceId: path.relative(sourceDirArg, filePath).replace(/\\/g, "/"),
        sourceLabel: meta.sourceLabel,
        sourceUrl: "",
        classLevel: meta.classLevel,
        subject: meta.subject,
        tags: ["ingested"],
        ingestBatch
      });

      processed += 1;
      inserted += result.inserted;
      console.log(`Ingested ${filePath} -> ${result.inserted} chunks`);
    }

    console.log(`Knowledge ingest complete. Files processed: ${processed}, chunks upserted: ${inserted}`);
    process.exit(0);
  } catch (error) {
    console.error("Knowledge ingest failed", error);
    process.exit(1);
  } finally {
    await disconnectDb();
  }
}

run();
