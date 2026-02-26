export interface Config {
  host: string;
  port: number;
  queryTimeout: number;
  importTimeout: number;
}

export function loadConfig(): Config {
  return Object.freeze({
    host: process.env.JOERN_HOST ?? "localhost",
    port: parseInt(process.env.JOERN_PORT ?? "8080", 10),
    queryTimeout: parseInt(process.env.JOERN_QUERY_TIMEOUT ?? "30000", 10),
    importTimeout: parseInt(process.env.JOERN_IMPORT_TIMEOUT ?? "300000", 10),
  });
}

export const config = loadConfig();
