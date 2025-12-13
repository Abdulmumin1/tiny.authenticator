#!/usr/bin/env node

import React, { useState, useEffect } from "react";
import { render, Text, Box, useInput, useApp } from "ink";
import TextInput from "ink-text-input";
import clipboardy from "clipboardy";
import base32Decode from "base32-decode";
import { Authenticator } from "./authenticator";
import { decode, readQRCode, readQRFromSelection, parseOtpAuthUri } from "./import";
import { generateGoogleMigrationQR, exportSingleAccountQR } from "./export";
import BigText from "./BigText";
import tinyFont from './tiny.json';



// --- Components ---

const ACCENT_COLOR = '#FF69B4'

const RegisterComponent: React.FC<{ onDone: (account?: string) => void }> = ({ onDone }) => {
  const [step, setStep] = useState<"secret" | "account" | "done">("secret");
  const [secret, setSecret] = useState("");
  const [account, setAccount] = useState("");
  const [error, setError] = useState("");
  const tiny = tinyFont 

  useInput((_, key) => {
    if (key.return) {
      if (step === "secret") {
        if (!secret.trim()) return setError("Secret is required");
        // Validate base32
        try {
          base32Decode(secret.trim(), 'RFC4648');
        } catch (e) {

          return setError("Invalid base32 secret");
        }
        setStep("account");
        setError("");
      } else if (step === "account") {
        if (!account.trim()) return setError("Account name is required");

        const auth = new Authenticator();
        auth.register(account.trim(), secret.trim()).then(async (success) => {
          if (success) {
            onDone(account.trim());
          } else {
            setError("Registration failed");
          }
        });
      }
    }
  });

  if (step === "done") {
    return (
      <Box padding={1} flexDirection="column">
        <Text color="green">Registering...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <BigText text="REGISTER" font="tiny" colors={[ACCENT_COLOR]} />
      <Box marginTop={1} flexDirection="column">
        <Box>
          <Text color="gray" bold={step === "secret"}>
            {step === "secret" ? "› " : "  "}Secret:{" "}
          </Text>
          {step === "secret" ? (
            <TextInput
              value={secret}
              onChange={setSecret}
              placeholder="token string"
            />
          ) : (
            <Text color="gray">********</Text>
          )}
        </Box>
        {/* @ts-ignore */}
        {(step === "account" || step === "done") && (
          <Box>
            <Text color="gray" bold={step === "account"}>
              {step === "account" ? "› " : "  "}Account:{" "}
            </Text>
            <TextInput
              value={account}
              onChange={setAccount}
              placeholder="name@example.com"
            />
          </Box>
        )}
      </Box>

      {error && (
        <Box marginTop={1}>
          <Text color="red">! {error}</Text>
        </Box>
      )}
    </Box>
  );
};

const ImportComponent: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [step, setStep] = useState<"uri" | "accounts" | "done">("uri");
  const [uri, setUri] = useState("");
  const [accounts, setAccounts] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { exit } = useApp();

  useInput((input, key) => {
    if (key.return) {
      if (step === "uri") {
        console.log("this is the uri",uri)
        if (!uri.trim()) return setError("URI is required");
        decode(uri.trim()).then(decoded => {
          setAccounts(decoded);
          setStep("accounts");
          setError("");
        }).catch(e => {
          setError(e.message);
        });
      } else if (step === "accounts") {
        // Register selected account
        const account = accounts[selectedIndex];
        if (account) {
          const auth = new Authenticator();
          const accountName = `${account.issuer}:${account.name}`;
          auth.register(accountName, account.secret).then(success => {
            if (success) {
              setStep("done");
              setTimeout(onDone, 1000);
            } else {
              setError("Registration failed");
            }
          });
        }
      }
    } else if (key.upArrow) {
      setSelectedIndex(Math.max(0, selectedIndex - 1));
    } else if (key.downArrow) {
      setSelectedIndex(Math.min(accounts.length - 1, selectedIndex + 1));
    } else if (key.escape) {
      exit();
    }
  });

  if (step === "done") {
    return (
      <Box padding={1} flexDirection="column">
        <Text color="green">✔ Account registered successfully.</Text>
      </Box>
    );
  }

  if (step === "accounts") {
    return (
      <Box flexDirection="column" padding={1}>
        <BigText text="IMPORT" font="tiny" colors={["magenta"]} />
        <Text>Found {accounts.length} accounts. Select one to register:</Text>
        <Box marginTop={1} flexDirection="column">
          {accounts.map((account, index) => (
            <Box key={index}>
              <Text color={selectedIndex === index ? "cyan" : "gray"}>
                {selectedIndex === index ? "› " : "  "}{account.issuer}:{account.name} ({account.type})
              </Text>
            </Box>
          ))}
        </Box>
        <Text color="gray">↑↓ to navigate, Enter to register, Esc to exit</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <BigText text="IMPORT" font="tiny" colors={["magenta"]} />
      <Box marginTop={1} flexDirection="column">
        <Text>Paste your Google Authenticator migration URI:</Text>
        <TextInput
          value={uri}
          onChange={setUri}
          placeholder="otpauth-migration://..."
        />
      </Box>

      {error && (
        <Box marginTop={1}>
          <Text color="red">! {error}</Text>
        </Box>
      )}
    </Box>
  );
};

const ShowAllComponent: React.FC<{
  initialAccounts: { account: string }[];
  initialTokens: Record<string, string | null>;
  auth: Authenticator;
}> = ({ initialAccounts, initialTokens, auth }) => {
  const { exit } = useApp();

  const [accounts, setAccounts] = useState(initialAccounts);
  const [tokens, setTokens] = useState(initialTokens);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [deleteActionIndex, setDeleteActionIndex] = useState(0); // 0 = Cancel, 1 = Delete

  // --- 1. Auto Refresh Logic (Every 1s) ---
  useEffect(() => {
    const timer = setInterval(async () => {
      const nextTokens: Record<string, string | null> = {};
      for (const item of accounts) {
        nextTokens[item.account] = await auth.getTokenForAccount(item.account);
      }
      setTokens(nextTokens);
    }, 1000);

    return () => clearInterval(timer);
  }, [accounts, auth]);

  useEffect(() => {
    if (copiedId) {
      const timer = setTimeout(() => {
        setCopiedId(null);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [copiedId]);

  useInput(async (input, key) => {
    // A. CONFIRMATION MODE INPUTS
    if (isConfirmingDelete) {
      if (key.upArrow || key.downArrow) {
        setDeleteActionIndex((prev) => (prev === 0 ? 1 : 0));
      }

      if (key.return) {
        if (deleteActionIndex === 1) {
          // @ts-ignore PERFORM DELETE
          const accountToDelete = accounts[selectedIndex].account;
          try {
            await auth.deleteAuthStuff(accountToDelete); // Ensure your auth class has this!

            const newAccounts = accounts.filter((_, i) => i !== selectedIndex);
            setAccounts(newAccounts);
            if (selectedIndex >= newAccounts.length) {
              setSelectedIndex(Math.max(0, newAccounts.length - 1));
            }
          } catch (err) {}
        }
        // Whether we deleted or canceled, close the modal
        setIsConfirmingDelete(false);
      }

      if (key.escape) {
        setIsConfirmingDelete(false);
      }
      return;
    }

    // B. NORMAL NAVIGATION INPUTS
    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
      setCopiedId(null);
    }
    if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(accounts.length - 1, prev + 1));
      setCopiedId(null);
    }
    if (key.return) {
      // @ts-ignore
      const currentAccount = accounts[selectedIndex].account;
      const token = tokens[currentAccount];
      if (token) {
        clipboardy.writeSync(token);
        setCopiedId(currentAccount);
      }
    }
    // Delete Trigger
    if (input === "d") {
      setIsConfirmingDelete(true);
      setDeleteActionIndex(0); // Reset to "Cancel" (Safety first)
    }
    // Quit
    if (key.escape || input === "q") {
      exit();
    }
  });

  if (accounts.length === 0) {
    setTimeout(exit, 10)
    return (
      <Box padding={1}>
        <Text color="yellow">No accounts found.</Text>
      </Box>
    );
  }

  const currentAccountName = accounts[selectedIndex]?.account || "";

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      {/* HEADER */}
      <Box marginBottom={1} flexDirection="column" alignItems="flex-start">
        <BigText text="TINY.AUTH" font="tiny" colors={[ACCENT_COLOR, ACCENT_COLOR]} />
        <Text color="gray" dimColor>
          {" "}
          (Enter to copy, 'd' to delete, 'q' to quit)
        </Text>
      </Box>

      {/* DELETE CONFIRMATION OVERLAY */}
      {isConfirmingDelete ? (
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="red"
          paddingX={1}
          marginBottom={1}
        >
          <Text color="red" bold>
            Delete "{currentAccountName.toUpperCase()}"?
          </Text>

          <Box marginTop={1} flexDirection="column">
            <Box>
              <Text color={ACCENT_COLOR} bold={deleteActionIndex === 0}>
                {deleteActionIndex === 0 ? "› " : "  "}
              </Text>
              <Text color={deleteActionIndex === 0 ? "white" : "gray"}>
                Cancel
              </Text>
            </Box>
            <Box>
              <Text color={ACCENT_COLOR} bold={deleteActionIndex === 1}>
                {deleteActionIndex === 1 ? "› " : "  "}
              </Text>
              <Text color={deleteActionIndex === 1 ? "red" : "gray"}>
                Yes, Delete
              </Text>
            </Box>
          </Box>
        </Box>
      ) : (
        /* NORMAL LIST */
        <Box flexDirection="column" gap={1}>
          {accounts.map((item, index) => {
            const isSelected = index === selectedIndex;
            const isCopied = copiedId === item.account;
            const token = tokens[item.account];

            return (
              <Box key={item.account} flexDirection="column">
                {/* Row 1: Account Name */}
                <Box marginLeft={2}>
                  <Text
                    color={isSelected ? ACCENT_COLOR : "gray"}
                    bold={isSelected}
                  >
                    {item.account.toUpperCase()}
                  </Text>
                </Box>

                {/* Row 2: Arrow + Token */}
                <Box>
                  <Text color={ACCENT_COLOR} bold={isSelected}>
                    {isSelected ? "› " : "  "}
                  </Text>

                  <Text
                    color={isCopied ? "green" : isSelected ? "green" : "gray"}
                    bold={isSelected}
                    dimColor={!isSelected}
                  >
                    {isCopied ? "Copied to clipboard!" : token || "Error"}
                  </Text>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
};



const ExitComponent: React.FC = () => {
  const { exit } = useApp();

  setTimeout(exit);

  return (
    <Box flexDirection="column" padding={1}>
      <BigText text="HELP" font="tiny" colors={[ACCENT_COLOR]} />
      <Text bold color="yellow">
        Usage:
      </Text>
      <Box marginLeft={2} flexDirection="column">
        <Text>bun run index.ts register</Text>
        <Text>bun run index.ts register cc</Text>
        <Text>bun run index.ts import google [uri]</Text>
        <Text>bun run index.ts import qr &lt;image_path&gt;</Text>
        <Text>bun run index.ts export google</Text>
        <Text>bun run index.ts export qr &lt;account&gt;</Text>
        <Text>bun run index.ts show</Text>
        <Text>bun run index.ts show &lt;account&gt;</Text>
      </Box>
    </Box>
  );
};
// --- Main Logic ---

async function main() {
  const args = process.argv.slice(2);
  const auth = new Authenticator();

  const run = async (component: React.ReactElement) => {
    const { waitUntilExit } = render(component);
    await waitUntilExit();
    process.exit(0);
  };

  if (args[0] === "register") {
    if (args[1] === "cc") {
      // Register from screenshot QR
      readQRFromSelection().then(uri => {
        const { issuer, name, secret } = parseOtpAuthUri(uri);
        console.log(`Detected: ${issuer}:${name}`);
        const accountName = `${issuer}:${name}`;
        const auth = new Authenticator();
        auth.register(accountName, secret).then(success => {
          if (success) {
            console.log(`✓ Registered: ${accountName}`);
            auth.getTokenForAccount(accountName).then(token => {
              console.log(`Current token: ${token}`);
              process.exit(0);
            });
          } else {
            console.error("Registration failed");
            process.exit(1);
          }
        });
      }).catch(e => {
        console.error("Error:", e.message);
        process.exit(1);
      });
    } else {
      await run(<RegisterComponent onDone={(account) => {
        if (account) {
          // Show the newly registered account
          const auth = new Authenticator();
          auth.listAccounts().then(accounts => {
            const filtered = accounts.filter(a => a.account === account);
            const tokens: Record<string, string | null> = {};
            auth.getTokenForAccount(account).then(token => {
              tokens[account] = token;
              run(<ShowAllComponent initialAccounts={filtered} initialTokens={tokens} auth={auth} />);
            });
          });
        } else {
          process.exit(0);
        }
      }} />);
    }
  } else if (args[0] === "export") {
    if (args[1] === "google") {
      // Export all accounts as Google migration QR
      const auth = new Authenticator();
      auth.listAccounts().then(async accounts => {
        const accountDetails = [];
        for (const { account } of accounts) {
          const secret = await auth.retrieveSecret(account);
          if (secret) {
            const [issuer, name] = account.split(':');
            accountDetails.push({ issuer: issuer || '', name: name || account, secret });
          }
        }
        if (accountDetails.length > 0) {
          await generateGoogleMigrationQR(accountDetails);
        } else {
          console.log("No accounts to export");
        }
        process.exit(0);
      }).catch(e => {
        console.error("Error:", e.message);
        process.exit(1);
      });
    } else if (args[1] === "qr" && args[2]) {
      const auth = new Authenticator();
      auth.retrieveSecret(args[2]).then(secret => {
        if (secret) {
           // @ts-ignore
          const [issuer, name] = args[2].split(':');  // @ts-ignore
          exportSingleAccountQR(issuer || '', name || args[2], secret);
        } else {
          console.error("Account not found");
        }
        process.exit(0);
      }).catch(e => {
        console.error("Error:", e.message);
        process.exit(1);
      });
    } else {
      console.error("Usage: bun run index.tsx export google or export qr <account>");
      process.exit(1);
    }
  } else if (args[0] === "import") {
    if (args[1] === "google") {
      if (args[2]) {
        decode(args[2]).then(async accounts => {
          console.log("Decoded accounts:");
          const auth = new Authenticator();
          for (const acc of accounts) {
            const accountName = `${acc.issuer}:${acc.name}`;
            console.log(`${accountName} - ***`);
            const success = await auth.register(accountName, acc.secret);
            if (success) {
              console.log(`✓ Registered: ${accountName}`);
            } else {
              console.log(`✗ Failed: ${accountName}`);
            }
          }
          console.log("Import complete!");
          process.exit(0);
        }).catch(e => {
          console.error("Error:", e.message);
          process.exit(1);
        });
      } else {
        await run(<ImportComponent onDone={() => process.exit(0)} />);
      }
    } else if (args[1] === "qr") {
      if (args[2]) {
        // QR image path provided
        readQRCode(args[2]).then(uri => {
          console.log("QR Code decoded to URI");
          return decode(uri);
        }).then(async accounts => {
          console.log("Decoded accounts:");
          const auth = new Authenticator();
          for (const acc of accounts) {
            const accountName = `${acc.issuer}:${acc.name}`;
            console.log(`${accountName} - ***`);
            const success = await auth.register(accountName, acc.secret);
            if (success) {
              console.log(`✓ Registered: ${accountName}`);
            } else {
              console.log(`✗ Failed: ${accountName}`);
            }
          }
          console.log("Import complete!");
          process.exit(0);
        }).catch(e => {
          console.error("Error:", e.message);
          process.exit(1);
        });
      } else {
        console.error("Error: Please provide path to QR code image");
        process.exit(1);
      }
    } else {
      console.error("Usage: bun run index.tsx import google [uri] or import qr <image_path>");
      process.exit(1);
    }
  } else if (args[0] === "show") {
    const accounts = await auth.listAccounts();
    let filteredAccounts = accounts;
    if (args[1]) {
      // @ts-ignore
      filteredAccounts = accounts.filter(a => a.account.toLowerCase() === args[1].toLowerCase());
    }
    const tokens: Record<string, string | null> = {};

    for (const { account } of filteredAccounts) {
      tokens[account] = await auth.getTokenForAccount(account);
    }

    await run(
      <ShowAllComponent
        initialAccounts={filteredAccounts}
        initialTokens={tokens}
        auth={auth}
      />
    );
  } else {
    await run(<ExitComponent />);
  }
}

main();
