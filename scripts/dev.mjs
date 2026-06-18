import { spawn } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const processes = [
  {
    name: "api",
    args: ["--prefix", "apps/api", "run", "dev"],
  },
  {
    name: "website",
    args: ["--prefix", "apps/website", "run", "dev"],
  },
];

const children = processes.map(({ name, args }) => {
  const child = spawn(npmCommand, args, {
    stdio: "inherit",
    shell: false,
  });

  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
      shutdown();
    }
  });

  return child;
});

function shutdown() {
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
}

process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});

process.on("SIGTERM", () => {
  shutdown();
  process.exit(0);
});
