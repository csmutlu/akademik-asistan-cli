import { loginWithBrowser } from '../auth/login.js';
import { ApiClient } from '../api/client.js';
import { createBuddyMessage, loadBuddyHistory, persistBuddyHistory, trimBuddyHistory } from '../buddy/history.js';
import { watchBrief } from '../services/watch.js';
import type { CommandResult, ParsedCommand } from '../types.js';

type ExecuteContext = {
  api: ApiClient;
};

export async function executeCommand(command: ParsedCommand, context: ExecuteContext): Promise<CommandResult> {
  const { api } = context;

  switch (command.id) {
    case 'help':
      return { kind: 'text', data: '' };
    case 'login':
      return {
        kind: 'profile',
        data: await loginWithBrowser(api, {
          debug: command.args.debug === true,
          noOpen: command.args['no-open'] === true,
        }),
      };
    case 'logout':
      await api.logout();
      return { kind: 'text', data: 'Oturum kapatıldı.' };
    case 'whoami':
      return { kind: 'profile', data: await api.getProfile() };
    case 'buddy': {
      const message = typeof command.args.message === 'string' ? command.args.message.trim() : '';
      if (!message) {
        return {
          kind: 'text',
          data: 'Buddy için mesaj gerekli. Örnek: `aasistan buddy bugün neye odaklanayım`',
        };
      }
      const history = await loadBuddyHistory();
      const nextHistory = trimBuddyHistory([...history, createBuddyMessage('user', message)]);
      await persistBuddyHistory(nextHistory).catch(() => undefined);
      const reply = await api.sendBuddyMessage(message, nextHistory);
      await persistBuddyHistory([
        ...nextHistory,
        createBuddyMessage('assistant', reply.response, reply.timestamp),
      ]).catch(() => undefined);
      return {
        kind: 'buddy',
        data: reply,
      };
    }
    case 'gundem':
    case 'bugun':
    case 'yarin':
    case 'hafta':
    case 'odev':
    case 'sinav':
    case 'dersler':
      return { kind: 'agenda', data: await api.getAgenda(command.id) };
    case 'duyurular':
      return { kind: 'announcements', data: await api.getAnnouncements(5) };
    case 'yemekhane': {
      const day = command.args.day === 'tomorrow' ? 'tomorrow' : 'today';
      return { kind: 'cafeteria', data: await api.getCafeteria(day) };
    }
    case 'teacher-dashboard':
      return { kind: 'teacher-dashboard', data: await api.getTeacherDashboard() };
    case 'watch': {
      const lines: string[] = [];
      await watchBrief(api, (line) => {
        lines.push(line);
        process.stdout.write(`${line}\n`);
      });
      return { kind: 'watch', data: lines.join('\n') };
    }
    default:
      return { kind: 'text', data: '' };
  }
}
