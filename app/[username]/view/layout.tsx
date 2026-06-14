import { ViewBodyClass } from "@/app/view/ViewBodyClass";

export default function UserViewLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ViewBodyClass />
      {children}
    </>
  );
}
