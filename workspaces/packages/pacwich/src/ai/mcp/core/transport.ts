import readline from "readline";

export type RawMessage = Record<string, unknown>;

export type McpTransport = {
  receive: () => AsyncGenerator<RawMessage>;
  send: (message: RawMessage) => void;
};

export type MemoryTransport = McpTransport & {
  sent: RawMessage[];
};

export const createMemoryTransport = (
  messages: RawMessage[],
): MemoryTransport => {
  const sent: RawMessage[] = [];

  const send = (message: RawMessage): void => {
    sent.push(message);
  };

  const receive = async function* (): AsyncGenerator<RawMessage> {
    for (const message of messages) {
      yield message;
    }
  };

  return { send, receive, sent };
};

export const createStdioTransport = (): McpTransport => {
  const send = (message: RawMessage): void => {
    process.stdout.write(JSON.stringify(message) + "\n");
  };

  const receive = async function* (): AsyncGenerator<RawMessage> {
    const rl = readline.createInterface({
      input: process.stdin,
      terminal: false,
    });

    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        yield JSON.parse(trimmed) as RawMessage;
      } catch {
        // Ignore malformed lines. The client sent invalid JSON
      }
    }
  };

  return { send, receive };
};
