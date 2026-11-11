import packageJson from "../../../package.json";

export function AuthFooter() {
  return (
    <footer className="w-full border-t border-border px-4 py-4 text-caption text-neutral-600 sm:px-6 sm:py-5">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 text-center sm:flex-row sm:justify-between sm:text-left">
        <span>© {new Date().getFullYear()} Design Coordinates, Inc.</span>
        <span>PMSG Desk v{packageJson.version}</span>
      </div>
    </footer>
  );
}
