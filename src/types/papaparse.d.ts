declare module "papaparse" {
  interface ParseConfig {
    delimiter?: string;
    newline?: string;
    quoteChar?: string;
    escapeChar?: string;
    header?: boolean;
    dynamicTyping?: boolean;
    preview?: number;
    worker?: boolean;
    comments?: string;
    skipEmptyLines?: boolean | "greedy";
    download?: boolean;
    transform?: (value: string, field: string | number) => any;
    complete?: (results: ParseResult<any>, file?: string) => void;
    error?: (error: ParseError, file?: string) => void;
    chunk?: (results: ParseResult<any>, parser: Parser) => void;
    fastMode?: boolean;
    beforeFirstChunk?: (chunk: string) => string | void;
    transformHeader?: (header: string) => string;
  }

  interface ParseError {
    type: string;
    code: string;
    message: string;
    row: number;
  }

  interface ParseResult<T> {
    data: T[];
    errors: ParseError[];
    meta: {
      delimeter: string;
      linebreak: string;
      aborted: boolean;
      fields: string[];
      truncated: boolean;
    };
  }

  interface Parser {
    abort: () => void;
    pause: () => void;
    resume: () => void;
  }

  function parse<T = any>(
    input: string | File | NodeJS.ReadableStream,
    config?: ParseConfig
  ): ParseResult<T>;

  function parse<T = any>(
    input: string | File | NodeJS.ReadableStream,
    config?: ParseConfig & { download: true }
  ): void;

  export { parse, ParseConfig, ParseResult, ParseError, Parser };
  export default { parse };
}
