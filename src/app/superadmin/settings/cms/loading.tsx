import { SkeletonBody } from "@/components/admin/AdminSkeleton";

// SkeletonBody, not AdminSkeleton: the shell and the section tabs are rendered
// by src/app/superadmin/settings/layout.tsx and stay put across a section
// change, so a skeleton that brought its own shell would nest a second one.
export default function Loading() {
  return <SkeletonBody title="Content" tiles={0} rows={8} />;
}
