import { useRef, useState } from "react";
import { Upload, Download, HelpCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { SheetTemplateDialog } from "./SheetTemplateDialog";
import type { Pauta, CreatePautaInput } from "@/hooks/usePautas";
import { normalizePautaMarca, normalizePautaStatus } from "@/lib/agenda-editorial";

interface ImportExportButtonsProps {
  pautas: Pauta[];
  onImport: (rows: CreatePautaInput[]) => Promise<unknown>;
}

interface SheetJsModule {
  read: (
    data: ArrayBuffer | string,
    options?: Record<string, unknown>,
  ) => {
    SheetNames: string[];
    Sheets: Record<string, unknown>;
  };
  utils: {
    sheet_to_json: <T>(sheet: unknown, options?: Record<string, unknown>) => T[];
  };
}

const SUPPORTED_IMPORT_EXTENSIONS = new Set(["csv", "xls", "xlsx"]);
let sheetJsPromise: Promise<SheetJsModule> | null = null;

function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

const PT_MONTHS: Record<string, number> = {
  jan: 1,
  fev: 2,
  mar: 3,
  abr: 4,
  mai: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  set: 9,
  out: 10,
  nov: 11,
  dez: 12,
};

function monthFromPtName(name: string): number | null {
  const key = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .slice(0, 3);
  return PT_MONTHS[key] ?? null;
}

// Editorial agendas point to the present/future, so when a textual date omits
// the year, assume the current one and roll forward if the month already passed.
function inferYearForMonth(month: number): number {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;
  return month < currentMonth - 1 ? currentYear + 1 : currentYear;
}

function buildIsoDate(year: number, month: number, day: number): string | undefined {
  if (day < 1 || day > 31 || month < 1 || month > 12) return undefined;
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function normalizeDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  const isoFormatMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoFormatMatch) return trimmed;

  const brFormatMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brFormatMatch) {
    const [, dd, mm, yyyy] = brFormatMatch;
    return `${yyyy}-${mm}-${dd}`;
  }

  const usFormatMatch = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (usFormatMatch) {
    const [, mm, dd, yyyy] = usFormatMatch;
    return `${yyyy}-${mm}-${dd}`;
  }

  // Portuguese textual dates, e.g. "01 de jul.", "20. de jul", "05. de ago.",
  // "10 de julho de 2026". Day and month abbreviations may carry stray periods.
  const ptFormatMatch = trimmed.match(
    /^(\d{1,2})\.?\s*de\s+(\p{L}+)\.?(?:\s+de\s+(\d{4}))?$/iu,
  );
  if (ptFormatMatch) {
    const [, dd, monthName, yyyy] = ptFormatMatch;
    const month = monthFromPtName(monthName);
    if (month) {
      const day = Number(dd);
      const year = yyyy ? Number(yyyy) : inferYearForMonth(month);
      const iso = buildIsoDate(year, month, day);
      if (iso) return iso;
    }
  }

  if (/^\d{5}$/.test(trimmed)) {
    const serial = Number(trimmed);
    if (serial > 20000 && serial < 60000) {
      const date = new Date(Date.UTC(1899, 11, 30));
      date.setUTCDate(date.getUTCDate() + serial);
      return date.toISOString().slice(0, 10);
    }
  }

  // Anything we cannot confidently turn into an ISO date is dropped instead of
  // being forwarded to the Postgres `date` column, which would reject the whole
  // batch import. The row is still imported, just without a planned date.
  return undefined;
}

function normalizePlataforma(value: string | undefined): string | undefined {
  if (!value) return undefined;

  const tokens = value
    .toLowerCase()
    .replace(/\se\s/g, ",")
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);

  const mapped = tokens
    .map((token) => {
      if (token.includes("insta")) return "instagram";
      if (token.includes("face")) return "facebook";
      if (token.includes("linked")) return "linkedin";
      if (token.includes("blog")) return "blog";
      if (token.includes("news")) return "newsletter";
      return null;
    })
    .filter(
      (
        item,
      ): item is "blog" | "facebook" | "instagram" | "linkedin" | "newsletter" => Boolean(item),
    );

  const unique = Array.from(new Set(mapped));
  return unique.length > 0 ? unique.join(",") : undefined;
}

function pickValue(row: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value && value.trim()) {
      return value;
    }
  }
  return "";
}

function mapRowAliases(row: Record<string, string>): Record<string, string> {
  return {
    ...row,
    titulo: pickValue(row, ["titulo", "title"]),
    briefing: pickValue(row, ["briefing", "descricao"]),
    canais: pickValue(row, ["canais", "canal", "plataforma"]),
    data_prevista: pickValue(row, ["data_prevista", "data prevista"]),
    link_referencia: pickValue(row, ["link_referencia", "link referencia"]),
    observacoes: pickValue(row, ["observacoes", "observacao"]),
    marca: pickValue(row, ["marca", "brand"]),
    status: pickValue(row, ["status", "situacao"]),
  };
}

