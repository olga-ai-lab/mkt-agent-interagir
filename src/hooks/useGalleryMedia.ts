import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface GalleryFile {
  name: string;
  path: string;
  publicUrl: string;
  type: "image" | "video" | "other";
  createdAt: string;
  company?: string;
}

const imageExtensions = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "avif"];
const videoExtensions = ["mp4", "mov", "avi", "webm", "mkv"];
const MEDIA_BUCKET = "mkt-post-media";

function getFileType(url: string): GalleryFile["type"] {
  const ext = url.split(/[?#]/)[0].split(".").pop()?.toLowerCase() || "";
  if (imageExtensions.includes(ext)) return "image";
  if (videoExtensions.includes(ext)) return "video";
  return "other";
}

function fileNameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    return pathname.split("/").pop() || url;
  } catch {
    return url.split("/").pop() || url;
  }
}

export function useGalleryMedia(
  filter: "all" | "image" | "video" = "all",
  companyFilter: "all" | "livonius" | "livo" = "all"
) {
  const queryClient = useQueryClient();

  const { data: files = [], isLoading } = useQuery({
    queryKey: ["gallery-media", companyFilter],
    queryFn: async () => {
      // 1. Fetch media_urls from social_posts
      const { data: posts, error: postsError } = await supabase
        .from("mkt_social_posts")
        .select("id, media_urls, company, created_at")
        .not("media_urls", "is", null);

      if (postsError) throw postsError;

      const seenUrls = new Set<string>();
      const allFiles: GalleryFile[] = [];

      // Flatten media_urls from posts
      for (const post of posts || []) {
        const urls = post.media_urls as string[] | null;
        if (!urls || urls.length === 0) continue;

        for (const url of urls) {
          if (!url || seenUrls.has(url)) continue;
          seenUrls.add(url);

          allFiles.push({
            name: fileNameFromUrl(url),
            path: url,
            publicUrl: url,
            type: getFileType(url),
            createdAt: post.created_at || "",
            company: post.company || undefined,
          });
        }
      }

      // 2. Also list storage bucket for orphan files
      try {
        const { data: folders } = await supabase.storage
          .from(MEDIA_BUCKET)
          .list("", { limit: 1000 });

        for (const folder of folders || []) {
          if (!folder.id && folder.name) {
            const { data: innerFiles } = await supabase.storage
              .from(MEDIA_BUCKET)
              .list(folder.name, { limit: 1000 });

            for (const file of innerFiles || []) {
              if (file.id) {
                const path = `${folder.name}/${file.name}`;
                const { data: urlData } = supabase.storage
                  .from(MEDIA_BUCKET)
                  .getPublicUrl(path);

                if (!seenUrls.has(urlData.publicUrl)) {
                  seenUrls.add(urlData.publicUrl);
                  allFiles.push({
                    name: file.name,
                    path,
                    publicUrl: urlData.publicUrl,
                    type: getFileType(file.name),
                    createdAt: file.created_at || "",
                  });
                }
              }
            }
          } else if (folder.id) {
            const { data: urlData } = supabase.storage
              .from(MEDIA_BUCKET)
              .getPublicUrl(folder.name);

            if (!seenUrls.has(urlData.publicUrl)) {
              seenUrls.add(urlData.publicUrl);
              allFiles.push({
                name: folder.name,
                path: folder.name,
                publicUrl: urlData.publicUrl,
                type: getFileType(folder.name),
                createdAt: folder.created_at || "",
              });
            }
          }
        }
      } catch {
        // Storage listing failed, continue with post data only
      }

      return allFiles
        .filter((f) => f.type !== "other")
        .sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (path: string) => {
      // If it's a full URL from storage bucket, extract the storage path
      if (path.includes("/mkt-post-media/") || path.includes("/post-media/")) {
        const storagePath = path.includes("/mkt-post-media/")
          ? path.split("/mkt-post-media/").pop()
          : path.split("/post-media/").pop();
        if (storagePath) {
          const { error } = await supabase.storage
            .from(MEDIA_BUCKET)
            .remove([decodeURIComponent(storagePath)]);
          if (error) throw error;
          return;
        }
      }
      // Fallback: try as direct storage path
      const { error } = await supabase.storage
        .from(MEDIA_BUCKET)
        .remove([path]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Arquivo excluído com sucesso");
      queryClient.invalidateQueries({ queryKey: ["gallery-media"] });
    },
    onError: (error) => {
      toast.error("Erro ao excluir arquivo: " + error.message);
    },
  });

  let filtered = files;
  if (filter !== "all") {
    filtered = filtered.filter((f) => f.type === filter);
  }
  if (companyFilter !== "all") {
    filtered = filtered.filter((f) => f.company === companyFilter);
  }

  return {
    files: filtered,
    allFiles: files,
    isLoading,
    deleteFile: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
  };
}
