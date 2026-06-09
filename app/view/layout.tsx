import { ViewBodyClass } from "./ViewBodyClass";

export default function ViewLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ViewBodyClass />
      {children}
    </>
  );
}