function getFileExtension(fileName: string): string {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

function isSupportedImportFile(file: File): boolean {
  return SUPPORTED_IMPORT_EXTENSIONS.has(getFileExtension(file.name));
}

async function getSheetJs(): Promise<SheetJsModule> {
  const url = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm";
  sheetJsPromise ??= (new Function("u", "return import(u)")(url)) as Promise<SheetJsModule>;

  return sheetJsPromise;
}

async function parseSpreadsheet(file: File): Promise<Record<string, string>[]> {
  const XLSX = await getSheetJs();
  const extension = getFileExtension(file.name);
  let workbook;
  if (extension === "csv") {
    const text = await file.text();
    const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
    const semicolons = (firstLine.match(/;/g) || []).length;
    const commas = (firstLine.match(/,/g) || []).length;
    const separator = semicolons >= commas ? ";" : ",";
    workbook = XLSX.read(text, { type: "string", FS: separator });
  } else {
    workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
  }

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return [];
  }

  return XLSX.utils
    .sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheetName], {
      defval: "",
      raw: false,
    })
    .map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [
          normalizeKey(key),
          typeof value === "string" ? value.trim() : String(value ?? "").trim(),
        ]),
      ),
    )
    .filter((row) => Object.values(row).some(Boolean));
}

export function ImportExportButtons({ pautas, onImport }: ImportExportButtonsProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const { toast } = useToast();

  const handleExport = () => {
    const headers = ["titulo", "briefing", "canais", "data_prevista", "status", "link_referencia", "observacoes", "marca"];
    const rows = pautas
      .map((p) => [
        p.titulo,
        p.briefing || "",
        p.plataforma || "",
        p.data_prevista || "",
        p.status,
        p.link_referencia || "",
        p.observacoes || "",
        p.marca || "",
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"));

    const csv = [headers.join(";"), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `pautas_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();

    URL.revokeObjectURL(url);
    toast({ title: "Exportado", description: `${pautas.length} pautas exportadas.` });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isSupportedImportFile(file)) {
      toast({
        title: "Formato não suportado",
        description: "Envie um arquivo CSV, XLSX ou XLS com o modelo da Agenda Editorial.",
        variant: "destructive",
      });
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    setImporting(true);
    try {
      let rows: Record<string, string>[];
      try {
        rows = await parseSpreadsheet(file);
      } catch (parseError) {
        console.error("Erro ao ler o arquivo da agenda", parseError);
        toast({
          title: "Arquivo invalido",
          description:
            "Nao foi possivel ler o arquivo. Verifique se e um CSV (separado por ; ou ,), XLSX ou XLS valido.",
          variant: "destructive",
        });
        return;
      }

      if (rows.length === 0) {
        toast({
          title: "Arquivo vazio",
          description: "Nenhuma linha encontrada na primeira aba do arquivo.",
          variant: "destructive",
        });
        return;
      }

      const inputs: CreatePautaInput[] = [];
      const skippedNoTitle: number[] = [];
      rows.forEach((rawRow, index) => {
        const r = mapRowAliases(rawRow);
        const titulo = (r.titulo || "").trim();
        if (!titulo) {
          skippedNoTitle.push(index + 2); // +2 = header + 1-indexed
          return;
        }
        inputs.push({
          titulo,
          briefing: (r.briefing || "").trim(),
          link_referencia: r.link_referencia?.trim() || undefined,
          observacoes: r.observacoes?.trim() || undefined,
          plataforma: normalizePlataforma(r.canais || r.plataforma) || "blog",
          data_prevista: normalizeDate(r.data_prevista),
          marca: normalizePautaMarca(r.marca, titulo),
          status: normalizePautaStatus(r.status || "pendente"),
        });
      });

      if (inputs.length === 0) {
        toast({
          title: "Sem dados",
          description:
            "Nenhuma linha com a coluna 'titulo' preenchida foi encontrada. Confira o modelo e a primeira linha do arquivo.",
          variant: "destructive",
        });
        return;
      }

      try {
        await onImport(inputs);
      } catch (importError) {
        const message = importError instanceof Error ? importError.message : String(importError);
        console.error("Falha ao salvar pautas importadas", importError);
        toast({
          title: "Falha ao salvar",
          description: `O arquivo foi lido (${inputs.length} linhas), mas o banco recusou a importacao: ${message}`,
          variant: "destructive",
        });
        return;
      }

      const skippedSuffix = skippedNoTitle.length
        ? ` (${skippedNoTitle.length} linha(s) sem titulo ignorada(s))`
        : "";
      toast({
        title: "Importado",
        description: `${inputs.length} pautas importadas com sucesso${skippedSuffix}.`,
      });
    } catch (error) {
      console.error("Error importing editorial agenda file", {
        fileName: file.name,
        fileType: file.type,
        error,
      });
      toast({
        title: "Erro inesperado",
        description:
          error instanceof Error
            ? error.message
            : "Falha ao importar o arquivo.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => fileRef.current?.click()} disabled={importing}>
        {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
        Importar
      </Button>
      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleExport} disabled={pautas.length === 0}>
        <Download className="h-3.5 w-3.5 mr-1" /> Exportar
      </Button>
      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setTemplateOpen(true)}>
        <HelpCircle className="h-3.5 w-3.5 mr-1" /> Modelo
      </Button>
      <SheetTemplateDialog open={templateOpen} onOpenChange={setTemplateOpen} />
    </>
  );
}
