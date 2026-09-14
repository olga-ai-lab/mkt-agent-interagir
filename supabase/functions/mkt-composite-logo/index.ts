import { createClient } from "npm:@supabase/supabase-js@2";
import {
  CompositeOperator,
  FilterType,
  ImageMagick,
  initializeImageMagick,
  MagickFormat,
  Point,
} from "npm:@imagemagick/magick-wasm@0.0.40";

{
  const wasmBytes = await Deno.readFile(
    new URL(
      "magick.wasm",
      import.meta.resolve("npm:@imagemagick/magick-wasm@0.0.40"),
    ),
  );
  await initializeImageMagick(wasmBytes);
}

const BASE_MAX_DIM = 1024;
const LOGO_MAX_DIM = 256;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type MarcaConfig = {
  logoFile: string;
  maxWidthRatio: number;
  maxHeightRatio: number;
  marginRightRatio: number;
  marginTopRatio: number;
};

const MARCA_CONFIG: Record<string, MarcaConfig> = {
  livo: {
    logoFile: "LIVO_marca_color-2.png",
    maxWidthRatio: 180 / 1024,
    maxHeightRatio: 120 / 1024,
    marginRightRatio: 36 / 1024,
    marginTopRatio: 28 / 1024,
  },
  livonius: {
    logoFile: "Livonius_logo (1).png",
    maxWidthRatio: 220 / 1024,
    maxHeightRatio: 110 / 1024,
    marginRightRatio: 36 / 1024,
    marginTopRatio: 28 / 1024,
  },
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function normalizeMarca(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeImageId(
  value: unknown,
): { imageId: string; rawPath: string; finalPath: string } {
  const input = String(value ?? "").trim();

  if (!input) {
    throw new Error("image_id é obrigatório");
  }

  if (input.endsWith("_raw.png")) {
    const rawPath = input.startsWith("mkt-article-images/")
      ? input.replace(/^mkt-article-images\//, "")
      : input;
    const finalPath = rawPath.replace(/_raw\.png$/i, ".png");
    const fileName = finalPath.split("/").pop() ?? finalPath;
    const imageId = fileName.replace(/\.png$/i, "");
    return { imageId, rawPath, finalPath };
  }

  if (input.endsWith(".png")) {
    const rawPath = input.startsWith("mkt-article-images/")
      ? input.replace(/^mkt-article-images\//, "")
      : input;
    const fileName = rawPath.split("/").pop() ?? rawPath;
    const imageId = fileName.replace(/\.png$/i, "");
    return { imageId, rawPath, finalPath: rawPath };
  }

  if (input.startsWith("filesystem-v2:")) {
    throw new Error(
      "image_id veio com o caminho temporário do n8n. Envie o id original da imagem ou o nome do arquivo no Storage.",
    );
  }

  return {
    imageId: input,
    rawPath: `${input}_raw.png`,
    finalPath: `${input}.png`,
  };
}

function toBytes(blob: Blob): Promise<Uint8Array> {
  return blob.arrayBuffer().then((buffer) => new Uint8Array(buffer));
}

function clampToCanvas(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(value, max));
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let imageInfo: { imageId: string; rawPath: string; finalPath: string };
  let marca: string;

  try {
    const body = await req.json();
    imageInfo = normalizeImageId(body.image_id);
    marca = normalizeMarca(body.marca);
  } catch (error) {
    const message = error instanceof Error ? error.message : "JSON inválido no body";
    return json({ error: message }, 400);
  }

  const config = MARCA_CONFIG[marca];
  if (!config) {
    return json(
      { error: `marca inválida: '${marca}'. Use 'livo' ou 'livonius'` },
      400,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Secrets do Supabase não disponíveis na função" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceKey, { db: { schema: 'interagir' } });

  try {
    console.log(`[composite-logo] Baixando imagem: ${imageInfo.rawPath}`);
    const { data: rawBlob, error: rawErr } = await supabase.storage
      .from("mkt-article-images")
      .download(imageInfo.rawPath, {
        transform: {
          width: BASE_MAX_DIM,
          height: BASE_MAX_DIM,
          resize: "contain",
          format: "origin",
        },
      });

    if (rawErr || !rawBlob) {
      throw new Error(
        `Falha ao baixar imagem base: ${rawErr?.message ?? "blob vazio"}`,
      );
    }

    console.log(`[composite-logo] Baixando logo: ${config.logoFile}`);
    const { data: logoBlob, error: logoErr } = await supabase.storage
      .from("logos-marcas")
      .download(config.logoFile, {
        transform: {
          width: LOGO_MAX_DIM,
          height: LOGO_MAX_DIM,
          resize: "contain",
          format: "origin",
        },
      });

    if (logoErr || !logoBlob) {
      throw new Error(
        `Falha ao baixar logo: ${logoErr?.message ?? "blob vazio"}`,
      );
    }

    const rawBytes = await toBytes(rawBlob);
    const logoBytes = await toBytes(logoBlob);

    let finalBytes: Uint8Array | null = null;

    ImageMagick.read(rawBytes, (baseImage) => {
      if (baseImage.width > BASE_MAX_DIM || baseImage.height > BASE_MAX_DIM) {
        const scaleBase = Math.min(
          BASE_MAX_DIM / baseImage.width,
          BASE_MAX_DIM / baseImage.height,
        );
        baseImage.resize(
          Math.max(1, Math.round(baseImage.width * scaleBase)),
          Math.max(1, Math.round(baseImage.height * scaleBase)),
          FilterType.Lanczos,
        );
      }
      baseImage.strip();

      ImageMagick.read(logoBytes, (logoImage) => {
        const maxLogoWidth = Math.max(
          1,
          Math.round(baseImage.width * config.maxWidthRatio),
        );
        const maxLogoHeight = Math.max(
          1,
          Math.round(baseImage.height * config.maxHeightRatio),
        );
        const scale = Math.min(
          maxLogoWidth / logoImage.width,
          maxLogoHeight / logoImage.height,
          1,
        );

        const logoWidth = Math.max(1, Math.round(logoImage.width * scale));
        const logoHeight = Math.max(1, Math.round(logoImage.height * scale));

        logoImage.resize(logoWidth, logoHeight, FilterType.Lanczos);

        const marginRight = Math.max(
          8,
          Math.round(baseImage.width * config.marginRightRatio),
        );
        const marginTop = Math.max(
          8,
          Math.round(baseImage.height * config.marginTopRatio),
        );

        const posX = clampToCanvas(
          baseImage.width - logoWidth - marginRight,
          baseImage.width - logoWidth,
        );
        const posY = clampToCanvas(
          marginTop,
          baseImage.height - logoHeight,
        );

        console.log(
          `[composite-logo] Base ${baseImage.width}x${baseImage.height} | Logo ${logoWidth}x${logoHeight} | Pos (${posX}, ${posY})`,
        );

        baseImage.composite(
          logoImage,
          CompositeOperator.Over,
          new Point(posX, posY),
        );

        finalBytes = baseImage.write(MagickFormat.Png, (data) => {
          const copy = new Uint8Array(data.length);
          copy.set(data);
          return copy;
        });
      });
    });

    if (!finalBytes) {
      throw new Error("Falha ao compor a imagem final");
    }

    const finalBlob = new Blob([finalBytes], { type: "image/png" });

    console.log(`[composite-logo] Upload final: ${imageInfo.finalPath}`);
    const { error: uploadErr } = await supabase.storage
      .from("mkt-article-images")
      .upload(imageInfo.finalPath, finalBlob, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadErr) {
      throw new Error(`Upload falhou: ${uploadErr.message}`);
    }

    // A imagem crua (sem logo) é mantida no Storage para servir de base_media_urls
    // no editor de composição de marca (o usuário precisa dela para mover/recolorir
    // a logo). NÃO remover o rawPath.

    const publicUrl =
      `${supabaseUrl}/storage/v1/object/public/mkt-article-images/${imageInfo.finalPath}`;
    const basePublicUrl =
      `${supabaseUrl}/storage/v1/object/public/mkt-article-images/${imageInfo.rawPath}`;
    return json({
      id: imageInfo.imageId,
      public_url: publicUrl,
      base_public_url: basePublicUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[composite-logo] ERRO: ${message}`);
    return json({ error: message }, 500);
  }
});
