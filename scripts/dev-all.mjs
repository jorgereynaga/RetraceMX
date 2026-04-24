import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const backendDir = resolve(root, "backend");
const frontendDir = resolve(root, "frontend");

const pythonExe = "C:\\Users\\MiguelAngelJuárezTel\\AppData\\Local\\Python\\pythoncore-3.14-64\\python.exe";
const npmCmd = "npm";

function launch(name, command, args, cwd, outFile, errFile, options = {}) {
  const stdout = createWriteStream(outFile, { flags: "a" });
  const stderr = createWriteStream(errFile, { flags: "a" });
  const child = spawn(command, args, {
    cwd,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    shell: options.shell ?? false,
    windowsHide: true,
  });

  child.stdout.pipe(stdout);
  child.stderr.pipe(stderr);
  child.unref();

  console.log(`${name}: ${child.pid}`);
}

launch(
  "backend",
  pythonExe,
  ["manage.py", "runserver", "0.0.0.0:8000"],
  backendDir,
  resolve(backendDir, "backend-run.log"),
  resolve(backendDir, "backend-run.err"),
);

launch(
  "frontend",
  npmCmd,
  ["run", "dev", "--", "--host", "0.0.0.0"],
  frontendDir,
  resolve(frontendDir, "frontend-run.log"),
  resolve(frontendDir, "frontend-run.err"),
  { shell: true },
);
