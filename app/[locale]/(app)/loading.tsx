import { PageSkeleton } from "@/components/state/skeleton";

// Brief §6.9: "every route segment gets loading.tsx". Placed at the route-group level rather than
// copied into each page's folder -- a `loading.tsx` covers every segment nested beneath it, so one
// file here gives the whole group a designed loading state, and a screen whose skeleton should
// look different can still add its own closer to the leaf.
export default function Loading() {
  return <PageSkeleton />;
}
