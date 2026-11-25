import { TerminalInput } from "./TerminalInput";
import { TerminalScreen, type TerminalScreenProps } from "./TerminalScreen";

export type TerminalProps = {
  onTerminalResize?: TerminalScreenProps["onTerminalResize"];
};

export const Terminal = ({ onTerminalResize }: TerminalProps) => {
  return (
    <div className="web-cli-terminal-container">
      <TerminalScreen onTerminalResize={onTerminalResize} />
      <TerminalInput />
    </div>
  );
};
