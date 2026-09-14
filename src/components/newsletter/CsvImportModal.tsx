import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, X, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useNewsletterSegments } from "@/hooks/useNewsletterSegments";
import { toast } from "sonner";

interface ParsedRow {
  email: string;
  name?: string;
  segment?: string; // from CSV column
}

interface PreviewData {
  total: number;
  valid: ParsedRow[];
  invalid: string[];
  duplicates: string[];
  csvSegments: string[]; // unique segment names found in CSV
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmail(email: string) {
  return EMAIL_RE.test(email.trim());
}

function splitCSVLine(line: string, sep: string): string[] {
  const result: string[] = [];
  let i = 0;
  while (i <= line.length) {
    if (line[i] === '"') {
      i++;
      let cell = "";
      while (i < line.length) {
        if (line[i] === '"') {
          if (line[i + 1] === '"') { cell += '"'; i += 2; }
          else { i++; break; }
        } else { cell += line[i]; i++; }
      }
      result.push(cell);
      if (line.slice(i, i + sep.length) === sep) i += sep.length;
      else i = line.length + 1;
    } else {
      const end = line.indexOf(sep, i);
      if (end === -1) { result.push(line.slice(i).trim()); break; }
      else {
        result.push(line.slice(i, end).trim());
        i = end + sep.length;
        if (i > line.length) { result.push(""); break; }
      }
    }
  }
  return result;
}

// Compartilhado entre CSV e XLSX: os dois formatos convergem para linhas de
// células já separadas (string[][]) e usam a mesma detecção de colunas por
// nome de cabeçalho, para aceitar o mesmo modelo de planilha nos dois casos.
function mapRowsToSubscribers(rawHeaders: string[], dataRows: string[][]): ParsedRow[] {
  const headers = rawHeaders.map((h) => h.toLowerCase().trim());

  const emailIdx = headers.findIndex((h) => h === "email");
  const nameIdx = headers.findIndex((h) => h === "nome" || h === "name");
  const segmentIdx = headers.findIndex((h) => h === "segmento" || h === "segment" || h === "tag");

  const hasHeader = emailIdx !== -1 || !isValidEmail(rawHeaders[0] ?? "");
  const rows = hasHeader ? dataRows : [rawHeaders, ...dataRows];
  const eIdx = emailIdx !== -1 ? emailIdx : 0;

  return rows
    .filter((cols) => cols.some((c) => c?.trim()))
    .map((cols) => {
      const email = cols[eIdx]?.trim() ?? "";
      const name = nameIdx !== -1 ? cols[nameIdx]?.trim() : undefined;
      const segment = segmentIdx !== -1 ? cols[segmentIdx]?.trim() : undefined;
      return { email, name: name || undefined, segment: segment || undefined };
    })
    .filter((r) => r.email);
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];

  const sep = lines[0].includes("\t") ? "\t" : ",";
  const [rawHeaders, ...dataLines] = lines.map((line) => splitCSVLine(line, sep));
  return mapRowsToSubscribers(rawHeaders, dataLines);
}

async function parseWorkbook(file: File): Promise<ParsedRow[]> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];

  const sheet = workbook.Sheets[firstSheetName];
  // header: 1 -> array de arrays (não tenta inferir objeto pelo cabeçalho);
  // raw: false -> valores formatados como texto (datas/números viram string,
  // igual ao que uma célula de CSV seria); defval: "" -> preenche buracos de
  // célula vazia, senão linhas mais curtas quebrariam o índice das colunas.
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" });
  const [rawHeaders, ...dataRows] = rows.map((row) => row.map((cell) => String(cell ?? "").trim()));
  if (!rawHeaders) return [];

  return mapRowsToSubscribers(rawHeaders, dataRows);
}

function isSpreadsheetFile(file: File): boolean {
  return /\.(xlsx|xls)$/i.test(file.name);
}

async function readFileWithEncoding(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff)) {
    return new TextDecoder("utf-16").decode(buffer);
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("iso-8859-1").decode(buffer);
  }
}

// Random pleasant color for auto-created segments
const PALETTE = ["#1a6b5a","#2563eb","#9333ea","#db2777","#ea580c","#16a34a","#0891b2","#d97706"];
function pickColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

