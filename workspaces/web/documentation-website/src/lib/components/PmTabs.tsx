import { type PackageManagerName } from "pacwich";
import { Fragment, useId } from "react";
import { create } from "zustand";
import { SyntaxHighlighter } from "../util/highlight";

export interface PmTabsSection {
  description: React.ReactNode;
  code: string;
  language?: string;
}

export interface PmTabsProps {
  links?: React.ReactNode;
  sections: Record<PackageManagerName, PmTabsSection[]>;
  title?: string;
}

const usePmSelectionStore = create<{
  selectedPm: PackageManagerName;
  setSelectedPm: (pm: PackageManagerName) => void;
}>((set) => ({
  selectedPm: "bun",
  setSelectedPm: (pm) => set({ selectedPm: pm }),
}));

export const PmTabs = ({ links, sections, title }: PmTabsProps) => {
  const { selectedPm, setSelectedPm } = usePmSelectionStore();
  const displayedSections = sections[selectedPm];
  const id = useId();
  return (
    <div className="pm-tabs">
      <div className="pm-tabs-header">
        <h3>{title ?? ""}</h3>
        {links && <div className="pm-tabs-links">{links}</div>}
      </div>
      <div className="pm-tabs-content">
        <div className="pm-tabs-tabs">
          <button
            className={selectedPm === "bun" ? "active" : ""}
            onClick={() => setSelectedPm("bun")}
            aria-label="select bun"
          >
            Bun
          </button>
          <button
            className={selectedPm === "pnpm" ? "active" : ""}
            onClick={() => setSelectedPm("pnpm")}
            aria-label="select pnpm"
          >
            pnpm
          </button>
          <button
            className={selectedPm === "npm" ? "active" : ""}
            onClick={() => setSelectedPm("npm")}
            aria-label="select npm"
          >
            npm
          </button>
        </div>
        {displayedSections.map((section, index) => (
          <Fragment key={id + index}>
            <div key={index} className="pm-tabs-section">
              {section.description}
            </div>
            <SyntaxHighlighter language={section.language || "bash"}>
              {section.code}
            </SyntaxHighlighter>
          </Fragment>
        ))}
      </div>
    </div>
  );
};
