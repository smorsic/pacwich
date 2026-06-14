import { createAsyncIterableQueue } from "../../../../src/internal/core";
import { createMultiProcessOutput } from "../../../../src/runScript/output/multiProcessOutput";
import { createProcessOutput } from "../../../../src/runScript/output/processOutput";
import { describe, test, expect } from "../../../util/testFramework";

const createTestProcess = (name: string) => {
  const metadata = { name };
  const testStream = createAsyncIterableQueue<Uint8Array<ArrayBufferLike>>();
  const processOutput = createProcessOutput(testStream, metadata);

  return { processOutput, testStream, metadata };
};

const createTestMessage = (text: string) => {
  const encoded = new TextEncoder().encode(text);
  return { encoded, text };
};

describe("MultiProcessOutput", () => {
  describe(".bytes()", () => {
    test("with one process", async () => {
      const { processOutput, testStream } = createTestProcess("process 1");

      const messages = [
        createTestMessage("hello 1"),
        createTestMessage("hello 2"),
        createTestMessage("hello 3"),
        createTestMessage("hello 4"),
        createTestMessage("hello 5"),
        createTestMessage("hello 6"),
        createTestMessage("hello 7"),
        createTestMessage("hello 8"),
        createTestMessage("hello 9"),
        createTestMessage("hello 10"),
      ];

      for (const message of messages) {
        testStream.push(message.encoded);
      }
      testStream.close();

      const multiProcessOutput = createMultiProcessOutput([processOutput]);

      let i = 0;
      for await (const chunk of multiProcessOutput.bytes()) {
        expect(chunk).toEqual({
          metadata: { name: "process 1" },
          chunk: messages[i].encoded,
        });
        i++;
      }

      expect(i).toBe(messages.length);
    });

    test("with two processes", async () => {
      const { processOutput: processOutput1, testStream: testStream1 } =
        createTestProcess("process 1");
      const { processOutput: processOutput2, testStream: testStream2 } =
        createTestProcess("process 2");

      const messages1 = [
        createTestMessage("hello 1"),
        createTestMessage("hello 2"),
        createTestMessage("hello 3"),
      ];

      const messages2 = [
        createTestMessage("hello 4"),
        createTestMessage("hello 5"),
        createTestMessage("hello 6"),
      ];

      const multiProcessOutput = createMultiProcessOutput([
        processOutput1,
        processOutput2,
      ]);

      const messageOrder = [
        [1, 0],
        [2, 0],
        [1, 1],
        [2, 1],
        [1, 2],
        [2, 2],
      ];

      for (const [processId, messageIndex] of messageOrder) {
        [testStream1, testStream2][processId - 1].push(
          [messages1, messages2][processId - 1][messageIndex].encoded,
        );
      }

      testStream1.close();
      testStream2.close();

      let i = 0;
      for await (const chunk of multiProcessOutput.bytes()) {
        const [processId, messageIndex] = messageOrder[i];
        expect(chunk).toEqual({
          metadata: { name: `process ${processId}` },
          chunk: [messages1, messages2][processId - 1][messageIndex].encoded,
        });
        i++;
      }
    });
  });

  describe(".text()", () => {
    test("with one process", async () => {
      const { processOutput, testStream } = createTestProcess("process 1");

      const messages = [
        createTestMessage("hello 1"),
        createTestMessage("hello 2"),
        createTestMessage("hello 3"),
      ];

      for (const message of messages) {
        testStream.push(message.encoded);
      }
      testStream.close();

      const multiProcessOutput = createMultiProcessOutput([processOutput]);

      let i = 0;
      for await (const chunk of multiProcessOutput.text()) {
        expect(chunk).toEqual({
          metadata: { name: "process 1" },
          chunk: messages[i].text,
        });
        i++;
      }
      expect(i).toBe(messages.length);
    });

    test("with two processes", async () => {
      const { processOutput: processOutput1, testStream: testStream1 } =
        createTestProcess("process 1");
      const { processOutput: processOutput2, testStream: testStream2 } =
        createTestProcess("process 2");

      const messages1 = [
        createTestMessage("hello 1"),
        createTestMessage("hello 2"),
        createTestMessage("hello 3"),
      ];

      const messages2 = [
        createTestMessage("hello 4"),
        createTestMessage("hello 5"),
        createTestMessage("hello 6"),
      ];

      const multiProcessOutput = createMultiProcessOutput([
        processOutput1,
        processOutput2,
      ]);

      const messageOrder = [
        [1, 0],
        [2, 0],
        [1, 1],
        [2, 1],
        [1, 2],
        [2, 2],
      ];

      for (const [processId, messageIndex] of messageOrder) {
        [testStream1, testStream2][processId - 1].push(
          [messages1, messages2][processId - 1][messageIndex].encoded,
        );
      }

      testStream1.close();
      testStream2.close();

      let i = 0;
      for await (const chunk of multiProcessOutput.text()) {
        const [processId, messageIndex] = messageOrder[i];
        expect(chunk).toEqual({
          metadata: { name: `process ${processId}` },
          chunk: [messages1, messages2][processId - 1][messageIndex].text,
        });
        i++;
      }
    });

    test("decodes UTF-8 stream across chunk boundary (emoji split)", async () => {
      const { processOutput, testStream } = createTestProcess("process 1");
      // Chunk 1: "hello" + lead byte of 😀 (U+1F600 = F0 9F 98 80)
      testStream.push(new Uint8Array([0x68, 0x65, 0x6c, 0x6c, 0x6f, 0xf0]));
      // Chunk 2: rest of emoji + "world\n"
      testStream.push(
        new Uint8Array([0x9f, 0x98, 0x80, 0x77, 0x6f, 0x72, 0x6c, 0x64, 0x0a]),
      );
      testStream.close();

      const multiProcessOutput = createMultiProcessOutput([processOutput]);
      const chunks: string[] = [];
      for await (const { metadata, chunk } of multiProcessOutput.text()) {
        expect(metadata).toEqual({ name: "process 1" });
        chunks.push(chunk);
      }

      expect(chunks.join("")).toBe("hello😀world\n");
      expect(chunks.length).toBe(2);
      expect(chunks[0]).toBe("hello");
      expect(chunks[1]).toBe("😀world\n");
    });

    test("flushes final chunk with incomplete multi-byte (emoji)", async () => {
      const { processOutput, testStream } = createTestProcess("process 1");
      // "hello" + lead byte of 😀 only (F0); stream ends so decoder flushes replacement char
      testStream.push(new Uint8Array([0x68, 0x65, 0x6c, 0x6c, 0x6f, 0xf0]));
      testStream.close();

      const multiProcessOutput = createMultiProcessOutput([processOutput]);
      const chunks: string[] = [];
      for await (const { metadata, chunk } of multiProcessOutput.text()) {
        expect(metadata).toEqual({ name: "process 1" });
        chunks.push(chunk);
      }

      expect(chunks.length).toBe(2);
      expect(chunks[0]).toBe("hello");
      expect(chunks[1]).toBe("\uFFFD");
    });
  });
});
