import { startFromEnvironment } from './runtime.js';

// Actual's API can log on startup. A stdio host reserves stdout for protocol
// frames and suppresses upstream diagnostics that could contain budget data.
const discardDiagnostic = (..._args: unknown[]) => undefined;
console.log = discardDiagnostic;
console.info = discardDiagnostic;
console.warn = discardDiagnostic;
console.error = discardDiagnostic;
console.debug = discardDiagnostic;

startFromEnvironment().catch(() => {
  process.stderr.write(
    'Actuali MCP could not open the configured budget. Check the setup and credentials.\n',
  );
  process.exitCode = 1;
});
