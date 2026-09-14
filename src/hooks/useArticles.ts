import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  cover_image_url: string | null;
  category_id: string | null;
  author_id: string | null;
  status: string;
  tags: string[] | null;
  meta_description: string | null;
  view_count: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  brand: string | null;
  reading_time: number | null;
  location: string | null;
  keywords: string[] | null;
  categories?: { id: string; name: string; slug: string } | null;
  profiles?: { id: string; full_name: string | null; avatar_url: string | null } | null;
}

export type BrandFilter = "all" | "livonius" | "livo";

interface PublishedArticlesParams {
  categorySlug?: string;
  search?: string;
  brand?: BrandFilter;
}

export function usePublishedArticles(params: PublishedArticlesParams = {}) {
  const { categorySlug, search, brand = "all" } = params;

  return useQuery({
    queryKey: ["articles", "published", categorySlug, search, brand],
    queryFn: async () => {
      let query = supabase
        .from("articles")
        .select(`
          *,
          categories(id, name, slug),
          profiles(id, full_name, avatar_url)
        `)
        .eq("status", "published")
        .order("published_at", { ascending: false });

      // Filter by brand
      if (brand !== "all") {
        query = query.eq("brand", brand);
      }

      // Filter by category
      if (categorySlug) {
        const { data: category } = await supabase
          .from("categories")
          .select("id")
          .eq("slug", categorySlug)
          .maybeSingle();
        
        if (category) {
          query = query.eq("category_id", category.id);
        }
      }

      // Search across title, excerpt, and keywords
      if (search) {
        query = query.or(
          `title.ilike.%${search}%,excerpt.ilike.%${search}%,keywords.cs.{${search}}`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Article[];
    },
  });
}

export function useArticleBySlug(slug: string) {
  return useQuery({
    queryKey: ["article", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("articles")
        .select(`
          *,
          categories(id, name, slug),
          profiles(id, full_name, avatar_url)
        `)
        .eq("slug", slug)
        .maybeSingle();
      
      if (error) throw error;
      return data as Article | null;
    },
    enabled: !!slug,
  });
}

export function useAllArticles() {
  return useQuery({
    queryKey: ["articles", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("articles")
        .select(`
          *,
          categories(id, name, slug),
          profiles(id, full_name, avatar_url)
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as Article[];
    },
  });
}

interface CreateArticleInput {
  title: string;
  slug: string;
  excerpt?: string | null;
  content?: string | null;
  cover_image_url?: string | null;
  category_id?: string | null;
  author_id?: string | null;
  status?: string;
  tags?: string[] | null;
  meta_description?: string | null;
  published_at?: string | null;
  brand?: string;
  reading_time?: number;
  location?: string;
  keywords?: string[];
}

export function useCreateArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (article: CreateArticleInput) => {
      const { data, error } = await supabase
        .from("articles")
        .insert([article])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["articles"] });
    },
  });
}

export function useUpdateArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...article }: Partial<Article> & { id: string }) => {
      const { data, error } = await supabase
        .from("articles")
        .update(article)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["articles"] });
    },
  });
}

export function useDeleteArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("articles")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["articles"] });
    },
  });
}

export function useIncrementViewCount() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: article } = await supabase
        .from("articles")
        .select("view_count")
        .eq("id", id)
        .single();
      
      const { error } = await supabase
        .from("articles")
        .update({ view_count: (article?.view_count || 0) + 1 })
        .eq("id", id);
      
      if (error) throw error;
    },
  });
}

export function useRelatedArticles(articleId: string, categoryId: string | null) {
  return useQuery({
    queryKey: ["articles", "related", articleId, categoryId],
    queryFn: async () => {
      let query = supabase
        .from("articles")
        .select(`
          *,
          categories(id, name, slug),
          profiles(id, full_name, avatar_url)
        `)
        .eq("status", "published")
        .neq("id", articleId)
        .limit(3);

      if (categoryId) {
        query = query.eq("category_id", categoryId);
      }

      const { data, error } = await query.order("published_at", { ascending: false });
      if (error) throw error;
      return data as Article[];
    },
    enabled: !!articleId,
  });
}

export function useTotalArticlesCount() {
  return useQuery({
    queryKey: ["articles", "count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("articles")
        .select("*", { count: "exact", head: true })
        .eq("status", "published");
      
      if (error) throw error;
      return count || 0;
    },
  });
}
