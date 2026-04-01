import React from 'react';
import { render } from 'ink';
import { ApiClient, AuthRequiredError } from './api/client.js';
import { executeCommand } from './commands/execute.js';
import { parseCommand } from './commands/registry.js';
import { maybeRunDream, registerCommandExecution, registerSessionStart } from './memory/dream.js';
import { renderCommandResult, renderHelpText, renderOnboardingText } from './presenters/text.js';
import { runSelfUpdate } from './services/update.js';
import { readPreferences } from './state/storage.js';
import { CliApp } from './tui/App.js';

async function main() {
  const api = new ApiClient();
  const parsed = parseCommand(process.argv.slice(2));
  const initialProfile = await api.getProfile().catch(() => null);
  await registerSessionStart(initialProfile);
  await maybeRunDream(initialProfile).catch(() => undefined);

  if (parsed && !parsed.ok) {
    process.stderr.write(`${parsed.error}${parsed.suggestion ? `\nSanırım: ${parsed.suggestion}` : ''}\n`);
    process.exitCode = 1;
    return;
  }

  if (!parsed) {
    const preferences = await readPreferences();
    if (!process.stdout.isTTY) {
      try {
        const result = await executeCommand(
          { id: 'gundem', args: {}, json: false, rawTokens: ['gundem'] },
          { api },
        );
        await registerCommandExecution('gundem', true, { mode: 'non-tty-default' });
        process.stdout.write(`${renderCommandResult('gundem', result)}\n`);
      } catch (error) {
        await registerCommandExecution('gundem', false, { mode: 'non-tty-default' });
        if (error instanceof AuthRequiredError) {
          process.stdout.write(`${renderOnboardingText()}\n`);
        } else {
          throw error;
        }
      }
      return;
    }

    render(<CliApp api={api} preferences={preferences} />);
    return;
  }

  const command = parsed.command;
  if (command.id === 'help') {
    process.stdout.write(`${renderHelpText()}\n`);
    return;
  }
  if (command.id === 'update') {
    try {
      const message = await runSelfUpdate();
      await registerCommandExecution('update', true, {});
      process.stdout.write(`${message}\n`);
    } catch (error) {
      await registerCommandExecution('update', false, {}).catch(() => undefined);
      process.stderr.write(`${error instanceof Error ? error.message : 'Güncelleme çalışmadı.'}\n`);
      process.exitCode = 1;
    }
    return;
  }

  try {
    const result = await executeCommand(command, { api });
    await registerCommandExecution(command.id, true, { json: command.json === true });
    if (command.json) {
      const payload = result.kind === 'text' ? { message: result.data } : result.data;
      process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
      return;
    }

    process.stdout.write(`${renderCommandResult(command.id, result)}\n`);
  } catch (error) {
    await registerCommandExecution(command.id, false, { json: command.json === true }).catch(() => undefined);
    if (error instanceof AuthRequiredError) {
      process.stderr.write(`${error.message}\n${renderOnboardingText()}\n`);
      process.exitCode = 1;
      return;
    }

    process.stderr.write(`${error instanceof Error ? error.message : 'Komut çalışmadı.'}\n`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Beklenmeyen hata'}\n`);
  process.exitCode = 1;
});
