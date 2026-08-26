import { ref } from 'vue';

// Lets a page override the shared AdminLayout header: replace the hamburger with
// a back button and the "HitFactor" title with a page-specific title (e.g. the
// scoring page shows "Stage 1: …" + a back arrow instead of the drawer menu).
// A page sets this on mount and clears it on unmount.
export const pageHeaderTitle = ref<string | null>(null);
export const pageHeaderBackTo = ref<string | null>(null); // non-null → show back button

export function setPageHeader(title: string, backTo: string | null = null): void {
  pageHeaderTitle.value = title;
  pageHeaderBackTo.value = backTo;
}

export function clearPageHeader(): void {
  pageHeaderTitle.value = null;
  pageHeaderBackTo.value = null;
}