// ── Template preview ─────────────────────────────────────────────────────────
function TemplatePreview({ onClose }: { onClose: () => void }) {
  const example = [
    { email: "joao@exemplo.com", nome: "João Silva", segmento: "Leads" },
    { email: "maria@empresa.com.br", nome: "Maria Souza", segmento: "Clientes" },
    { email: "carlos@email.com", nome: "", segmento: "" },
  ];

  const downloadTemplate = () => {
    const rows = ["email,nome,segmento", ...example.map(r => `${r.email},${r.nome},${r.segmento}`)];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo_inscritos.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadTemplateXlsx = async () => {
    const XLSX = await import("xlsx");
    const sheet = XLSX.utils.json_to_sheet(example, { header: ["email", "nome", "segmento"] });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Inscritos");
    XLSX.writeFile(workbook, "modelo_inscritos.xlsx");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Modelo de planilha aceito</h3>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>

      <p className="text-xs text-muted-foreground">
        O arquivo CSV ou Excel (.xlsx) deve ter as colunas abaixo. Apenas <strong>email</strong> é
        obrigatório. O campo <strong>segmento</strong> cria automaticamente segmentos que ainda não
        existem.
      </p>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/60">
              <th className="text-left px-3 py-2 font-medium">Coluna</th>
              <th className="text-left px-3 py-2 font-medium">Obrigatório</th>
              <th className="text-left px-3 py-2 font-medium">Descrição</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            <tr>
              <td className="px-3 py-2 font-mono font-semibold">email</td>
              <td className="px-3 py-2"><Badge variant="destructive" className="text-[10px] h-4">Sim</Badge></td>
              <td className="px-3 py-2 text-muted-foreground">Endereço de email do inscrito</td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-mono">nome</td>
              <td className="px-3 py-2"><Badge variant="secondary" className="text-[10px] h-4">Não</Badge></td>
              <td className="px-3 py-2 text-muted-foreground">Nome completo ou apelido</td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-mono">segmento</td>
              <td className="px-3 py-2"><Badge variant="secondary" className="text-[10px] h-4">Não</Badge></td>
              <td className="px-3 py-2 text-muted-foreground">Tag ou grupo do lead — criado automaticamente se não existir</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="rounded-lg bg-muted/40 overflow-hidden">
        <p className="text-[10px] text-muted-foreground px-3 pt-2 pb-1 font-medium uppercase tracking-wide">Exemplo</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-t border-border/60">
                <th className="text-left px-3 py-1.5 text-muted-foreground">email</th>
                <th className="text-left px-3 py-1.5 text-muted-foreground">nome</th>
                <th className="text-left px-3 py-1.5 text-muted-foreground">segmento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {example.map((r, i) => (
                <tr key={i}>
                  <td className="px-3 py-1.5">{r.email}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{r.nome || "—"}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{r.segmento || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        CSV aceita <strong>vírgula</strong> ou <strong>tabulação</strong> como separador, em
        UTF-8, UTF-16 ou Latin-1. Arquivos .xlsx usam a primeira aba da planilha.
      </p>

      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="flex-1 gap-2" onClick={downloadTemplate}>
          <FileText className="h-3.5 w-3.5" />
          Baixar modelo .csv
        </Button>
        <Button size="sm" variant="outline" className="flex-1 gap-2" onClick={downloadTemplateXlsx}>
          <FileText className="h-3.5 w-3.5" />
          Baixar modelo .xlsx
        </Button>
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────
interface CsvImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CsvImportModal({ open, onOpenChange }: CsvImportModalProps) {
  const [step, setStep] = useState<"upload" | "preview" | "importing">("upload");
  const [showTemplate, setShowTemplate] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);
  const [applyToExisting, setApplyToExisting] = useState(true);
  const [newSegmentInput, setNewSegmentInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { data: segments = [] } = useNewsletterSegments();

  const existingSegmentNames = segments.map((s) => s.name);

  const toggleSegment = (name: string) => {
    setSelectedSegments((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]
    );
  };

  const addManualSegment = () => {
    const name = newSegmentInput.trim();
    if (!name) return;
    if (!selectedSegments.includes(name)) setSelectedSegments((p) => [...p, name]);
    setNewSegmentInput("");
  };

  const handleClose = () => {
    setStep("upload");
    setPreview(null);
    setParsedRows([]);
    setSelectedSegments([]);
    setApplyToExisting(true);
    setShowTemplate(false);
    setNewSegmentInput("");
    onOpenChange(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let rows: ParsedRow[];
    try {
      rows = isSpreadsheetFile(file) ? await parseWorkbook(file) : parseCSV(await readFileWithEncoding(file));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível ler o arquivo");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const valid: ParsedRow[] = [];
    const invalid: string[] = [];

    for (const row of rows) {
      if (isValidEmail(row.email)) valid.push(row);
      else invalid.push(row.email);
    }

    const seen = new Set<string>();
    const uniqueValid: ParsedRow[] = [];
    for (const row of valid) {
      const key = row.email.toLowerCase();
      if (!seen.has(key)) { seen.add(key); uniqueValid.push(row); }
    }

    let duplicates: string[] = [];
    if (uniqueValid.length > 0) {
      const emails = uniqueValid.map((r) => r.email.toLowerCase());
      const { data } = await supabase.from("mkt_newsletter_subscribers").select("email").in("email", emails);
      duplicates = (data ?? []).map((d) => d.email);
    }

    // Collect unique segment values from CSV (non-empty)
    const csvSegments = Array.from(
      new Set(uniqueValid.map((r) => r.segment).filter(Boolean) as string[])
    );

    // Pre-select CSV segments
    setSelectedSegments(csvSegments);

    setParsedRows(uniqueValid);
    setPreview({ total: rows.length, valid: uniqueValid, invalid, duplicates, csvSegments });
    setStep("preview");

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImport = async () => {
    if (!preview || parsedRows.length === 0) return;
    setStep("importing");

    try {
      // 1. Ensure all segments exist in newsletter_segments (create missing ones)
      const allSegmentNames = Array.from(new Set([
        ...selectedSegments,
        ...(preview.csvSegments),
      ]));

      for (const name of allSegmentNames) {
        if (!existingSegmentNames.includes(name)) {
          const { error } = await supabase.from("mkt_newsletter_segments").insert({
            name,
            color: pickColor(name),
            description: null,
          });
          if (error && !error.message.includes("duplicate")) {
            console.warn("Segment create warn:", error.message);
          }
        }
      }

      // 2. Build payload — each row carries its own segments (from CSV + manually selected)
      const payload = parsedRows.map((r) => {
        const rowSegments = Array.from(new Set([
          ...(r.segment ? [r.segment] : []),
          ...selectedSegments,
        ]));
        return {
          email: r.email.toLowerCase(),
          name: r.name ?? null,
          segments: rowSegments,
        };
      });

      const { data, error } = await (supabase.rpc as any)("mkt_import_newsletter_subscribers", {
        p_subscribers: payload,
        p_segments: selectedSegments,
        p_merge_existing: applyToExisting,
      });

      if (error) {
        toast.error("Erro ao importar: " + error.message);
        setStep("preview");
        return;
      }

      const result = (data ?? {}) as { inserted?: number; existing?: number; merged?: number };
      const inserted = result.inserted ?? parsedRows.length - preview.duplicates.length;
      const existing = result.existing ?? preview.duplicates.length;

      const parts = [`${inserted} adicionados`, `${existing} já existiam`];
      if (allSegmentNames.length > 0) parts.push(`segmentos: ${allSegmentNames.join(", ")}`);
      if (preview.invalid.length > 0) parts.push(`${preview.invalid.length} inválidos`);
      toast.success(parts.join(" · "));

      queryClient.invalidateQueries({ queryKey: ["newsletter-subscribers"] });
      queryClient.invalidateQueries({ queryKey: ["newsletter-segments"] });
      handleClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao importar");
      setStep("preview");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar planilha</DialogTitle>
        </DialogHeader>

        {/* ── Template overlay ── */}
        {showTemplate && <TemplatePreview onClose={() => setShowTemplate(false)} />}

        {!showTemplate && (
          <>
            {/* ── UPLOAD step ── */}
            {step === "upload" && (
              <div className="py-6 space-y-4">
                <div className="text-center">
                  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Selecione um arquivo CSV ou Excel (.xlsx) com as colunas{" "}
                    <strong>email</strong>, <strong>nome</strong> e <strong>segmento</strong>.<br />
                    Segmentos do arquivo são criados automaticamente.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 justify-center">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.txt,.xlsx,.xls"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <Button onClick={() => fileInputRef.current?.click()}>
                      Selecionar arquivo
                    </Button>
                    <Button variant="outline" className="gap-2" onClick={() => setShowTemplate(true)}>
                      <FileText className="h-4 w-4" />
                      Ver modelo
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* ── PREVIEW step ── */}
            {step === "preview" && preview && (
              <div className="space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-2xl font-bold">{preview.total}</p>
                    <p className="text-xs text-muted-foreground mt-1">Total de linhas</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-2xl font-bold text-emerald-600">{preview.valid.length}</p>
                    <p className="text-xs text-muted-foreground mt-1">Emails válidos</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-2xl font-bold text-amber-600">{preview.duplicates.length}</p>
                    <p className="text-xs text-muted-foreground mt-1">Já existem no banco</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-2xl font-bold text-destructive">{preview.invalid.length}</p>
                    <p className="text-xs text-muted-foreground mt-1">Emails inválidos</p>
                  </div>
                </div>

                {preview.invalid.length > 0 && (
                  <div className="rounded-lg bg-destructive/10 p-3">
                    <p className="text-xs font-medium text-destructive mb-2">Primeiros inválidos:</p>
                    <ul className="max-h-24 overflow-y-auto space-y-1">
                      {preview.invalid.slice(0, 5).map((e, i) => {
                        const label = e || "(vazio)";
                        return (
                          <li key={i} className="text-xs text-muted-foreground font-mono truncate">
                            {label.length > 60 ? label.slice(0, 60) + "…" : label}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {/* CSV segments detected */}
                {preview.csvSegments.length > 0 && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 p-3 space-y-2">
                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      Segmentos detectados no arquivo
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {preview.csvSegments.map((seg) => {
                        const exists = existingSegmentNames.includes(seg);
                        return (
                          <span
                            key={seg}
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                            style={{ backgroundColor: pickColor(seg) + "22", color: pickColor(seg) }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: pickColor(seg) }}
                            />
                            {seg}
                            {!exists && (
                              <span className="text-[10px] opacity-70 ml-0.5">(novo)</span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Segmentos marcados como <em>novo</em> serão criados automaticamente na importação.
                    </p>
                  </div>
                )}

                {/* Segment assignment */}
                <div className="space-y-3 rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Segmentos adicionais</p>
                    <p className="text-xs text-muted-foreground">
                      Aplique segmentos extras a todos os inscritos importados (além dos do arquivo).
                    </p>
                  </div>

                  {segments.length > 0 && (
                    <div className="space-y-2 max-h-36 overflow-y-auto">
                      {segments.map((segment) => (
                        <label
                          key={segment.id}
                          htmlFor={`seg-${segment.id}`}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Checkbox
                            id={`seg-${segment.id}`}
                            checked={selectedSegments.includes(segment.name)}
                            onCheckedChange={() => toggleSegment(segment.name)}
                          />
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: segment.color }} />
                          <span className="text-sm">{segment.name}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* Add new segment inline */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Adicionar novo segmento..."
                      value={newSegmentInput}
                      onChange={(e) => setNewSegmentInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addManualSegment()}
                      className="h-8 text-sm"
                    />
                    <Button size="sm" variant="outline" className="h-8 gap-1 shrink-0" onClick={addManualSegment}>
                      <Plus className="h-3.5 w-3.5" />
                      Adicionar
                    </Button>
                  </div>

                  {/* Extra segments typed manually */}
                  {selectedSegments.filter((s) => !existingSegmentNames.includes(s) && !preview.csvSegments.includes(s)).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedSegments
                        .filter((s) => !existingSegmentNames.includes(s) && !preview.csvSegments.includes(s))
                        .map((s) => (
                          <span
                            key={s}
                            className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
                          >
                            {s}
                            <button onClick={() => toggleSegment(s)} className="ml-0.5 opacity-60 hover:opacity-100">
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                    </div>
                  )}

                  {selectedSegments.length > 0 && preview.duplicates.length > 0 && (
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <Label htmlFor="apply-existing" className="text-xs font-normal text-muted-foreground">
                        Aplicar segmentos também aos {preview.duplicates.length} já existentes
                      </Label>
                      <Switch
                        id="apply-existing"
                        checked={applyToExisting}
                        onCheckedChange={setApplyToExisting}
                      />
                    </div>
                  )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                  <Button variant="outline" onClick={() => setStep("upload")}>Voltar</Button>
                  <Button
                    onClick={handleImport}
                    disabled={
                      preview.valid.length === 0 ||
                      (preview.valid.length === preview.duplicates.length &&
                        !(selectedSegments.length > 0 && applyToExisting))
                    }
                  >
                    Confirmar importação
                  </Button>
                </DialogFooter>
              </div>
            )}

            {/* ── IMPORTING step ── */}
            {step === "importing" && (
              <div className="py-8 text-center">
                <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">Importando...</p>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
