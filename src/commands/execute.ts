import { loginWithBrowser } from '../auth/login.js';
import { ApiClient } from '../api/client.js';
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
      return { kind: 'profile', data: await loginWithBrowser(api) };
    case 'logout':
      await api.logout();
      return { kind: 'text', data: 'Oturum kapatildi.' };
    case 'whoami':
      return { kind: 'profile', data: await api.getProfile() };
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
