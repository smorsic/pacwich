import { WARNING_IDS } from "@pacwich/common/warnings";

const sortedIds = [...WARNING_IDS].sort();

export const WarningIds = () => {
  return (
    <ul>
      {sortedIds.map((id) => (
        <li key={id}>
          <code>{id}</code>
        </li>
      ))}
    </ul>
  );
};
