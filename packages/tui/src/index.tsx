import React, { useState, useEffect, useMemo } from "react";
import { render, Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";
import { scanWorkspaceFiles } from "./utils/fileScanner";
import { parseAndAttachFiles, AttachedFile } from "./utils/fileContext";

interface Message {
  id: string;
  sender: "user" | "assistant" | "system";
  text: string;
  attachedFiles?: AttachedFile[];
}

export function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      sender: "system",
      text: "🤖 Coding CLI Agent initialized. Type @ to tag and attach workspace files!",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [workspaceFiles, setWorkspaceFiles] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Scan workspace files on mount
  useEffect(() => {
    const files = scanWorkspaceFiles();
    setWorkspaceFiles(files);
  }, []);

  // Detect active @ tag query at cursor/end of input
  const activeQuery = useMemo(() => {
    const match = input.match(/@([^\s]*)$/);
    return match ? match[1] : null;
  }, [input]);

  // Filter matching workspace files
  const suggestions = useMemo(() => {
    if (activeQuery === null) return [];
    const queryLower = activeQuery.toLowerCase();
    return workspaceFiles
      .filter((file) => file.toLowerCase().includes(queryLower))
      .slice(0, 6); // Top 6 suggestions
  }, [activeQuery, workspaceFiles]);

  const isAutocompleteOpen = activeQuery !== null && suggestions.length > 0;

  // Reset selectedIndex when suggestions change
  useEffect(() => {
    setSelectedIndex(0);
  }, [suggestions.length]);

  // Handle autocomplete keyboard selection
  useInput(
    (inputChar, key) => {
      if (!isAutocompleteOpen) return;

      if (key.downArrow) {
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
      } else if (key.upArrow) {
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
      } else if (key.tab || (key.return && isAutocompleteOpen)) {
        // Apply autocomplete tag selection
        const selectedFile = suggestions[selectedIndex];
        if (selectedFile) {
          const updatedInput = input.replace(/@([^\s]*)$/, `@${selectedFile} `);
          setInput(updatedInput);
        }
      }
    },
    { isActive: isAutocompleteOpen }
  );

  const handleSubmit = (value: string) => {
    if (!value.trim() || isLoading) return;

    // Parse tagged files and extract content
    const { attachedFiles } = parseAndAttachFiles(value);

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: value.trim(),
      attachedFiles,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    // Simulate Agent execution using attached files
    setTimeout(() => {
      let responseText = `Received your message: "${value.trim()}".`;

      if (attachedFiles.length > 0) {
        const fileList = attachedFiles
          .map((f) => `${f.path} (${f.lines} lines)`)
          .join(", ");
        responseText += `\n📄 Attached files loaded into agent context: ${fileList}. Processing code changes...`;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: "assistant",
          text: responseText,
        },
      ]);
      setIsLoading(false);
    }, 1200);
  };

  /**
   * Formats text to render @filepath tags with highlighted badges.
   */
  const renderFormattedText = (text: string) => {
    const parts = text.split(/(@[a-zA-Z0-9_./-]+)/g);

    return parts.map((part, idx) => {
      if (part.startsWith("@")) {
        return (
          <Text key={idx} color="black" backgroundColor="cyan" bold>
            {` ${part} `}
          </Text>
        );
      }
      return <Text key={idx}>{part}</Text>;
    });
  };

  return (
    <Box flexDirection="column" padding={1} borderStyle="round" borderColor="cyan">
      {/* Header */}
      <Box marginBottom={1} justifyContent="space-between">
        <Text bold color="cyan">
          ⚡ Coding CLI Agent <Text color="gray">(v0.1.0)</Text>
        </Text>
        <Text color="green">● Files tracked: {workspaceFiles.length}</Text>
      </Box>

      {/* Message History */}
      <Box flexDirection="column" marginBottom={1}>
        {messages.map((msg) => (
          <Box key={msg.id} flexDirection="column" marginY={0}>
            <Box>
              {msg.sender === "user" ? (
                <Text bold color="green">
                  ❯ {renderFormattedText(msg.text)}
                </Text>
              ) : msg.sender === "assistant" ? (
                <Text color="white">🤖 {renderFormattedText(msg.text)}</Text>
              ) : (
                <Text color="gray">{msg.text}</Text>
              )}
            </Box>

            {/* Display Attached File Pills under User Message */}
            {msg.attachedFiles && msg.attachedFiles.length > 0 && (
              <Box marginLeft={2} marginTop={0} marginBottom={1} gap={1}>
                {msg.attachedFiles.map((file, idx) => (
                  <Text key={idx} color="magenta" italic>
                    📎 Attached: {file.path} ({file.lines} lines)
                  </Text>
                ))}
              </Box>
            )}
          </Box>
        ))}

        {isLoading && (
          <Box marginY={0}>
            <Text color="yellow">
              <Spinner type="dots" /> Agent analyzing code context...
            </Text>
          </Box>
        )}
      </Box>

      {/* File Autocomplete Suggestion Popup */}
      {isAutocompleteOpen && (
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor="yellow"
          paddingX={1}
          marginBottom={1}
        >
          <Text color="yellow" bold marginBottom={0}>
            🏷️ Tag a Workspace File (Press Tab/Enter to select, Up/Down to navigate):
          </Text>
          {suggestions.map((file, index) => {
            const isSelected = index === selectedIndex;
            return (
              <Box key={file} paddingX={1}>
                <Text color={isSelected ? "cyan" : "gray"} bold={isSelected}>
                  {isSelected ? "❯ " : "  "}📄 {file}
                </Text>
              </Box>
            );
          })}
        </Box>
      )}

      {/* Prompt Input */}
      <Box borderStyle="single" borderColor="gray" paddingX={1}>
        <Text color="cyan">❯ </Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          placeholder="Type message or @ to tag files..."
        />
      </Box>
    </Box>
  );
}

render(<App />);
