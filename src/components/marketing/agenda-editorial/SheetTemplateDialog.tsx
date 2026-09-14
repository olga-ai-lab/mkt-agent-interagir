import { Download, FileSpreadsheet, Table2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

interface SheetTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SheetJsModule {
  utils: {
    book_new: () => unknown;
    aoa_to_sheet: (rows: string[][]) => unknown;
    book_append_sheet: (workbook: unknown, worksheet: unknown, sheetName: string) => void;
  };
  writeFile: (workbook: unknown, fileName: string, options?: Record<string, unknown>) => void;
}

const columns = [
  { name: "titulo", required: true, example: "Seguro de vida 2025" },
  { name: "briefing", required: true, example: "Tendências do mercado..." },
  { name: "canais", required: false, example: "instagram,linkedin" },
  { name: "data_prevista", required: false, example: "2025-04-20" },
  { name: "status", required: false, example: "pendente" },
  { name: "link_referencia", required: false, example: "https://exemplo.com" },
  { name: "observacoes", required: false, example: "Prioridade alta" },
  { name: "marca", required: false, example: "livo" },
];

let sheetJsPromise: Promise<SheetJsModule> | null = null;

async function getSheetJs(): Promise<SheetJsModule> {
  const url = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm";
  sheetJsPromise ??= (new Function("u", "return import(u)")(url)) as Promise<SheetJsModule>;

  return sheetJsPromise;
}

function downloadCsvTemplate() {
  const csv = columns.map((c) => c.name).join(";") + "\n";
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "modelo_pautas.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

async function downloadExcelTemplate(bookType: "xlsx" | "xls") {
  const XLSX = await getSheetJs();
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([columns.map((column) => column.name)]);

  XLSX.utils.book_append_sheet(workbook, worksheet, "Agenda Editorial");
  XLSX.writeFile(workbook, `modelo_pautas.${bookType}`, { bookType });
}

export function SheetTemplateDialog({ open, onOpenChange }: SheetTemplateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Modelo de Importação da Agenda</DialogTitle>
          <DialogDescription>
            Você pode importar arquivos CSV, XLSX ou XLS. Em arquivos do Excel, usamos a primeira aba e esperamos as colunas abaixo.
          </DialogDescription>
        </DialogHeader>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Coluna</TableHead>
                <TableHead>Obrigatório</TableHead>
                <TableHead>Exemplo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {columns.map((col) => (
                <TableRow key={col.name}>
                  <TableCell className="font-mono text-sm">{col.name}</TableCell>
                  <TableCell>{col.required ? <span className="text-amber-600 font-medium">Sim</span> : <span className="text-muted-foreground">Não</span>}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{col.example}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="text-sm text-muted-foreground space-y-1">
          <p>- Arquivos <strong>.csv</strong>, <strong>.xlsx</strong> e <strong>.xls</strong> são aceitos</p>
          <p>- Em planilhas do Excel, usamos sempre a primeira aba do arquivo</p>
          <p>- <strong>canais</strong>: valores separados por vírgula: <code>instagram</code>, <code>facebook</code>, <code>linkedin</code>, <code>blog</code></p>
          <p>- <strong>data_prevista</strong>: formato <code>AAAA-MM-DD</code>, <code>DD/MM/AAAA</code> ou por extenso, como <code>01 de jul.</code> (datas inválidas são ignoradas, sem bloquear a importação)</p>
          <p>- <strong>status</strong>: <code>pendente</code>, <code>processando</code>, <code>gerado</code>, <code>publicado</code>, <code>erro</code></p>
          <p>- <strong>marca</strong>: <code>livo</code> ou <code>livonius</code> (se vazio, inferimos por título)</p>
        </div>

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button variant="outline" onClick={downloadCsvTemplate}>
            <Download className="h-4 w-4 mr-1" /> Baixar modelo CSV
          </Button>
          <Button variant="outline" onClick={() => void downloadExcelTemplate("xlsx")}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Baixar modelo XLSX
          </Button>
          <Button variant="outline" onClick={() => void downloadExcelTemplate("xls")}>
            <Table2 className="h-4 w-4 mr-1" /> Baixar modelo XLS
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
