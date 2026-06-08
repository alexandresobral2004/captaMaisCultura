// Serviço de logging centralizado para o sistema

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  details?: any;
  userId?: string;
  sessionId?: string;
}

export interface LoggerService {
  info(message: string, context?: string, details?: any): void;
  warn(message: string, context?: string, details?: any): void;
  error(message: string, context?: string, details?: any): void;
  debug(message: string, context?: string, details?: any): void;
  getLogs(filters?: LogFilters): LogEntry[];
  clearLogs(): void;
}

export interface LogFilters {
  level?: LogLevel;
  context?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

// Store em memória para logs (em produção seria um banco de dados)
class LogStore {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;

  add(entry: LogEntry): void {
    this.logs.unshift(entry); // Adiciona no início (mais recente primeiro)
    if (this.logs.length > this.maxLogs) {
      this.logs.pop(); // Remove o mais antigo
    }
  }

  getAll(): LogEntry[] {
    return [...this.logs];
  }

  filter(filters: LogFilters): LogEntry[] {
    return this.logs.filter(log => {
      if (filters.level && log.level !== filters.level) return false;
      if (filters.context && log.context !== filters.context) return false;
      if (filters.startDate && new Date(log.timestamp) < new Date(filters.startDate)) return false;
      if (filters.endDate && new Date(log.timestamp) > new Date(filters.endDate)) return false;
      if (filters.search && !log.message.toLowerCase().includes(filters.search.toLowerCase())) return false;
      return true;
    });
  }

  clear(): void {
    this.logs = [];
  }

  getStats(): { total: number; byLevel: Record<LogLevel, number> } {
    const byLevel: Record<LogLevel, number> = {
      info: 0,
      warn: 0,
      error: 0,
      debug: 0,
    };

    this.logs.forEach(log => {
      byLevel[log.level]++;
    });

    return { total: this.logs.length, byLevel };
  }
}

// Instância singleton do store
const logStore = new LogStore();

// Classe Logger
export class Logger implements LoggerService {
  private context: string;

  constructor(context: string = 'app') {
    this.context = context;
  }

  private createEntry(level: LogLevel, message: string, details?: any): LogEntry {
    return {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.context,
      details,
    };
  }

  info(message: string, context?: string, details?: any): void {
    const entry = this.createEntry('info', message, details);
    if (context) entry.context = context;
    logStore.add(entry);

    if (process.env.NODE_ENV === 'development') {
      console.info(`[${entry.timestamp}] [INFO] [${entry.context}] ${message}`, details || '');
    }
  }

  warn(message: string, context?: string, details?: any): void {
    const entry = this.createEntry('warn', message, details);
    if (context) entry.context = context;
    logStore.add(entry);

    if (process.env.NODE_ENV === 'development') {
      console.warn(`[${entry.timestamp}] [WARN] [${entry.context}] ${message}`, details || '');
    }
  }

  error(message: string, context?: string, details?: any): void {
    const entry = this.createEntry('error', message, details);
    if (context) entry.context = context;
    logStore.add(entry);

    // Erros sempre são logados no console
    console.error(`[${entry.timestamp}] [ERROR] [${entry.context}] ${message}`, details || '');
  }

  debug(message: string, context?: string, details?: any): void {
    const entry = this.createEntry('debug', message, details);
    if (context) entry.context = context;
    logStore.add(entry);

    if (process.env.NODE_ENV === 'development') {
      console.debug(`[${entry.timestamp}] [DEBUG] [${entry.context}] ${message}`, details || '');
    }
  }

  getLogs(filters?: LogFilters): LogEntry[] {
    if (!filters) return logStore.getAll();
    return logStore.filter(filters);
  }

  clearLogs(): void {
    logStore.clear();
  }

  static getStats() {
    return logStore.getStats();
  }
}

// Função para criar logger com contexto
export function createLogger(context: string): Logger {
  return new Logger(context);
}

// Logger padrão da aplicação
export const appLogger = new Logger('app');

// Middleware para Next.js API routes
export function withLogging(handler: any, context: string) {
  return async (req: Request, res?: any) => {
    const startTime = Date.now();

    try {
      appLogger.info(`Iniciando requisição: ${req.method} ${req.url}`, context);

      const response = await handler(req, res);

      const duration = Date.now() - startTime;
      appLogger.info(`Requisição concluída em ${duration}ms`, context, { duration });

      return response;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      appLogger.error(`Erro na requisição após ${duration}ms`, context, {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  };
}
