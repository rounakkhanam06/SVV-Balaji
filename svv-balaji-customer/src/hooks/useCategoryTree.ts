import { useStorefrontCategoryTree } from '@shared/hooks/useCategories';
import { api as storefrontApi } from '../api/client';

/** A top-level category as the storefront screens draw it. `id` is the slug - what `/products/:categoryId` expects. */
export interface CategoryNode {
  id: string;
  name: string;
  color: string;
  image: string;
  subcategories: { id: string; name: string; image: string }[];
}

/** Rotates through a fixed palette so a category picked up an icon-tile color without needing one from the admin form. */
const COLOR_PALETTE = ['#f5e9d8', '#fde3cf', '#f3e6d0', '#f6dede', '#e0e7ff', '#dcfce7', '#fae8ff', '#fef3c7'];

/**
 * Live categories from Admin > Manage Category - active only, in admin
 * display order - so adding, renaming, hiding or reordering one shows on every
 * screen. Empty while loading and when none are published: there is no mock
 * fallback any more, so a shopper never sees (or is routed to) a category that
 * does not exist.
 */
export function useCategoryTreeQuery() {
  const { data, isLoading, isError } = useStorefrontCategoryTree(storefrontApi);
  const categories: CategoryNode[] = (data ?? []).map((category, index) => ({
    id: category.slug,
    name: category.name,
    color: COLOR_PALETTE[index % COLOR_PALETTE.length],
    image: category.imageUrl ?? '/images/cat_namkeen.jpg',
    subcategories: category.children.map((child) => ({
      id: child.slug,
      name: child.name,
      image: child.imageUrl ?? category.imageUrl ?? '/images/cat_namkeen.jpg',
    })),
  }));
  return { categories, isLoading, isError };
}

/** Just the list, for screens that render nothing extra while it loads. */
export function useCategoryTree(): CategoryNode[] {
  return useCategoryTreeQuery().categories;
}
