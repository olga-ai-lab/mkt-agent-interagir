import { useState, useRef } from "react";
import { FileUp, Loader2, X, FileText, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";

interface UploadedFile {
  file: File;
  path: string;
  file_type: "pdf" | "docx" | "txt" | "image";
  signed_url?: string;
}

interface FileToPostUploaderProps {
  onContentExtracted?: (data: { title: string; content: string }) => void;
  onProcessingStarted?: () => void;
  disabled?: boolean;
}

const ACCEPTED_TYPES: Record<string, "pdf" | "docx" | "txt" | "image"> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
};

const ACCEPT_STRING = Object.keys(ACCEPTED_TYPES).join(",");

function getFileType(file: File): "pdf" | "docx" | "txt" | "image" | null {
  if (ACCEPTED_TYPES[file.type]) return ACCEPTED_TYPES[file.type];
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (ext === "txt") return "txt";
  if (["png", "jpg", "jpeg", "webp"].includes(ext || "")) return "image";
  return null;
}

const FILE_ICONS: Record<string, typeof FileText> = {
  pdf: FileText,
  docx: FileText,
  txt: FileText,
  image: Image,
};

export function FileToPostUploader({ onContentExtracted, onProcessingStarted, disabled }: FileToPostUploaderProps) {
  const { currentWorkspace } = useWorkspace();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const handleFiles = async (selected: FileList | null) => {
    if (!selected || !currentWorkspace) return;
    setUploading(true);
    const newFiles: UploadedFile[] = [];

    for (const file of Array.from(selected)) {
      const fileType = getFileType(file);
      if (!fileType) { toast.error(`Tipo não suportado: ${file.name}`); continue; }
      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      const path = `documents/${crypto.randomUUID()}.${ext}`;

      const { error } = await supabase.storage
        .from("interagir-post-media")
        .upload(path, file, { contentType: file.type });

      if (error) { toast.error(`Erro ao enviar ${file.name}`); continue; }

      const { data: urlData } = await supabase.storage
        .from("interagir-post-media")
        .createSignedUrl(path, 3600);

      newFiles.push({ file, path, file_type: fileType, signed_url: urlData?.signedUrl });
    }

    setFiles((prev) => [...prev, ...newFiles]);
    setUploading(false);
    if (newFiles.length) toast.success(`${newFiles.length} arquivo(s) enviados`);
  };

  const removeFile = async (index: number) => {
    const f = files[index];
    await supabase.storage.from("interagir-post-media").remove([f.path]);
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleProcess = async () => {
    if (!currentWorkspace || files.length === 0) return;

    setProcessing(true);
    try {
      const generationId = crypto.randomUUID();
      const { error: statusInsertError } = await supabase.from("mkt_post_generation_status").insert({
        generation_id: generationId,
        workspace_id: currentWorkspace.id,
        status: "pending",
      });
      // Sem essa linha existindo, o banner (GenerationStatusBanner) fica
      // consultando um generation_id que nunca vai bater com nenhuma linha —
      // "carregando" pra sempre, sem nenhum erro visível pro usuário.
      if (statusInsertError) {
        console.error("post_generation_status insert error:", statusInsertError);
        toast.error("Erro ao iniciar o processamento do arquivo");
        setProcessing(false);
        return;
      }
      localStorage.setItem("pending_generation_id", generationId);

      const payload = {
        files: files.map((f) => ({ signed_url: f.signed_url, file_type: f.file_type })),
        titulo,
        observacoes,
        generation_id: generationId,
        workspace_id: currentWorkspace.id,
      };

      setFiles([]);
      setTitulo("");
      setObservacoes("");

      if (onProcessingStarted) {
        onProcessingStarted();
      } else {
        toast.success("Arquivos enviados para processamento!");
      }

      // Repassa pro n8n via edge function (mkt-trigger-file-to-post), não
      // direto do navegador — um fetch direto pro webhook do n8n Cloud é
      // bloqueado no preflight CORS (n8n não retorna os headers
      // Access-Control-Allow-* pra esse POST cross-origin), então a chamada
      // nunca chegava lá antes; do servidor (edge function) CORS não se
      // aplica. Erro aqui é reportado no banner de status em vez de sumir
      // num catch silencioso.
      const { error: triggerError } = await supabase.functions.invoke("interagir-trigger-file-to-post", {
        body: payload,
      });
      if (triggerError) {
        console.error("mkt-trigger-file-to-post error:", triggerError);
        await supabase
          .from("mkt_post_generation_status")
          .update({ status: "error", error_message: triggerError.message })
          .eq("generation_id", generationId);
        toast.error("Erro ao disparar processamento do arquivo");
      }
    } catch (err) {
      console.error("File webhook error:", err);
      toast.error("Erro ao processar arquivos via webhook");
    } finally {
      setProcessing(false);
    }
  };

  if (!currentWorkspace) return null;

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileUp className="h-4 w-4" />
          Criar post a partir de arquivo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => inputRef.current?.click()}
        >
          <FileUp className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground text-center">Clique ou arraste arquivos aqui</p>
          <p className="text-xs text-muted-foreground/70 mt-1">PDF, DOCX, TXT ou imagens</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT_STRING}
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
            disabled={disabled || uploading || processing}
          />
        </div>

        {files.length > 0 && (
          <div className="space-y-2">
            {files.map((f, i) => {
              const Icon = FILE_ICONS[f.file_type];
              return (
                <div key={i} className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate flex-1">{f.file.name}</span>
                  <Badge variant="outline" className="text-xs shrink-0">{f.file_type.toUpperCase()}</Badge>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeFile(i)} disabled={processing}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {files.length > 0 && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Título / Tema (opcional)</Label>
                <Input placeholder="Ex: Post sobre seguros" value={titulo} onChange={(e) => setTitulo(e.target.value)} disabled={processing} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Observações (opcional)</Label>
                <Input placeholder="Contexto adicional..." value={observacoes} onChange={(e) => setObservacoes(e.target.value)} disabled={processing} />
              </div>
            </div>
            <Button className="w-full" onClick={handleProcess} disabled={processing || uploading || disabled}>
              {processing
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando...</>
                : <><FileUp className="mr-2 h-4 w-4" />Processar {files.length} arquivo(s)</>
              }
            </Button>
          </>
        )}

        {uploading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Enviando arquivos...
          </div>
        )}
      </CardContent>
    </Card>
  );
}
