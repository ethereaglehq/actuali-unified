export type AiProviderId =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'mistral'
  | 'local'
  | (string & {});

export type FinancialTransaction = {
  id: string;
  date: string;
  amount: number;
  payee?: string | null;
  category?: string | null;
  notes?: string | null;
  accountId: string;
};

export type FinancialSnapshot = {
  currency: string;
  asOf: string;
  balances: {
    all: number;
    onBudget: number;
    offBudget: number;
  };
  accounts: Array<{
    id: string;
    name: string;
    balance: number;
    closed?: boolean;
  }>;
  recentTransactions: FinancialTransaction[];
};

export type AiContext = {
  snapshot: FinancialSnapshot;
  privacyMode: boolean;
  instructions: string;
};

export type AiCompletionRequest = {
  prompt: string;
  context: AiContext;
  maxOutputTokens?: number;
};

export type AiCompletion = {
  text: string;
  provider: AiProviderId;
  model?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
};

export type AiProvider = {
  id: AiProviderId;
  label: string;
  complete(request: AiCompletionRequest): Promise<AiCompletion>;
};

export type ActualiMutation =
  | {
      action: 'create_transaction';
      payload: {
        accountId: string;
        date: string;
        /** Integer minor currency units, never floating point amounts. */
        amount: number;
        payeeId?: string;
        categoryId?: string;
        notes?: string;
      };
    }
  | {
      action: 'set_transaction_category';
      payload: { transactionId: string; categoryId: string };
    };

export type McpJsonSchema = {
  type?: 'object' | 'string' | 'integer';
  properties?: Record<string, McpJsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
  description?: string;
  const?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;
  oneOf?: McpJsonSchema[];
};

export type McpTool = {
  name: string;
  description: string;
  inputSchema: McpJsonSchema;
  annotations: {
    readOnlyHint: boolean;
    destructiveHint: boolean;
    openWorldHint: boolean;
  };
};

/** Supplied by the authenticated host, never from a tool's JSON arguments. */
export type McpToolContext = {
  sessionId: string;
  canWrite: boolean;
  /** Redacts labels and notes; numerical amounts and dates remain available. */
  privacyMode: boolean;
  /** Authenticated UI callback; model-supplied arguments cannot approve writes. */
  isProposalApproved?: (
    proposalId: string,
    mutation: ActualiMutation,
  ) => boolean | Promise<boolean>;
};

export type McpCallResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};
